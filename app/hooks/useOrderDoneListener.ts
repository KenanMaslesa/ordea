import { Audio } from "expo-av";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

interface Order {
  id: string;
  status: "pending" | "done" | "cancelled";
  sectorStatus?: Record<string, "pending" | "done">;
  sectorNames?: Record<string, string>;
}

const STORAGE_KEY = "notified_done_orders";

export function useOrderDoneListener(orders: Order[]) {
  const prevStatus = useRef<Record<string, "pending" | "done" | "cancelled">>({});
  const prevSectorStatus = useRef<Record<string, Record<string, "pending" | "done">>>({});
  const notifiedIds = useRef<Set<string>>(new Set());
  const notifiedSectors = useRef<Set<string>>(new Set()); // key: `${orderId}:${sectorId}`
  const queue = useRef<string[]>([]);
  const sectorQueue = useRef<string[]>([]); // sector done labels
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // 🔹 Load notified ids from storage (reload safe)
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      notifiedIds.current = new Set(JSON.parse(saved));
    }
  }, []);

  // 🔹 Save notified ids
  const persist = () => {
    if (Platform.OS === "web") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(notifiedIds.current))
      );
    }
  };

  // 🔹 Request permission
  useEffect(() => {
    if (Platform.OS === "web" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // 🔹 MAIN LISTENER
  useEffect(() => {
    orders.forEach(order => {
      const prev = prevStatus.current[order.id];

      const isTransition =
        prev === "pending" &&
        order.status === "done" &&
        !notifiedIds.current.has(order.id);

      if (isTransition) {
        notifiedIds.current.add(order.id);
        queue.current.push(order.id);
      }

      // Per-sector transitions
      if (order.sectorStatus) {
        const prevSec = prevSectorStatus.current[order.id] ?? {};
        Object.entries(order.sectorStatus).forEach(([sid, state]) => {
          const key = `${order.id}:${sid}`;
          if (prevSec[sid] === "pending" && state === "done" && !notifiedSectors.current.has(key) && order.status !== "done") {
            notifiedSectors.current.add(key);
            const label = order.sectorNames?.[sid] ?? sid;
            sectorQueue.current.push(label);
          }
        });
        prevSectorStatus.current[order.id] = { ...order.sectorStatus };
      }

      prevStatus.current[order.id] = order.status;
    });

    persist();

    if (queue.current.length > 0 || sectorQueue.current.length > 0) {
      scheduleNotification();
    }
  }, [orders]);

  // 🔹 Debounce notifier
  const scheduleNotification = () => {
    if (debounceTimer.current) return;

    debounceTimer.current = setTimeout(() => {
      sendGroupedNotification();
      queue.current = [];
      sectorQueue.current = [];
      debounceTimer.current = null;
    }, 1500); // group window
  };

  // 🔹 Send notification
  const sendGroupedNotification = async () => {
    const ids = queue.current;
    const sectors = sectorQueue.current;

    if (ids.length === 0 && sectors.length === 0) return;

    const title =
      ids.length > 0
        ? ids.length === 1
          ? "✅ Narudžba završena"
          : `✅ ${ids.length} narudžbi završeno`
        : `✅ ${sectors.join(", ")} gotovo`;

    const body =
      ids.length > 0
        ? ids.length === 1
          ? `Narudžba #${ids[0]} je gotova`
          : `ID: ${ids.slice(0, 5).join(", ")}`
        : `Sektor(i) gotovi: ${sectors.join(", ")}`;

        // alert(title);

    // 🔊 SOUND (only when app open)
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/waiter.mp3")
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}

    // 🔔 WEB PUSH STYLE NOTIFICATION
    if (Platform.OS === "web" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }
  };

  // cleanup
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);
}