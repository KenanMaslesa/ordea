// firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBCvAAkOet9icJBFePXMYfq0klB4pdla7A",
    authDomain: "divan-92f60.firebaseapp.com",
    projectId: "divan-92f60",
    storageBucket: "divan-92f60.firebasestorage.app",
    messagingSenderId: "835691750104",
    appId: "1:835691750104:web:da0b30ab53a4c2fbf5edad"
  }

const app = initializeApp(firebaseConfig);

// Eksportujemo Firestore i Auth da ih koristiš svugdje
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;


// Multi-tenant path helpers
export const placesRoot = () => "places"

export const ordersPath = (placeId: string) =>
    `places/${placeId}/orders`

export const menuPath = (placeId: string) =>
    `places/${placeId}/menu`