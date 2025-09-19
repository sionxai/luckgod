import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiWYAFsDFivmWBoJzbziWN9jAZt9gME-U",
  authDomain: "gacha-870fa.firebaseapp.com",
  projectId: "gacha-870fa",
  storageBucket: "gacha-870fa.firebasestorage.app",
  messagingSenderId: "464289315548",
  appId: "1:464289315548:web:ed4d78970c7d4298b09219",
  databaseURL: "https://gacha-870fa-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export {
  app,
  auth,
  db,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  ref,
  get,
  set,
  update,
  onValue
};
