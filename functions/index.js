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
        const docRef = db.collection("characters").doc(character.id.toString());
        batch.set(docRef, character);
      }

      const res = await batch.commit();
      console.log(res);

      nextUrl = apiResponse.data.info.next;
    }

    response.send(`Imported ${counter} characters`);
  } catch (error) {
    console.error(error);
    response.status(500).send();
  }
});

exports.search = onRequest((request, response) => {
  response.send(`Searching for ${request.query.query}`);
});
