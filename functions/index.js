const {onRequest} = require("firebase-functions/v2/https");
const {FieldValue} = require("@google-cloud/firestore");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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
  const embedding = await calculateEmbedding(character);

  await event.data.ref.update({
    embedding: embedding,
  });
  console.log(`Embeddings updated for ${event.data.ref.path}`);
});

const calculateEmbedding = async (character) => {
  const summary = [character.name];

  if (character.location.name) {
    summary.push(character.location.name);
  }

  if (character.type) {
    summary.push(character.type);
  }

  console.log(`Calculating embeddings with: ${JSON.stringify(summary)}`);

  return FieldValue.vector([1.0, 2.0, 3.0, 4.0, 5.0]);
};
