// test-firestore-write.js
// Run this in your browser console after your app is loaded and user is authenticated
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const db = getFirestore();
const auth = getAuth();
console.log("Current user:", auth.currentUser);
addDoc(collection(db, "testCollection"), { test: true, uid: auth.currentUser?.uid })
  .then(() => console.log("Write succeeded"))
  .catch(e => console.error("Write failed", e));
