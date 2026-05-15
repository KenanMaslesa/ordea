import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";
import { Order, Sector } from "../types/order.types";
import { AppTheme } from "../types/theme.types";
import OrderCard from "./components/OrderCard";

/* ── PROPS ── */
interface Props {
  orders: Order[];
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

export default function BartenderHistoryScreen({ orders, mySectorIds, sectors, C, insets, onClose }: Props) {
  const [hoursBack, setHoursBack] = useState(1);
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const now = Date.now();
  const styles = useMemo(() => makeStyles(C), [C]);

  const doneOrders = useMemo(() => {
    const cutoff = now - hoursBack * 3_600_000;
    return orders
      .filter(o => {
        if (o.status === "cancelled") return false;
        if (mySectorIds.length === 0) return o.status === "done" && o.createdAt >= cutoff;
        const hasMyItems = o.items.some(i => mySectorIds.includes(i.sectorId ?? ""));
        if (!hasMyItems) return false;
        const relevantSectors = mySectorIds.filter(sid => o.items.some(i => i.sectorId === sid));
        const myDone = relevantSectors.every(sid => o.sectorStatus?.[sid] === "done");
        if (!myDone) return false;
        const finishedTs = Math.max(
          ...relevantSectors.map(sid => o.sectorFinishedAt?.[sid] ?? 0).filter(Boolean)
        );
        return finishedTs >= cutoff;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, mySectorIds, hoursBack, now]);

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
      </ScrollView>
    </View>
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
