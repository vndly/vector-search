const { onRequest } = require("firebase-functions/v2/https");
const { FieldValue } = require("@google-cloud/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const axios = require("axios");
const admin = require("firebase-admin");
const aiplatform = require('@google-cloud/aiplatform');
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

admin.initializeApp();
const db = admin.firestore();

const clientOptions = { apiEndpoint: 'us-central1-aiplatform.googleapis.com' };
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
exports.search = onRequest(async (request, response) => {
  const query = request.query.query.toString().toLowerCase();
  const characters = await db.collection("characters").get();
  const matches = [];

  for (const character of characters.docs) {
    const data = character.data();

    if (data.name.toString().toLowerCase().includes(query)) {
      console.log(`Found match for ${data.name}`);
      matches.push(data);
    }
  }

  response.send(matches);
});

exports.onCharacterCreated = onDocumentCreated("characters/{id}", async (event) => {
  const character = event.data.data();
  const embedding = await characterEmbedding(character);

  await event.data.ref.update({
    embedding: embedding,
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

  console.log(`Calculating embeddings with: ${JSON.stringify(summary)}`);
  const embedding = await calculateEmbedding(summary.join("\n"));
  console.log(`Calculated embeddings of length: ${embedding[0].length}`);

  return FieldValue.vector(embedding[0]);
};

const calculateEmbedding = async (text) => {
  const endpoint = `projects/andstoreapps/locations/us-central1/publishers/google/models/text-embedding-005`;
  const instances = helpers.toValue({
    content: text,
    task_type: 'SEMANTIC_SIMILARITY',
  });
  const parameters = helpers.toValue({});
  const request = { endpoint, instances, parameters };
  const [response] = await client.predict(request);
  const predictions = response.predictions;
  const embeddings = predictions.map(p => {
    const embeddingsProto = p.structValue.fields.embeddings;
    const valuesProto = embeddingsProto.structValue.fields.values;
    return valuesProto.listValue.values.map(v => v.numberValue);
  });

  return embeddings;
}