export interface DayStats {
  dayKey: string;
  revenue: number;
  ordersCount: number;
  cancelledCount: number;
  totalCompletionMs: number;
  completedForAvg: number;
  // per waiter
  waiterRevenue: Record<string, number>;
  waiterOrderCount: Record<string, number>;
  waiterTotalCompletionMs: Record<string, number>;
  // per region
  regionRevenue: Record<string, number>;
  regionOrderCount: Record<string, number>;
  // per category
  categoryRevenue: Record<string, number>;
  categoryOrderCount: Record<string, number>;
  // per item ("Category - Name")
  itemCounts: Record<string, number>;
  itemRevenue: Record<string, number>;
  // per sector
  sectorOrderCount: Record<string, number>;
  sectorTotalCompletionMs: Record<string, number>;
  sectorCompletedCount: Record<string, number>;
  // hourly (key = "0".."23")
  hourlyOrderCount: Record<string, number>;
  hourlyRevenue: Record<string, number>;
}

export const EMPTY_DAY_STATS: Omit<DayStats, "dayKey"> = {
  revenue: 0, ordersCount: 0, cancelledCount: 0,
  totalCompletionMs: 0, completedForAvg: 0,
  waiterRevenue: {}, waiterOrderCount: {}, waiterTotalCompletionMs: {},
  regionRevenue: {}, regionOrderCount: {},
  categoryRevenue: {}, categoryOrderCount: {},
  itemCounts: {}, itemRevenue: {},
  sectorOrderCount: {}, sectorTotalCompletionMs: {}, sectorCompletedCount: {},
  hourlyOrderCount: {}, hourlyRevenue: {},
};
