const {onRequest} = require("firebase-functions/v2/https");
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

      await batch.commit();

      nextUrl = apiResponse.data.info.next;
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
      matches.push(data);
    }
  }

  response.send(matches);
});
