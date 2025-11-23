
import firebase from "firebase/compat/app";
import "firebase/compat/database";

// ---------------------------------------------------------------------------
// 🟢 นำค่าจาก Firebase Console มาใส่ตรงนี้
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDNxYpvawwkGPuP99QZ3eTiOtBBFPjaAHQ",
  authDomain: "onet-school-game.firebaseapp.com",
  databaseURL: "https://onet-school-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "onet-school-game",
  storageBucket: "onet-school-game.firebasestorage.app",
  messagingSenderId: "38156225800",
  appId: "1:38156225800:web:3903d1e0b8ca23ef0c30bd",
};

// เริ่มต้นระบบแบบ Compat
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
export const db = app.database();
export { firebase };
