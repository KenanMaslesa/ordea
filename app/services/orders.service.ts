import { db, ordersPath } from "@/firebase"
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore"
import { Order, OrderCreateInput, OrderItem } from "../types/order.types"

export type OrdersListener = (
  orders: Order[],
  changes: {
    type: "added" | "modified" | "removed"
    order: Order
  }[]
) => void

export function listenOrders(placeId: string, cb: OrdersListener) {
  return onSnapshot(collection(db, ordersPath(placeId)), snap => {
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
 */
export async function markSectorDone(
  placeId: string,
  orderId: string,
  sectorId: string,
  orderItems: OrderItem[]
) {
  const ref = doc(db, ordersPath(placeId), orderId)
  const now = Date.now()

  // 1. Write sector done
  await updateDoc(ref, {
    [`sectorStatus.${sectorId}`]: "done",
    [`sectorFinishedAt.${sectorId}`]: now,
  })

  // 2. Check if all sectors in this order are now done
  const uniqueSectorIds = [...new Set(orderItems.map(i => i.sectorId).filter(Boolean))]
  if (uniqueSectorIds.length === 0) return

  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const currentStatus = (snap.data().sectorStatus ?? {}) as Record<string, string>

  const allDone = uniqueSectorIds.every(id => currentStatus[id] === "done")
  if (allDone) {
    await updateDoc(ref, { status: "done", finishedAt: now })
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
  const q = query(
    collection(db, ordersPath(placeId)),
    where("waiterId", "==", waiterId)
  )

  return onSnapshot(q, snap => {
    const orders: Order[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Order, "id">),
      orderNote: d.data().orderNote ?? null,
      finishedAt: d.data().finishedAt ?? null,
    }))

    cb(orders)
  })
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