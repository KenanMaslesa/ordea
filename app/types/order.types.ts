export interface Sector {
  id: string;
  name: string;
  icon?: string; // Ionicons icon name, e.g. "wine-outline"
}

export interface Zone {
  name: string;
  tableCount: number; // number of tables in this zone
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;       // cijena po komadu u trenutku narudžbe
  category: string;    // naziv kategorije u trenutku narudžbe
  sectorId: string;    // sektor koji obrađuje stavku (snapshot)
  note?: string | null;
}

export interface Order {
  id: string;
  waiterName: string;
  waiterId: string;
  region: string;
  items: OrderItem[];
  orderNote?: string | null;
  status: "pending" | "done" | "cancelled";
  totalPrice: number;
  dayKey: string;
  sectorStatus: Record<string, "pending" | "done">;     // { sectorId: "pending"|"done" }
  sectorFinishedAt: Record<string, number>;              // { sectorId: timestamp }
  sectorNames: Record<string, string>;                  // { sectorId: "Šank" } — za notifikacije
  createdAt: number;
  finishedAt?: number | null;
  cancelledAt?: number | null;
  cancelledBy?: string | null;
}

export interface OrderItemInput {
  name: string;
  qty: number;
  price: number;
  category: string;
  sectorId: string;
  note?: string;
}

export interface OrderCreateInput {
  waiterId: string;
  waiterName: string;
  region: string;
  items: OrderItemInput[];
  orderNote?: string | null;
  status: "pending";
  totalPrice: number;
  dayKey: string;
  sectorStatus: Record<string, "pending" | "done">;
  sectorFinishedAt: Record<string, number>;
  sectorNames: Record<string, string>;
  createdAt: number;
}

export type LocationMode = "none" | "zones" | "tables" | "zones_tables";

export interface Place {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  menuVersion: number;
  locationMode: LocationMode;
  zones: Zone[];
  tableCount: number;
  sectors: Sector[];
  createdAt: number;
}

export interface MenuNode {
  id: string;
  type: "category" | "item";
  name: string;
  emoji?: string;
  price?: number;
  sectorId?: string;
  parentId: string | null;
  order: number;
  createdAt: number;
}
