import { auth, db, placesRoot } from "@/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { LocationMode, Place } from "../types/order.types";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueJoinCode(): Promise<string> {
  while (true) {
    const code = generateJoinCode();
    const snap = await getDocs(
      query(collection(db, placesRoot()), where("joinCode", "==", code))
    );
    if (snap.empty) return code;
  }
}

export async function createPlace(name: string): Promise<Place> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");

  const joinCode = await generateUniqueJoinCode();

  const defaultSector = { id: `sector_${Date.now()}`, name: "Šank", icon: "wine-outline" };

  const ref = await addDoc(collection(db, placesRoot()), {
    name,
    ownerId: uid,
    joinCode,
    menuVersion: 0,
    locationMode: "zones" as LocationMode,
    zones: [],
    tableCount: 0,
    sectors: [defaultSector],
    createdAt: Date.now(),
  });

  await setDoc(doc(db, "users", uid), {
    placeId: ref.id,
    role: "admin",
    createdAt: Date.now(),
  });

  return {
    id: ref.id,
    name,
    ownerId: uid,
    joinCode,
    menuVersion: 0,
    locationMode: "zones" as LocationMode,
    zones: [],
    tableCount: 0,
    sectors: [defaultSector],
    createdAt: Date.now(),
  };
}

export async function getAdminPlace(uid: string): Promise<Place | null> {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) return null;

  const placeId = userDoc.data().placeId;
  if (!placeId) return null;

  const placeDoc = await getDoc(doc(db, placesRoot(), placeId));
  if (!placeDoc.exists()) return null;

  return { id: placeDoc.id, ...(placeDoc.data() as Omit<Place, "id">) };
}

export async function getPlaceByJoinCode(joinCode: string): Promise<Place | null> {
  const q = query(
    collection(db, placesRoot()),
    where("joinCode", "==", joinCode.toUpperCase().trim())
  );
  const snap = await getDocsFromServer(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Place, "id">) };
}

export async function getPlaceById(placeId: string): Promise<Place | null> {
  const placeDoc = await getDoc(doc(db, placesRoot(), placeId));
  if (!placeDoc.exists()) return null;
  return { id: placeDoc.id, ...(placeDoc.data() as Omit<Place, "id">) };
}

export async function incrementMenuVersion(placeId: string): Promise<void> {
  await updateDoc(doc(db, placesRoot(), placeId), { menuVersion: increment(1) });
}

export async function updatePlaceZones(placeId: string, zones: string[]): Promise<void> {
  await updateDoc(doc(db, placesRoot(), placeId), { zones });
}

export async function updateLocationSettings(
  placeId: string,
  settings: { locationMode: LocationMode; zones: string[]; tableCount: number }
): Promise<void> {
  await updateDoc(doc(db, placesRoot(), placeId), settings);
}

export async function updateSectors(
  placeId: string,
  sectors: import("../types/order.types").Sector[]
): Promise<void> {
  await updateDoc(doc(db, placesRoot(), placeId), { sectors });
}
