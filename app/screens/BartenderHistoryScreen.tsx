import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";
import { db, ordersPath } from "../../firebase";
import { Order, Sector } from "../types/order.types";
import { AppTheme } from "../types/theme.types";
import OrderCard from "./components/OrderCard";

/* ── PROPS ── */
interface Props {
  placeId: string;
  mySectorIds: string[];
  sectors: Sector[];
  C: AppTheme;
  insets: EdgeInsets;
  onClose: () => void;
}

const HOUR_OPTIONS = [1, 2, 4, 8, 12, 24];

function formatAgo(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/* ================= COMPONENT ================= */

export default function BartenderHistoryScreen({ placeId, mySectorIds, sectors, C, insets, onClose }: Props) {
  const [hoursBack, setHoursBack] = useState(1);
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      if (!placeId) return;
      setLoading(true);
      try {
        const cutoff = Date.now() - hoursBack * 3_600_000;
        const q = query(
          collection(db, ordersPath(placeId)),
          where("status", "==", "done"),
          where("finishedAt", ">=", cutoff)
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setFetchedOrders(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Order, "id">) })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [placeId, hoursBack]);

  const doneOrders = useMemo(() => {
    return fetchedOrders
      .filter(o => {
        if (mySectorIds.length === 0) return true;
        const hasMyItems = o.items.some(i => mySectorIds.includes(i.sectorId ?? ""));
        if (!hasMyItems) return false;
        const relevantSectors = mySectorIds.filter(sid => o.items.some(i => i.sectorId === sid));
        return relevantSectors.every(sid => o.sectorStatus?.[sid] === "done");
      })
      .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));
  }, [fetchedOrders, mySectorIds]);

  const waiters = useMemo(() => {
    const names = new Set(doneOrders.map(o => o.waiterName).filter(Boolean));
    return Array.from(names).sort();
  }, [doneOrders]);

  const filteredOrders = useMemo(
    () => selectedWaiter ? doneOrders.filter(o => o.waiterName === selectedWaiter) : doneOrders,
    [doneOrders, selectedWaiter]
  );

  const handleHoursChange = (h: number) => {
    setHoursBack(h);
    setSelectedWaiter(null);
  };

  const now = Date.now();
  const isDark = C.bg === "#0D0D0F";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={C.bg} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.textMuted} />
        </Pressable>
        <Text style={styles.title}>Historija</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countNum}>{filteredOrders.length}</Text>
          <Text style={styles.countLabel}>završenih</Text>
        </View>
      </View>

      {/* ── HOURS FILTER ── */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Zadnjih:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {HOUR_OPTIONS.map(h => (
            <Pressable
              key={h}
              onPress={() => handleHoursChange(h)}
              style={[styles.chip, hoursBack === h && styles.chipActive]}
            >
              <Text style={[styles.chipText, hoursBack === h && styles.chipTextActive]}>
                {h}h
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── WAITER FILTER ── */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Konobar:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <Pressable
            onPress={() => setSelectedWaiter(null)}
            style={[styles.chip, selectedWaiter === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, selectedWaiter === null && styles.chipTextActive]}>
              Svi
            </Text>
          </Pressable>
          {waiters.map(name => (
            <Pressable
              key={name}
              onPress={() => setSelectedWaiter(name)}
              style={[styles.chip, selectedWaiter === name && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedWaiter === name && styles.chipTextActive]}>
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── LIST ── */}
      {loading ? (
        <ActivityIndicator size="large" color="#0E7C86" style={{ marginTop: 40 }} />
      ) : (
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>Nema završenih</Text>
            <Text style={styles.emptySub}>
              {selectedWaiter ? `za ${selectedWaiter} u zadnjih ${hoursBack}h` : `u zadnjih ${hoursBack}h`}
            </Text>
          </View>
        ) : (
          filteredOrders.map((o, idx) => {
            const relevantSectors = mySectorIds.filter(sid =>
              o.items.some(i => i.sectorId === sid)
            );
            const finishedTs =
              relevantSectors.length > 0
                ? Math.max(...relevantSectors.map(sid => o.sectorFinishedAt?.[sid] ?? 0).filter(Boolean))
                : (o.finishedAt ?? o.createdAt);
            const agoSec = Math.floor((now - finishedTs) / 1000);
            return (
              <OrderCard
                key={o.id}
                order={o}
                index={idx}
                C={C}
                sectors={sectors}
                mySectorIds={mySectorIds}
                timerIcon="checkmark-done-outline"
                timerColor={C.textMuted}
                timerLabel={`prije ${formatAgo(agoSec)}`}
              />
            );
          })
        )}
      </ScrollView>      )}    </View>
  );
}

/* ================= STYLES ================= */

const makeStyles = (C: AppTheme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* ── HEADER ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  title: {
    fontSize: 26, fontWeight: "800", color: C.text,
    letterSpacing: -0.5, flex: 1,
  },
  countBadge: {
    alignItems: "center", backgroundColor: C.surfaceHigh,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 64, borderWidth: 1, borderColor: C.border,
  },
  countNum: { fontSize: 22, fontWeight: "800", color: C.text, lineHeight: 26 },
  countLabel: {
    fontSize: 10, fontWeight: "600", color: C.textMuted,
    letterSpacing: 0.5, textTransform: "uppercase",
  },

  /* ── FILTER ── */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterLabel: { fontSize: 13, color: C.textMuted, fontWeight: "600", flexShrink: 0 },
  filterChips: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: C.border, backgroundColor: C.surfaceHigh,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  chipTextActive: { color: C.white },

  /* ── LIST ── */
  list: { padding: 16, gap: 12 },

  empty: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: C.textSub },
  emptySub: { fontSize: 14, color: C.textMuted, fontWeight: "500" },
});
