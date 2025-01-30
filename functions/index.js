const {onRequest} = require("firebase-functions/v2/https");

exports.search = onRequest((_, response) => {
  response.send("Hello from Firebase!");
});
