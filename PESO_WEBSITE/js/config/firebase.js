// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8ojhc91PtCX-emEpIIjzT5SnwNjF86s0",
  authDomain: "lgu-peso.firebaseapp.com",
  projectId: "lgu-peso",
  storageBucket: "lgu-peso.firebasestorage.app",
  messagingSenderId: "936318181249",
  appId: "1:936318181249:web:21ea183d46a3bc11305280",
  measurementId: "G-HMKF5Q0ZEL",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };
