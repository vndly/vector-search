const { onRequest } = require("firebase-functions/v2/https");
const { FieldValue } = require("@google-cloud/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const axios = require("axios");
const admin = require("firebase-admin");
const aiplatform = require("@google-cloud/aiplatform");
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

admin.initializeApp();
const db = admin.firestore();

const clientOptions = { apiEndpoint: "us-central1-aiplatform.googleapis.com" };
const client = new PredictionServiceClient(clientOptions);

exports.import = onRequest(async (_, response) => {
  try {
    let counter = 0;
    let nextUrl = "https://rickandmortyapi.com/api/character";

    while (nextUrl) {
      console.log(`Fetching ${nextUrl}`);
      const apiResponse = await axios.get(nextUrl);
      counter += apiResponse.data.results.length;

      const batch = db.batch();

      for (const character of apiResponse.data.results) {
        delete character.episode;
        const docRef = db.collection("characters").doc(character.id.toString());
        batch.set(docRef, character);
      }

      const writes = await batch.commit();
      console.log(`Written ${writes.length} characters`);

      nextUrl = undefined; // apiResponse.data.info.next;
    }

    response.send(`Imported ${counter} characters`);
  } catch (error) {
    console.error(error);
    response.status(500).send(error.toString());
  }
});

// https://firebase.google.com/docs/firestore/vector-search
// https://cloud.google.com/blog/products/databases/get-started-with-firestore-vector-similarity-search
// https://www.youtube.com/watch?v=3u7u4mNbYZI
exports.search = onRequest(async (request, response) => {
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
}