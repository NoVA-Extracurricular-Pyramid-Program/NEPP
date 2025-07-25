import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBi1qbmteDz_WwhyHLndlrvyCZE1MICQo8",
  authDomain: "nepp-75d86.firebaseapp.com",
  projectId: "nepp-75d86",
  storageBucket: "nepp-75d86.firebasestorage.app",
  messagingSenderId: "881241080543",
  appId: "1:881241080543:web:3344a88c6f191602905f6a",
  measurementId: "G-JK31WLT6TX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);