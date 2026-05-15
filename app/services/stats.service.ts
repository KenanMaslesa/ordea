import { db } from "@/firebase";
import { doc, getDoc, increment, setDoc, updateDoc } from "firebase/firestore";
import { Order, OrderItem } from "../types/order.types";
import { DayStats, EMPTY_DAY_STATS } from "../types/stats.types";

const statsPath = (placeId: string, dayKey: string) =>
  `places/${placeId}/stats/${dayKey}`;

/** Replace dots/slashes so Firestore doesn't treat them as path separators */
const safeKey = (s: string): string =>
  (s || "unknown").replace(/\./g, ",").replace(/\//g, "|").substring(0, 200);

/** Called on every markSectorDone — tracks per-sector completion time */
export async function recordSectorDone(
  placeId: string,
  dayKey: string,
  sectorId: string,
  completionMs: number
): Promise<void> {
  const ref = doc(db, statsPath(placeId, dayKey));
  const k = safeKey(sectorId);
  // setDoc+merge creates the doc if it doesn't exist (no-op if it does)
  // updateDoc is then required for dot-notation keys to be treated as nested paths
  await setDoc(ref, {}, { merge: true });
  await updateDoc(ref, {
    [`sectorOrderCount.${k}`]: increment(1),
    [`sectorTotalCompletionMs.${k}`]: increment(completionMs),
    [`sectorCompletedCount.${k}`]: increment(1),
  });
}

/** Called once when the whole order becomes done — tracks revenue, items, waiters, etc. */
export async function recordOrderDone(
  placeId: string,
  order: Order,
  finishedAt: number
): Promise<void> {
  const {
    dayKey, waiterName, region, items, totalPrice, createdAt,
  } = order;

  const completionMs = finishedAt - createdAt;
  const hour = new Date(finishedAt).getHours().toString();
  const waiterKey = safeKey(waiterName || "Nepoznat");
  const regionKey = safeKey(region || "Nepoznata");

  const updates: Record<string, any> = {
    revenue: increment(totalPrice),
    ordersCount: increment(1),
    totalCompletionMs: increment(completionMs),
    completedForAvg: increment(1),
    [`waiterRevenue.${waiterKey}`]: increment(totalPrice),
    [`waiterOrderCount.${waiterKey}`]: increment(1),
    [`waiterTotalCompletionMs.${waiterKey}`]: increment(completionMs),
    [`regionRevenue.${regionKey}`]: increment(totalPrice),
    [`regionOrderCount.${regionKey}`]: increment(1),
    [`hourlyOrderCount.${hour}`]: increment(1),
    [`hourlyRevenue.${hour}`]: increment(totalPrice),
  };

  for (const item of items as OrderItem[]) {
    const cat = safeKey(item.category || "Ostalo");
    const itemKey = safeKey(`${item.category || "Ostalo"} - ${item.name}`);
    const itemRev = item.price * item.qty;
    updates[`itemCounts.${itemKey}`] = increment(item.qty);
    updates[`itemRevenue.${itemKey}`] = increment(itemRev);
    updates[`categoryRevenue.${cat}`] = increment(itemRev);
    updates[`categoryOrderCount.${cat}`] = increment(item.qty);
  }

  const ref = doc(db, statsPath(placeId, dayKey));
  // updateDoc correctly interprets dot-notation as nested Firestore map paths.
  // The document is guaranteed to exist (created by recordSectorDone above).
  await updateDoc(ref, updates);
}

/** Called when an order is cancelled */
export async function recordOrderCancelled(
  placeId: string,
  dayKey: string
): Promise<void> {
  const ref = doc(db, statsPath(placeId, dayKey));
  await setDoc(ref, { cancelledCount: increment(1) }, { merge: true });
}

/** Fetch stats for given day keys (parallel) */
export async function getStatsForDays(
  placeId: string,
  dayKeys: string[]
): Promise<DayStats[]> {
  const results = await Promise.all(
    dayKeys.map(async dayKey => {
      const snap = await getDoc(doc(db, statsPath(placeId, dayKey)));
      if (!snap.exists()) return null;
      return { dayKey, ...snap.data() } as DayStats;
    })
  );
  return results.filter(Boolean) as DayStats[];
}

/** Merge an array of DayStats into one aggregated DayStats */
export function aggregateStats(list: DayStats[]): DayStats {
  const agg: DayStats = { dayKey: "", ...structuredClone(EMPTY_DAY_STATS) };

  const mergeRec = (target: Record<string, number>, src: Record<string, number> = {}) => {
    for (const [k, v] of Object.entries(src)) {
      target[k] = (target[k] ?? 0) + (v ?? 0);
    }
  };

  for (const s of list) {
    agg.revenue += s.revenue ?? 0;
    agg.ordersCount += s.ordersCount ?? 0;
    agg.cancelledCount += s.cancelledCount ?? 0;
    agg.totalCompletionMs += s.totalCompletionMs ?? 0;
    agg.completedForAvg += s.completedForAvg ?? 0;
    mergeRec(agg.waiterRevenue, s.waiterRevenue);
    mergeRec(agg.waiterOrderCount, s.waiterOrderCount);
    mergeRec(agg.waiterTotalCompletionMs, s.waiterTotalCompletionMs);
    mergeRec(agg.regionRevenue, s.regionRevenue);
    mergeRec(agg.regionOrderCount, s.regionOrderCount);
    mergeRec(agg.categoryRevenue, s.categoryRevenue);
    mergeRec(agg.categoryOrderCount, s.categoryOrderCount);
    mergeRec(agg.itemCounts, s.itemCounts);
    mergeRec(agg.itemRevenue, s.itemRevenue);
    mergeRec(agg.sectorOrderCount, s.sectorOrderCount);
    mergeRec(agg.sectorTotalCompletionMs, s.sectorTotalCompletionMs);
    mergeRec(agg.sectorCompletedCount, s.sectorCompletedCount);
    mergeRec(agg.hourlyOrderCount, s.hourlyOrderCount);
    mergeRec(agg.hourlyRevenue, s.hourlyRevenue);
  }

  return agg;
}

export function dayKeyFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDayKeys(days: number, offsetDays = 0): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays - i);
    return dayKeyFromDate(d);
  });
}
