import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js'
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js'

const firebaseConfig = {
  authDomain: 'max-prototypes.firebaseapp.com',
  projectId: 'max-prototypes',
  storageBucket: 'max-prototypes.firebasestorage.app',
  messagingSenderId: '203891364336',
  appId: '1:203891364336:web:017e3e9d11eb7391648d35',
  measurementId: 'G-SKNV1XY6RN'
};

const app = initializeApp(firebaseConfig)
const firestore = getFirestore(app)

getProducts(onProducts)

function onProducts(products) {
  console.log(products.length)
}

function productCollection() {
  return collection(firestore, 'movies')
}

function productDocument(product) {
  return doc(firestore, 'movies', product.id)
}

export function getProducts(callback) {
  const queryRequest = query(productCollection(), where("embedding", "!=", null))

  return onSnapshot(queryRequest, (snapshot) => {
    const products = []

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const movie = {
        name: data.title,
        genres: data.genres,
        summary: data.summary,
        cast: data.cast,
      }
      products.push(movie)
      console.log(movie)
    }

    callback(products)
  })
}