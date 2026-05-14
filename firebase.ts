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


export const col = (name: string) =>
    __DEV__ ? `${name}_dev` : name

// Multi-tenant path helpers
export const placesRoot = () =>
    __DEV__ ? "dev_places" : "places"

export const ordersPath = (placeId: string) =>
    `${placesRoot()}/${placeId}/orders`

export const menuPath = (placeId: string) =>
    `${placesRoot()}/${placeId}/menu`