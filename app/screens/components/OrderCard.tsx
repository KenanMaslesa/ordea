import { Order } from "@/app/types/order.types"
import { useEffect, useRef } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"

interface OrderCardProps {
  order: Order
  index: number
  isBlink: boolean
  elapsed: string
  onDone: () => void
}

/* ---------- component ---------- */

export function OrderCard({
  order,
  index,
  isBlink,
  elapsed,
  onDone,
}: OrderCardProps) {
  const blinkAnim = useRef<Animated.Value>(
    new Animated.Value(0)
  ).current

  useEffect(() => {
    if (!isBlink) {
      blinkAnim.setValue(0)
      return
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [isBlink, blinkAnim])

  const bg = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#fff", "#b71c1c"],
  })

  const textColor = isBlink ? "#fff" : "#000"

  return (
    <Animated.View style={[styles.card, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.index, { color: textColor }]}>
          #{index + 1}
        </Text>
        <Text style={[styles.waiter, { color: textColor }]}>
          {order.waiterName}
        </Text>
      </View>

      {/* Items */}
      {order.items.map((item, ii) => (
        <View key={ii} style={{ marginBottom: 10 }}>
          <View style={styles.row}>
            <Text style={[styles.item, { color: textColor }]}>
              {item.name}
            </Text>
            <Text style={styles.qty}>× {item.qty}</Text>
          </View>

          {item.note && (
            <View style={styles.note}>
              <Text style={styles.noteText}>⚠️ {item.note}</Text>
            </View>
          )}
        </View>
      ))}

      {/* Order note */}
      {order.orderNote && (
        <View style={styles.orderNote}>
          <Text style={styles.orderNoteText}>
            📝 {order.orderNote}
          </Text>
        </View>
      )}

      <Text style={[styles.time, { color: textColor }]}>
        ⏱ {elapsed}
      </Text>

      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneText}>ZAVRŠI</Text>
      </Pressable>
    </Animated.View>
  )
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 6,
    width: '100%'
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  index: {
    fontSize: 20,
    fontWeight: "900",
  },
  waiter: {
    fontSize: 18,
    fontWeight: "800",
    color: "#28a745",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  item: {
    fontSize: 22,
    fontWeight: "800",
  },
  qty: {
    fontSize: 30,
    color: "#d32f2f",
    fontWeight: "900",
  },
  note: {
    backgroundColor: "#ffe082",
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  noteText: {
    fontSize: 18,
    fontWeight: "700",
  },
  orderNote: {
    backgroundColor: "#bbdefb",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  orderNoteText: {
    fontSize: 18,
    fontWeight: "800",
  },
  time: {
    marginTop: 8,
    fontSize: 18,
  },
  doneBtn: {
    marginTop: 12,
    height: 56,
    backgroundColor: "#28a745",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  doneText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
})
