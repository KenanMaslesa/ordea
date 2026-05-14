import { useCallback, useEffect, useState } from "react"
import { listenOrders, markOrderDone } from "../services/orders.service"
import { Order } from "../types/order.types"

export function useOrders(placeId: string, onNewPending?: (id: string) => void) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!placeId) return;
    const unsub = listenOrders(placeId, (all, changes) => {
      setOrders(all)

      changes.forEach(c => {
        if (c.type === "added" && c.order.status === "pending") {
          onNewPending?.(c.order.id)
        }
      })
    })

    return () => unsub()
  }, [placeId, onNewPending])

  const pending = orders.filter(o => o.status === "pending")

  const markDone = useCallback(async (orderId: string) => {
    await markOrderDone(placeId, orderId)
  }, [placeId])

  return {
    orders,
    pending,
    markDone,
  }
}
