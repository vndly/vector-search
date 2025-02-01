const admin = require("firebase-admin")
const { setGlobalOptions } = require("firebase-functions/v2")
const { onRequest } = require("firebase-functions/v2/https")
//const { onDocumentWritten, } = require("firebase-functions/v2/firestore")

admin.initializeApp()

setGlobalOptions({
  memory: "512MiB"
})

const isEmulator = process.env.FIREBASE_EMULATOR_HUB ? true : false
const recomputeLength = isEmulator ? 3 : 500

exports.import = onRequest(async (_, response) => {
  const movies = await getMovies("data/data.csv")
  const chunks = chunkArray(movies, 500)
  const db = admin.firestore()
  let count = 0

  for (const chunk of chunks) {
    const batch = db.batch()

    for (const movie of chunk) {
      const id = movie.id
      delete movie.id
      const docRef = db.collection("movies").doc(id.toString())
      batch.set(docRef, movie, { merge: true })
    }

    const writes = await batch.commit()
    count += writes.length
    console.log(`Written ${writes.length} movies of ${count}`)

    if (isEmulator) {
      break
    }
  }

  response.send(`Imported ${count} movies`)
})

const getMovies = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = []
    const fs = require("fs")
    const csv = require("csv-parser")

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const { id, title, genre, summary, cast } = data
        results.push({
          id: id,
          title: title,
          genres: cleanArray(genre),
          summary: summary,
          cast: cleanArray(cast),
          hasEmbedding: false,
        })
      })
      .on("end", () => {
        resolve(results)
      })
      .on("error", (error) => {
        reject(error)
      })
  })
}

const cleanArray = (input) => {
  const array = input.split(",").map(e => e.trim())

  return array.filter(value => (value !== undefined) && (value !== null) && (value !== ""))
}

const chunkArray = (array, chunkSize) => {
  const chunks = []

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }

  return chunks
}

exports.recompute = onRequest(async (_, response) => {
  const db = admin.firestore()
  const snapshot = await db.collection("movies").where("hasEmbedding", "==", false).limit(recomputeLength).get()
  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const movie = doc.data()
    const embedding = await movieEmbedding(doc.id, movie)

    if (embedding) {
      const { FieldValue } = require("@google-cloud/firestore")
      batch.update(doc.ref, {
        embedding: FieldValue.vector(embedding),
        hasEmbedding: true,
      })
    } else {
      console.log(`Error calculating embedding for ${movie.id}`)
    }
  }

  const writes = await batch.commit()
  response.send(`Updated ${writes.length} movies`)
})

const movieEmbedding = async (id, movie) => {
  const values = [
    movie.title,
    movie.genres.join(" "),
    movie.summary,
    movie.cast.join(" "),
  ].join(" ")

  console.log(`Calculating embeddings for "${id}" with: "${values}"`)
  const embedding = await calculateEmbedding(values)
  console.log(`Calculated embeddings of length: ${embedding.length}`)

  return embedding
}

// https://firebase.google.com/docs/firestore/vector-search
// https://cloud.google.com/blog/products/databases/get-started-with-firestore-vector-similarity-search
// https://www.youtube.com/watch?v=3u7u4mNbYZI
exports.search = onRequest(async (request, response) => {
  const query = request.query.query.toString().toLowerCase()
  const distance = request.query.distance.toString().toUpperCase()
  const threshold = parseFloat(request.query.threshold)
  const limit = parseInt(request.query.limit)
  const embedding = await calculateEmbedding(query)
  console.log(`Query: "${query}" with embedding length "${embedding.length}" using distance "${distance}"`)

  const db = admin.firestore()
  const collection = db.collection("movies").where("embedding", "!=", null)
  const vectorQuery = collection.findNearest({
    vectorField: "embedding",
    queryVector: embedding,
    limit: limit,
    distanceThreshold: threshold,
    distanceResultField: "vector_distance",
    distanceMeasure: distance, // 'EUCLIDEAN' | 'COSINE' | 'DOT_PRODUCT'
  })

  const explainResult = await vectorQuery.query.explain({analyze: true})
  console.log(`Query explained: ${JSON.stringify(explainResult)}`)

  const snapshot = await vectorQuery.get()
  console.log(`Found ${snapshot.docs.length} matches`)

  const matches = snapshot.docs.map(doc => {
    const data = doc.data()

    return {
      title: data.title,
      genres: data.genres,
      summary: data.summary,
      cast: data.cast,
    }
  })

  response.send(matches)
})

/*exports.onMovieCreated = onDocumentWritten("movies/{id}", async (event) => {
  if (!isEmulator) {
    const movie = event.data.after.data()
    const path = event.document
    console.log(`Movie updated: ${path} data: ${JSON.stringify(movie)}`)

    if (!movie.embedding) {
      console.log(`Calculating embedding for ${path}`)
      const embedding = await movieEmbedding(movie)
      const db = admin.firestore()
      const docRef = db.doc(path)
      const { FieldValue } = require("@google-cloud/firestore")

      await docRef.update({
        embedding: FieldValue.vector(embedding),
      })
      console.log(`Embeddings updated for ${path}`)
    } else {
      console.log(`Movie already had embedding ${path}`)
    }
  }
})*/

// https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#generative-ai-get-text-embedding-nodejs
// https://console.cloud.google.com/apis/api/aiplatform.googleapis.com/cost?inv=1&invt=AboQqA&project=max-prototypes
const calculateEmbedding = async (text) => {
  if (!isEmulator) {
    try {
      const aiplatform = require("@google-cloud/aiplatform")
      const { PredictionServiceClient } = aiplatform.v1
      const { helpers } = aiplatform
      const instances = [helpers.toValue({
        content: text,
        task_type: "SEMANTIC_SIMILARITY",
      })]
      const parameters = helpers.toValue({})
      const request = {
        endpoint: "projects/max-prototypes/locations/us-central1/publishers/google/models/text-embedding-005",
        instances: instances,
        parameters: parameters,
      }
      const clientOptions = { apiEndpoint: "us-central1-aiplatform.googleapis.com" }
      const client = new PredictionServiceClient(clientOptions)
      const [response] = await client.predict(request)
      const embeddings = response.predictions.map(p => {
        const embeddingsProto = p.structValue.fields.embeddings
        const valuesProto = embeddingsProto.structValue.fields.values
        return valuesProto.listValue.values.map(v => v.numberValue)
      })

      return embeddings[0]
    } catch (error) {
      console.error(`Error calculating embeddings: ${error}`)
      return undefined
    }
  } else {
    return [0.1, 0.2, 0.3, 0.4, 0.5]
  }
}