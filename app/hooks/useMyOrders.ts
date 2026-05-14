import { useEffect, useMemo, useState } from "react"
import {
  deleteAllDoneOrders,
  deleteOrder,
  listenMyOrders,
} from "../services/orders.service"
import { Order } from "../types/order.types"

export function useMyOrders(placeId: string, waiterId: string) {
  const [orders, setOrders] = useState<Order[]>([])
  const [timeNow, setTimeNow] = useState(Date.now())

  useEffect(() => {
    if (!placeId || !waiterId) return;
    const unsub = listenMyOrders(placeId, waiterId, setOrders)
    return () => unsub()
  }, [placeId, waiterId])

  useEffect(() => {
    const i = setInterval(() => setTimeNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  const myOrders = useMemo(
    () =>
      orders.sort((a, b) => a.createdAt - b.createdAt),
    [orders]
  )

  const removeOrder = (id: string) => deleteOrder(placeId, id)

  const removeAllDone = () =>
    deleteAllDoneOrders(placeId, orders, waiterId)

  return {
    myOrders,
    timeNow,
    removeOrder,
    removeAllDone,
  }
}
