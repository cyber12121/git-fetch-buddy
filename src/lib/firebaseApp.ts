import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Single Firebase App instance shared across the whole app. Initializing here
// (and importing this module first) guarantees initializeApp() runs before any
// getAuth()/getFirestore() call made elsewhere — fixing the
// "No Firebase App '[DEFAULT]' has been created" error that happened when
// firestoreSync.ts evaluated its getFirestore() before firebaseAuth.ts had
// initialized the app.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
