const admin = require("firebase-admin")
const { setGlobalOptions } = require("firebase-functions/v2")
const { onRequest } = require("firebase-functions/v2/https")
//const { onDocumentWritten, } = require("firebase-functions/v2/firestore")

admin.initializeApp()

setGlobalOptions({
  memory: "1GiB",
  timeoutSeconds: 530,
})

const isEmulator = process.env.FIREBASE_EMULATOR_HUB ? true : false
const recomputeLength = isEmulator ? 3 : 400

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

  console.log(`Imported ${count} movies`)
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
  const { FieldValue } = require("@google-cloud/firestore")

  for (const doc of snapshot.docs) {
    const movie = doc.data()
    const embedding = await movieEmbedding(doc.id, movie)

    if (embedding) {
      batch.update(doc.ref, {
        embedding: FieldValue.vector(embedding),
        hasEmbedding: true,
      })
    } else {
      console.log(`Error calculating embedding for ${movie.id}`)
    }
  }

  const writes = await batch.commit()
  console.log(`Updated ${writes.length} movies`)

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

exports.search = onRequest({ cors: true }, async (request, response) => {
  const query = request.query.query.toString().toLowerCase()
  const distance = request.query.distance.toString().toUpperCase()
  const threshold = parseFloat(request.query.threshold)
  const limit = parseInt(request.query.limit)
  console.log(`Query "${query}" using distance "${distance} and threshold of "${threshold}" limited to "${limit}"`)

  console.log(`Calculating embedding for query "${query}"`)
  const embedding = await calculateEmbedding(query)
  console.log(`Calculated embedding of length "${embedding.length}"`)

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

  const snapshot = await vectorQuery.get()
  console.log(`Found ${snapshot.docs.length} matches`)

  const matches = snapshot.docs.map(doc => {
    const data = doc.data()

    return {
      id: doc.id,
      title: data.title,
      genres: data.genres,
      summary: data.summary,
      cast: data.cast,
      vector_distance: data.vector_distance,
    }
  })

  response.send(matches)
})

// https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#generative-ai-get-text-embedding-nodejs
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