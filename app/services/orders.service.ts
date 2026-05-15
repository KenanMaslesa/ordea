import { db, ordersPath } from "@/firebase"
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore"
import { Order, OrderCreateInput, OrderItem } from "../types/order.types"

export type OrdersListener = (
  orders: Order[],
  changes: {
    type: "added" | "modified" | "removed"
    order: Order
  }[]
) => void

export function listenOrders(placeId: string, cb: OrdersListener) {
  const q = query(
    collection(db, ordersPath(placeId)),
    where("status", "==", "pending")
  )
  return onSnapshot(q, snap => {
    const orders: Order[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Order, "id">),
    }))

    const changes = snap.docChanges().map(c => ({
      type: c.type,
      order: {
        id: c.doc.id,
        ...(c.doc.data() as Omit<Order, "id">),
      },
    }))

    cb(orders, changes)
  })
}

export async function markOrderDone(placeId: string, orderId: string) {
  await updateDoc(doc(db, ordersPath(placeId), orderId), {
    status: "done",
    finishedAt: Date.now(),
  })
}

/**
 * Marks one sector as done for an order.
 * If ALL sectors that appear in orderItems are done, sets status="done".
 * Pass currentSectorStatus from client to avoid an extra getDoc read.
 */
export async function markSectorDone(
  placeId: string,
  orderId: string,
  sectorId: string,
  orderItems: OrderItem[],
  currentSectorStatus?: Record<string, string>
) {
  const ref = doc(db, ordersPath(placeId), orderId)
  const now = Date.now()

  const uniqueSectorIds = [...new Set(orderItems.map(i => i.sectorId).filter(Boolean))]

  // Optimistically merge the new done sector into the known status
  const mergedStatus: Record<string, string> = { ...(currentSectorStatus ?? {}), [sectorId]: "done" }
  const allDone = uniqueSectorIds.length > 0 && uniqueSectorIds.every(id => mergedStatus[id] === "done")

  if (allDone) {
    // Single write: mark sector done + order done
    await updateDoc(ref, {
      [`sectorStatus.${sectorId}`]: "done",
      [`sectorFinishedAt.${sectorId}`]: now,
      status: "done",
      finishedAt: now,
    })
  } else {
    // Just mark the sector
    await updateDoc(ref, {
      [`sectorStatus.${sectorId}`]: "done",
      [`sectorFinishedAt.${sectorId}`]: now,
    })
  }
}

export async function cancelOrder(placeId: string, orderId: string, cancelledBy: string) {
  await updateDoc(doc(db, ordersPath(placeId), orderId), {
    status: "cancelled",
    cancelledAt: Date.now(),
    cancelledBy,
  })
}

export async function createOrder(placeId: string, input: OrderCreateInput) {
  await addDoc(collection(db, ordersPath(placeId)), input)
}

export function listenMyOrders(
  placeId: string,
  waiterId: string,
  cb: (orders: Order[]) => void
) {
  const last25h = Date.now() - 25 * 60 * 60 * 1000

  const toOrder = (d: any): Order => ({
    id: d.id,
    ...(d.data() as Omit<Order, "id">),
    orderNote: d.data().orderNote ?? null,
    finishedAt: d.data().finishedAt ?? null,
  })

  let pendingOrders: Order[] = []
  let doneOrders: Order[] = []
  const emit = () => cb([...pendingOrders, ...doneOrders])

  const qPending = query(
    collection(db, ordersPath(placeId)),
    where("waiterId", "==", waiterId),
    where("status", "==", "pending")
  )
  const qDone = query(
    collection(db, ordersPath(placeId)),
    where("waiterId", "==", waiterId),
    where("status", "==", "done"),
    where("finishedAt", ">=", last25h)
  )

  const unsubPending = onSnapshot(qPending, snap => {
    pendingOrders = snap.docs.map(toOrder)
    emit()
  })
  const unsubDone = onSnapshot(qDone, snap => {
    doneOrders = snap.docs.map(toOrder)
    emit()
  })

  return () => { unsubPending(); unsubDone() }
}

export async function deleteOrder(placeId: string, orderId: string) {
  await deleteDoc(doc(db, ordersPath(placeId), orderId))
}

export async function deleteAllDoneOrders(
  placeId: string,
  orders: Order[],
  waiterId: string
) {
  const done = orders.filter(
    o => o.waiterId === waiterId && o.status === "done"
  )
  await Promise.all(done.map(o => deleteOrder(placeId, o.id)))
}

const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 sata

export async function cleanupOldDoneOrders(placeId: string) {
  if (!placeId) return
  const cutoff = Date.now() - CLEANUP_THRESHOLD_MS
  const q = query(
    collection(db, ordersPath(placeId)),
    where("status", "==", "done"),
    where("finishedAt", "<=", cutoff)
  )
  const snap = await getDocs(q)
  if (snap.empty) return
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
}