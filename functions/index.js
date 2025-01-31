const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten, } = require("firebase-functions/v2/firestore");

admin.initializeApp();

setGlobalOptions({
  memory: "512MiB"
});

const isEmulator = process.env.FIREBASE_EMULATOR_HUB ? true : false;

exports.import = onRequest(async (_, response) => {
  const movies = await getMovies("data/data.csv");
  const chunks = chunkArray(movies, 500);
  const db = admin.firestore();
  let count = 0;

  for (const chunk of chunks) {
    const batch = db.batch();

    for (const movie of chunk) {
      const id = generateHash(movie.title);
      const docRef = db.collection("movies").doc(id);
      batch.set(docRef, movie);
    }

    const writes = await batch.commit();
    console.log(`Written ${writes.length} movies`);
    count += writes.length;

    if (isEmulator) {
      break;
    }
  }

  response.send(`Imported ${count} movies`);
});

const chunkArray = (array, chunkSize) => {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

const generateHash = (input) => {
  const crypto = require("crypto");

  return crypto.createHash("sha256").update(input).digest("hex");
}

const getMovies = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const fs = require("fs");
    const csv = require("csv-parser");

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const { title, genre, summary, cast } = data;
        results.push({
          title: title,
          genres: genre.split(",").map(genre => genre.trim()),
          summary: summary,
          cast: cast.split(",").map(actor => actor.trim()),
        });
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

// https://firebase.google.com/docs/firestore/vector-search
// https://cloud.google.com/blog/products/databases/get-started-with-firestore-vector-similarity-search
// https://www.youtube.com/watch?v=3u7u4mNbYZI
exports.search = onRequest(async (request, response) => {
  const query = request.query.query.toString().toLowerCase();
  const distance = request.query.distance.toString().toUpperCase();
  const embedding = await calculateEmbedding(query);
  console.log(`Query: "${query}" with embedding length "${embedding.length}" using distance "${distance}"`);

  const db = admin.firestore();
  const collection = db.collection("movies"); //.where("embedding", "!=", null);
  const vectorQuery = collection.findNearest({
    vectorField: "embedding",
    queryVector: embedding,
    limit: 10,
    //distanceThreshold: 1,
    //distanceResultField: 'vector_distance',
    distanceMeasure: distance, // 'EUCLIDEAN' | 'COSINE' | 'DOT_PRODUCT'
  });

  const explainResult = await vectorQuery.query.explain({analyze: true});
  console.log(`Query explained: ${JSON.stringify(explainResult)}`);

  const snapshot = await vectorQuery.get();
  console.log(`Found ${snapshot.docs.length} matches`);

  const matches = snapshot.docs.map(doc => doc.data());

  response.send(matches);
});

exports.onMovieCreated = onDocumentWritten("movies/{id}", async (event) => {
  if (!isEmulator) {
    const movie = event.data.after.data();
    const path = event.document;
    console.log(`Movie updated: ${path} data: ${JSON.stringify(movie)}`);

    if (!movie.embedding) {
      const embedding = await movieEmbedding(movie);
      const db = admin.firestore();
      const docRef = db.doc(path);
      const { FieldValue } = require("@google-cloud/firestore");

      await docRef.update({
        embedding: FieldValue.vector(embedding),
      });
      console.log(`Embeddings updated for ${path}`);
    }
  }
});

const movieEmbedding = async (movie) => {
  const values = [
    movie.title,
    movie.genres.join(" "),
    movie.summary,
    movie.cast.join(" "),
  ];

  console.log(`Calculating embeddings with: "${values.join("\n")}"`);
  const embedding = await calculateEmbedding(values.join("\n"));
  console.log(`Calculated embeddings of length: ${embedding.length}`);

  return embedding;
};

// https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#generative-ai-get-text-embedding-nodejs
// https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/cost?inv=1&invt=AboQqA&project=max-prototypes
const calculateEmbedding = async (text) => {
  const aiplatform = require("@google-cloud/aiplatform");
  const { PredictionServiceClient } = aiplatform.v1;
  const { helpers } = aiplatform;
  const instances = [helpers.toValue({
    content: text,
    task_type: "SEMANTIC_SIMILARITY",
  })];
  const parameters = helpers.toValue({});
  const request = {
    endpoint: "projects/max-prototypes/locations/us-central1/publishers/google/models/text-embedding-005",
    instances: instances,
    parameters: parameters,
  };
  const clientOptions = { apiEndpoint: "us-central1-aiplatform.googleapis.com" };
  const client = new PredictionServiceClient(clientOptions);
  const [response] = await client.predict(request);
  const embeddings = response.predictions.map(p => {
    const embeddingsProto = p.structValue.fields.embeddings;
    const valuesProto = embeddingsProto.structValue.fields.values;
    return valuesProto.listValue.values.map(v => v.numberValue);
  });

  return embeddings[0];
}