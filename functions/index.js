const {onRequest} = require("firebase-functions/v2/https");
const axios = require("axios");

exports.import = onRequest(async (_, response) => {
  const characters = [];

  try {
    let nextUrl = "https://rickandmortyapi.com/api/character";

    while (nextUrl) {
      console.log(`Fetching ${nextUrl}`);
      const apiResponse = await axios.get(nextUrl);
      const json = apiResponse.data;
      characters.push(...json.results);
      nextUrl = json.info.next;
    }

    response.send(`Imported ${characters.length} characters`);
  } catch (error) {
    console.error(error);
    response.status(500).send();
  }
});

exports.search = onRequest((request, response) => {
  response.send(`Searching for ${request.query.query}`);
});
