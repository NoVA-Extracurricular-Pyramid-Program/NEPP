// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDVzvRC9lwlJGRLzsj1S-o-Y-b1DtmD9TQ",
  authDomain: "nepp-82074.firebaseapp.com",
  projectId: "nepp-82074",
  storageBucket: "nepp-82074.firebasestorage.app",
  messagingSenderId: "390060926966",
  appId: "1:390060926966:web:dd7a95fc553a86bdd2c9d7",
  measurementId: "G-QSFQKZDETN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { app, analytics, auth }; 