const {onRequest} = require("firebase-functions/v2/https");

exports.search = onRequest((request, response) => {
  response.send(`Searching for ${request.query.query}`);
});
