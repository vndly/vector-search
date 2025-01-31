import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js'
import {
  getFirestore,
  doc,
  collection,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'

const firebaseConfig = {
  apiKey: 'AIzaSyCI5bs6Lj7jlkLlk9D3m30d0P9_GIytGPo',
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
  for (const product of products) {
    console.log(JSON.stringify(product))
  }
}

function productCollection() {
  return collection(firestore, 'movies')
}

function productDocument(product) {
  return doc(firestore, 'movies', product.id)
}

export function getProducts(callback) {
  return onSnapshot(productCollection(), (snapshot) => {
    const products = []

    for (const doc of snapshot.docs) {
      const data = doc.data()
      /*products.push({
        name: data.title,
        genres: data.genres,
        summary: data.summary,
        cast: data.cast,
      })*/
      products.push(data)
    }

    callback(products)
  })
}