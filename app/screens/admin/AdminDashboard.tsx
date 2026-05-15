import { db, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import {
  aggregateStats,
  getDayKeys,
  getStatsForDays,
} from "../../services/stats.service";
import { Sector } from "../../types/order.types";
import { DayStats } from "../../types/stats.types";

const TEAL = "#0E7C86";
const { width: SW } = Dimensions.get("window");

interface Props { placeId: string; onMenuPress?: () => void }
type Period = "today" | "week" | "month";

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function pctDiff(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ mini components Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function MiniBar({ value, max, color = TEAL }: { value: number; max: number; color?: string }) {
  const { darkMode } = useTheme();
  const pct = max > 0 ? Math.max(value / max, 0.02) : 0;
  return (
    <View style={{ height: 5, backgroundColor: darkMode ? "#374151" : "#f0f0f0", borderRadius: 3, marginTop: 4 }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function DiffBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: up ? "#dcfce7" : "#fee2e2", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={11} color={up ? "#16a34a" : "#dc2626"} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: up ? "#16a34a" : "#dc2626" }}>
        {up ? "+" : ""}{pct}%
      </Text>
    </View>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  const { darkMode } = useTheme();
  return (
    <View style={{ marginTop: 20, marginBottom: 8, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Text style={[styles.sectionTitle, { color: darkMode ? "#9CA3AF" : "#888" }]}>{title}</Text>
      {sub ? <Text style={{ fontSize: 11, color: darkMode ? "#6B7280" : "#aaa" }}>{sub}</Text> : null}
    </View>
  );
}

function EmptyCard({ label }: { label: string }) {
  const { darkMode } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: darkMode ? "#1F2937" : "#fff", borderColor: darkMode ? "#374151" : "#eee", alignItems: "center", paddingVertical: 24 }]}>
      <Text style={{ color: darkMode ? "#4B5563" : "#ccc", fontSize: 13 }}>{label}</Text>
    </View>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ HOURLY HEATMAP Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function HourlyHeatmap({ data }: { data: Record<string, number> }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const labelColor = darkMode ? "#6B7280" : "#aaa";
  const max = Math.max(...Object.values(data).map(Number), 1);
  const cellW = Math.floor((SW - 64) / 24) - 2;
  return (
    <View style={[styles.card, { backgroundColor: darkMode ? "#1F2937" : "#fff", borderColor: darkMode ? "#374151" : "#eee" }]}>
      <View style={{ flexDirection: "row", gap: 3, flexWrap: "nowrap", justifyContent: "center" }}>
        {Array.from({ length: 24 }, (_, h) => {
          const count = Number(data[h.toString()] ?? 0);
          const alpha = max > 0 ? 0.08 + (count / max) * 0.9 : 0.05;
          return (
            <View key={h} style={{ alignItems: "center", width: cellW, paddingVertical: 5 }}>
              <View style={{ width: cellW, height: 42, backgroundColor: `rgba(14,124,134,${alpha.toFixed(2)})`, borderRadius: 3 }} />
              <Text style={{ fontSize: 7, color: labelColor, marginTop: 2 }}>{h}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ TREND CHART (per day) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function TrendChart({ daily }: { daily: DayStats[] }) {
  const { darkMode, primaryColor } = useTheme();
  if (daily.length < 2) return null;
  const max = Math.max(...daily.map(d => d.revenue ?? 0), 1);
  const barW = Math.floor((SW - 64) / daily.length) - 3;
  const ordered = [...daily].reverse();
  return (
    <View style={[styles.card, { backgroundColor: darkMode ? "#1F2937" : "#fff", borderColor: darkMode ? "#374151" : "#eee" }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 64 }}>
        {ordered.map(d => {
          const h = Math.max((d.revenue / max) * 60, 3);
          const label = d.dayKey.slice(5);
          return (
            <View key={d.dayKey} style={{ alignItems: "center", width: barW }}>
              <View style={{ width: barW, height: h, backgroundColor: primaryColor, borderRadius: 3, opacity: 0.85 }} />
              {ordered.length <= 14 && (
                <Text style={{ fontSize: 7, color: darkMode ? "#6B7280" : "#aaa", marginTop: 2 }}>{label}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â MAIN Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
export default function AdminDashboard({ placeId, onMenuPress }: Props) {
  const { darkMode, primaryColor } = useTheme();
  const { t } = useTranslation();

  const D = darkMode ? {
    root: "#111827",
    header: "#1F2937",
    headerBorder: "#374151",
    headerTitle: "#F9FAFB",
    hamburgerBox: "#374151",
    periodRow: "#1F2937",
    periodBorder: "#374151",
    periodText: "#9CA3AF",
    periodBtnBorder: "#4B5563",
    card: "#1F2937",
    cardBorder: "#374151",
    rowBorder: "#374151",
    rowName: "#E5E7EB",
    rank: "#6B7280",
    sub: "#6B7280",
    kpiCard: "#1F2937",
    kpiCardBorder: "#374151",
    kpiLabel: "#6B7280",
    analyticsText: "#9CA3AF",
    emptyIcon: "#374151",
    emptyTitle: "#6B7280",
    emptySubtitle: "#4B5563",
  } : {
    root: "#f4f5f7",
    header: "#fff",
    headerBorder: "#F0F0F0",
    headerTitle: "#18181B",
    hamburgerBox: "#F0FDFA",
    periodRow: "#fff",
    periodBorder: "#eee",
    periodText: "#666",
    periodBtnBorder: "#ddd",
    card: "#fff",
    cardBorder: "#eee",
    rowBorder: "#f5f5f5",
    rowName: "#222",
    rank: "#ccc",
    sub: "#aaa",
    kpiCard: "#fff",
    kpiCardBorder: "#eee",
    kpiLabel: "#aaa",
    analyticsText: "#555",
    emptyIcon: "#ddd",
    emptyTitle: "#bbb",
    emptySubtitle: "#ccc",
  };

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const [period, setPeriod] = useState<Period>("today");
  const [stats, setStats] = useState<DayStats | null>(null);
  const [prevStats, setPrevStats] = useState<DayStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [placeName, setPlaceName] = useState("");

  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (d.exists()) {
        setSectors((d.data().sectors as Sector[]) ?? []);
        setPlaceName(d.data().name ?? "");
      }
    });
    return unsub;
  }, [placeId]);

  const load = useCallback(async () => {
    if (!placeId) return;
    setLoading(true);
    try {
      const days = period === "today" ? 1 : period === "week" ? 7 : 30;
      const keys = getDayKeys(days);
      const prevKeys = getDayKeys(days, days); // same window shifted back

      const [curr, prev, daily] = await Promise.all([
        getStatsForDays(placeId, keys),
        getStatsForDays(placeId, prevKeys),
        Promise.resolve([] as DayStats[]), // already in curr
      ]);

      const allDaily = await getStatsForDays(placeId, keys);
      setDailyStats(allDaily);
      setStats(aggregateStats(curr));
      setPrevStats(aggregateStats(prev));
    } finally {
      setLoading(false);
    }
  }, [placeId, period]);

  useEffect(() => { load(); }, [load]);

  const sectorMap = useMemo(
    () => Object.fromEntries(sectors.map(s => [s.id, s.name])),
    [sectors]
  );

  if (!stats && loading) {
    return <ActivityIndicator style={{ flex: 1, marginTop: 80 }} color={primaryColor} size="large" />;
  }

  const avgCompletion = stats && stats.completedForAvg > 0
    ? fmtMs(stats.totalCompletionMs / stats.completedForAvg)
    : null;
  const cancellationRate = stats && (stats.ordersCount + stats.cancelledCount) > 0
    ? ((stats.cancelledCount / (stats.ordersCount + stats.cancelledCount)) * 100).toFixed(1)
    : null;

  const revDiff = stats && prevStats ? pctDiff(stats.revenue, prevStats.revenue) : null;
  const ordersDiff = stats && prevStats ? pctDiff(stats.ordersCount, prevStats.ordersCount) : null;

  const topItems = stats ? Object.entries(stats.itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10) : [];
  const topCategories = stats ? Object.entries(stats.categoryRevenue).sort((a, b) => b[1] - a[1]) : [];
  const topWaiters = stats ? Object.entries(stats.waiterRevenue).sort((a, b) => b[1] - a[1]) : [];
  const topRegions = stats ? Object.entries(stats.regionRevenue).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const sectorEntries = stats ? Object.entries(stats.sectorOrderCount).sort((a, b) => b[1] - a[1]) : [];

  const maxItem = topItems[0]?.[1] ?? 1;
  const maxCat = topCategories[0]?.[1] ?? 1;
  const maxWaiter = topWaiters[0]?.[1] ?? 1;
  const maxRegion = topRegions[0]?.[1] ?? 1;

  const periodLabel = period === "today" ? t("admin.periodYesterday") : period === "week" ? t("admin.periodWeek") : t("admin.periodMonth");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: D.root }}>
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ HEADER Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <View style={[styles.header, { backgroundColor: D.header, borderBottomColor: D.headerBorder }]}>
        <Pressable onPress={onMenuPress} hitSlop={12} style={styles.headerHamburger}>
          <View style={[styles.hamburgerBox, { backgroundColor: D.hamburgerBox }]}>
            <Ionicons name="menu" size={20} color={primaryColor} />
          </View>
        </Pressable>
        <Text style={[styles.headerTitle, { color: D.headerTitle }]} numberOfLines={1}>{placeName || "Dashboard"}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ PERIOD TABS Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <View style={[styles.periodRow, { backgroundColor: D.periodRow, borderColor: D.periodBorder }]}>
        {(["today", "week", "month"] as Period[]).map(p => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.periodBtn, { borderColor: period === p ? primaryColor : D.periodBtnBorder }, period === p && styles.periodBtnActive]}>
            <Text style={[styles.periodText, { color: period === p ? "#fff" : D.periodText }]}>
              {p === "today" ? t("admin.today") : p === "week" ? t("admin.week") : t("admin.month")}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={primaryColor} />
        </Pressable>
      </View>

      {loading && <ActivityIndicator style={{ position: "absolute", top: 120, alignSelf: "center" }} color={primaryColor} />}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ KPI CARDS Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: D.kpiCard, borderColor: D.kpiCardBorder }]}>
            <Text style={[styles.kpiValue, { color: primaryColor }]}>{stats?.ordersCount ?? 0}</Text>
            <Text style={[styles.kpiLabel, { color: D.kpiLabel }]}>{t("admin.ordersCount")}</Text>
            {ordersDiff !== null && <View style={{ marginTop: 4 }}><DiffBadge pct={ordersDiff} /></View>}
          </View>
          <View style={[styles.kpiCard, { backgroundColor: D.kpiCard, borderColor: D.kpiCardBorder }]}>
            <Text style={[styles.kpiValue, { color: primaryColor }]}>
              {stats && stats.ordersCount > 0 ? (stats.revenue / stats.ordersCount).toFixed(2) : "—"}
            </Text>
            <Text style={[styles.kpiLabel, { color: D.kpiLabel }]}>{t("admin.avgKm")}</Text>
          </View>
          {avgCompletion && (
            <View style={[styles.kpiCard, { backgroundColor: D.kpiCard, borderColor: D.kpiCardBorder }]}>
              <Text style={[styles.kpiValue, { color: primaryColor, fontSize: 16 }]}>{avgCompletion}</Text>
              <Text style={[styles.kpiLabel, { color: D.kpiLabel }]}>{t("admin.avgTime")}</Text>
            </View>
          )}
        </View>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: primaryColor }]}>
            <Text style={[styles.kpiValue, { color: "#fff" }]}>{(stats?.revenue ?? 0).toFixed(2)}</Text>
            <Text style={[styles.kpiLabel, { color: "rgba(255,255,255,0.7)" }]}>{t("admin.revenue")}</Text>
            {revDiff !== null && <View style={{ marginTop: 4 }}><DiffBadge pct={revDiff} /></View>}
          </View>
          {cancellationRate !== null && Number(cancellationRate) > 0 && (
            <View style={[styles.kpiCard, { backgroundColor: D.kpiCard, borderColor: darkMode ? "#7F1D1D" : "#fee2e2" }]}>
              <Text style={[styles.kpiValue, { color: "#ef4444" }]}>{cancellationRate}%</Text>
              <Text style={[styles.kpiLabel, { color: D.kpiLabel }]}>{t("admin.cancelled")}</Text>
            </View>
          )}
          {stats?.cancelledCount ? (
            <View style={[styles.kpiCard, { backgroundColor: D.kpiCard, borderColor: darkMode ? "#78350F" : "#fef9c3" }]}>
              <Text style={[styles.kpiValue, { color: "#ca8a04", fontSize: 18 }]}>{stats.cancelledCount}</Text>
              <Text style={[styles.kpiLabel, { color: D.kpiLabel }]}>{t("admin.cancelledOrders")}</Text>
            </View>
          ) : null}
        </View>

        {revDiff !== null && (
          <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: D.card, borderColor: D.cardBorder }]}>
            <Ionicons name="analytics-outline" size={18} color={primaryColor} />
            <Text style={{ fontSize: 12, color: D.analyticsText, flex: 1 }}>
              Prihod {revDiff !== null && revDiff >= 0 ? t("admin.revenueUp") : t("admin.revenueDown")} za{" "}
              <Text style={{ fontWeight: "700" }}>{Math.abs(revDiff ?? 0)}%</Text> u odnosu na {periodLabel}
            </Text>
          </View>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ TREND Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {period !== "today" && dailyStats.length > 0 && (
          <>
            <SectionTitle title={t("admin.trendRevenue")} sub={t("admin.trendDays", { n: dailyStats.length })} />
            <TrendChart daily={dailyStats} />
          </>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ HOURLY HEATMAP Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <SectionTitle title={t("admin.hourlyBusy")} />
        {stats && Object.keys(stats.hourlyOrderCount).length > 0
          ? <HourlyHeatmap data={stats.hourlyOrderCount} />
          : <EmptyCard label={t("admin.noDataPeriod")} />
        }

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ TOP ITEMS Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <SectionTitle title={t("admin.topItems")} sub={t("admin.byQuantity")} />
        {topItems.length > 0 ? (
          <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
            {topItems.map(([name, qty], i) => (
              <View key={name} style={[styles.row, i < topItems.length - 1 && { borderBottomWidth: 1, borderColor: D.rowBorder }]}>
                <Text style={[styles.rank, { color: D.rank }]}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.rowName, { color: D.rowName }]} numberOfLines={1}>{name}</Text>
                    <Text style={styles.rowVal}>{qty}×</Text>
                  </View>
                  <MiniBar value={qty} max={maxItem} />
                </View>
              </View>
            ))}
          </View>
        ) : <EmptyCard label={t("admin.noSoldItems")} />}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ KATEGORIJE Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <SectionTitle title={t("admin.categoryRevenue")} />
        {topCategories.length > 0 ? (
          <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
            {topCategories.map(([cat, rev], i) => {
              const count = stats?.categoryOrderCount?.[cat] ?? 0;
              return (
                <View key={cat} style={[styles.row, i < topCategories.length - 1 && { borderBottomWidth: 1, borderColor: D.rowBorder }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.rowName, { color: D.rowName }]}>{cat}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.rowVal}>{rev.toFixed(2)} KM</Text>
                        <Text style={{ fontSize: 10, color: D.sub }}>{count} {t("admin.kom")}</Text>
                      </View>
                    </View>
                    <MiniBar value={rev} max={maxCat} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyCard label={t("admin.noData")} />}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ KONOBARI Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <SectionTitle title={t("admin.waiters")} sub={t("admin.rankList")} />
        {topWaiters.length > 0 ? (
          <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
            {topWaiters.map(([name, rev], i) => {
              const orders = stats?.waiterOrderCount?.[name] ?? 0;
              const totalMs = stats?.waiterTotalCompletionMs?.[name] ?? 0;
              const avgMs = orders > 0 ? totalMs / orders : 0;
              const avgVal = orders > 0 ? (rev / orders).toFixed(2) : "—";
              return (
                <View key={name} style={[styles.row, i < topWaiters.length - 1 && { borderBottomWidth: 1, borderColor: D.rowBorder }]}>
                  <Text style={[styles.rank, { color: D.rank }]}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.rowName, { color: D.rowName }]}>{name}</Text>
                      <Text style={[styles.rowVal, { fontSize: 15 }]}>{rev.toFixed(2)} KM</Text>
                    </View>
                    <MiniBar value={rev} max={maxWaiter} />
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                      <Text style={[styles.sub, { color: D.sub }]}>{t("admin.ordersNum", { n: orders })}</Text>
                      <Text style={[styles.sub, { color: D.sub }]}>{t("admin.avgKmVal", { val: avgVal })}</Text>
                      {avgMs > 0 && <Text style={[styles.sub, { color: D.sub }]}>≈ {fmtMs(avgMs)}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyCard label={t("admin.noData")} />}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ ZONE / REGIJE Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {topRegions.length > 0 && (
          <>
            <SectionTitle title={t("admin.zoneRevenue")} sub={t("admin.byRevenue")} />
            <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
              {topRegions.map(([region, rev], i) => {
                const count = stats?.regionOrderCount?.[region] ?? 0;
                return (
                  <View key={region} style={[styles.row, i < topRegions.length - 1 && { borderBottomWidth: 1, borderColor: D.rowBorder }]}>
                    <Ionicons name="location-outline" size={14} color={D.sub} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.rowName, { color: D.rowName }]}>{region}</Text>
                        <Text style={styles.rowVal}>{rev.toFixed(2)} KM</Text>
                      </View>
                      <MiniBar value={rev} max={maxRegion} />
                      <Text style={[styles.sub, { color: D.sub }]}>{t("admin.ordersNum", { n: count })}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ SEKTORI Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {sectorEntries.length > 0 && (
          <>
            <SectionTitle title={t("admin.sectorActivity")} sub={t("admin.avgTime")} />
            <View style={[styles.card, { backgroundColor: D.card, borderColor: D.cardBorder }]}>
              {sectorEntries.map(([sectorId, count], i) => {
                const totalMs = stats?.sectorTotalCompletionMs?.[sectorId] ?? 0;
                const completed = stats?.sectorCompletedCount?.[sectorId] ?? 0;
                const avgMs = completed > 0 ? totalMs / completed : 0;
                const name = sectorMap[sectorId] ?? sectorId;
                return (
                  <View key={sectorId} style={[styles.row, i < sectorEntries.length - 1 && { borderBottomWidth: 1, borderColor: D.rowBorder }]}>
                    <Ionicons name="storefront-outline" size={15} color={D.sub} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.rowName, { color: D.rowName }]}>{name}</Text>
                        {avgMs > 0 && (
                          <Text style={[styles.rowVal, { color: avgMs > 5 * 60_000 ? "#ef4444" : primaryColor }]}>
                            ≈ {fmtMs(avgMs)}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.sub, { color: D.sub }]}>{t("admin.ordersNum", { n: count })} obrađeno</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {!stats?.ordersCount && !loading && (
          <View style={{ alignItems: "center", marginTop: 32 }}>
            <Ionicons name="bar-chart-outline" size={48} color={D.emptyIcon} />
            <Text style={{ color: D.emptyTitle, marginTop: 8, fontSize: 14 }}>{t("admin.noDataPeriod")}</Text>
            <Text style={{ color: D.emptySubtitle, fontSize: 12, marginTop: 4 }}>{t("admin.statsAutoFill") ?? "Statistics fill automatically as orders are completed"}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ STYLES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const makeStyles = (p: string) => StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
  },
  headerHamburger: { padding: 6 },
  hamburgerBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F0FDFA",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, textAlign: "center",
    fontSize: 16, fontWeight: "700", color: "#18181B", letterSpacing: -0.3,
  },
  periodRow: {
    flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff",
    borderBottomWidth: 1, borderColor: "#eee", alignItems: "center",
  },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd",
  },
  periodBtnActive: { backgroundColor: p, borderColor: p },
  periodText: { fontSize: 13, fontWeight: "600", color: "#666" },
  periodTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: "auto", padding: 6 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, alignItems: "center",
    borderWidth: 1.5, borderColor: "#eee",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  kpiValue: { fontSize: 20, fontWeight: "800", color: p },
  kpiLabel: { fontSize: 11, color: "#aaa", marginTop: 3, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: "#888", textTransform: "uppercase", letterSpacing: 0.6 },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#eee", marginBottom: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "flex-start", padding: 13, gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderColor: "#f5f5f5" },
  rank: { fontSize: 12, fontWeight: "700", color: "#ccc", width: 22, paddingTop: 1 },
  rowName: { fontSize: 13, fontWeight: "600", color: "#222", flex: 1, marginRight: 8 },
  rowVal: { fontSize: 14, fontWeight: "700", color: p },
  sub: { fontSize: 11, color: "#aaa", marginTop: 2 },
});
const styles = makeStyles("#0E7C86");
