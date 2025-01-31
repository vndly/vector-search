const { onRequest } = require("firebase-functions/v2/https");
//const { FieldValue } = require("@google-cloud/firestore");
//const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
//const aiplatform = require("@google-cloud/aiplatform");
//const { PredictionServiceClient } = aiplatform.v1;
//const { helpers } = aiplatform;

admin.initializeApp();
const db = admin.firestore();

exports.helloWorld = onRequest((_, res) => {
  res.send("Hello, World!");
});

//const clientOptions = { apiEndpoint: "us-central1-aiplatform.googleapis.com" };
//const client = new PredictionServiceClient(clientOptions);

exports.import = onRequest(async (_, response) => {
  const test = await readCSV("data/data.csv");
  console.log(test[0]);
  let movies = await getMovies();
  movies = movies.slice(1, 101);
  const chunks = chunkArray(movies, 500);

  for (const chunk of chunks) {
    const batch = db.batch();

    for (const movie of chunk) {
      const id = generateHash(movie.title);
      const docRef = db.collection("movies").doc(id);
      batch.set(docRef, movie);
    }

    const writes = await batch.commit();
    console.log(`Written ${writes.length} movies`);
  }

  response.send(`Imported ${movies.length} movies`);
});

const getMovies = async () => {
  const content = fs.readFileSync("data/data.csv", "utf8");
  const lines = content.split("\n");
  
  return lines.map(getMovie);
}

const getMovie = (line) => {
  const [title, genres, summary, cast] = line.split(",");
  
  return {
    title: title,
    genres: genres,
    summary: summary,
    cast: cast,
  }
}

const chunkArray = (array, chunkSize) => {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

const generateHash = (input) => {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const readCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const { title, genre, summary, cast } = data;
        results.push({
          title: title,
          genres: genre.split(",").map((genre) => genre.trim()),
          summary: summary,
          cast: cast.split(",").map((actor) => actor.trim()),
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
/*exports.search = onRequest(async (request, response) => {
  const query = request.query.query.toString().toLowerCase();
  const embedding = await calculateEmbedding(query);
  const collection = db.collection("characters");
  const vectorQuery = collection.findNearest({
    vectorField: "embedding_field",
    queryVector: embedding,
    limit: 10,
    //distanceThreshold: 1,
    //distanceResultField: 'vector_distance',
    distanceMeasure: "COSINE",
  });

  const snapshot = await vectorQuery.get();
  const matches = snapshot.docs.map(doc => doc.data());

  response.send(matches);
});

exports.onCharacterCreated = onDocumentCreated("characters/{id}", async (event) => {
  const character = event.data.data();
  const embedding = await characterEmbedding(character);

  await event.data.ref.update({
    embedding: FieldValue.vector(embedding),
  });
  console.log(`Embeddings updated for ${event.data.ref.path}`);
});

const characterEmbedding = async (character) => {
  const summary = [character.name];

  if (character.location.name) {
    summary.push(character.location.name);
  }

  if (character.type) {
    summary.push(character.type);
  }

  console.log(`Calculating embeddings with: "${summary.join("\n")}"`);
  const embedding = await calculateEmbedding(summary.join("\n"));
  console.log(`Calculated embeddings of length: ${embedding.length}`);

  return embedding;
};

// https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#generative-ai-get-text-embedding-nodejs
// https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/cost?inv=1&invt=AboQqA&project=andstoreapps
const calculateEmbedding = async (text) => {
  const instances = [helpers.toValue({
    content: text,
    task_type: "SEMANTIC_SIMILARITY",
  })];
  const parameters = helpers.toValue({});
  const request = {
    endpoint: "projects/andstoreapps/locations/us-central1/publishers/google/models/text-embedding-005",
    instances: instances,
    parameters: parameters,
  };
  const [response] = await client.predict(request);
  const embeddings = response.predictions.map(p => {
    const embeddingsProto = p.structValue.fields.embeddings;
    const valuesProto = embeddingsProto.structValue.fields.values;
    return valuesProto.listValue.values.map(v => v.numberValue);
  });

  return embeddings[0];
}*/