import { db, menuPath, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import NetInfo from "@react-native-community/netinfo";
import * as Device from "expo-device";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { collection, doc, getDocsFromServer, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import SideDrawer from "./components/SideDrawer";
import { useTheme } from "./context/ThemeContext";
import { getItem, setItem } from "./helper";
import useAuth from "./hooks/useAuth";
import { useMyOrders } from "./hooks/useMyOrders";
import { useOrderDoneListener } from "./hooks/useOrderDoneListener";
import MyOrdersScreen from "./screens/MyOrdersScreen";
import WaiterNameModal from "./screens/components/WaiterNameModal";
import { createOrder } from "./services/orders.service";
import { getPlaceById } from "./services/place.service";
import { LocationMode, MenuNode, Sector, Zone } from "./types/order.types";
import { haptic } from "./utils/haptics";

/* ---------- Menu tree types ---------- */
// Bump this when buildMenu logic changes to invalidate all clients' caches.
const CACHE_SCHEMA_V = 2;

type DynItem = { id: string; name: string; price: number; sectorId?: string };
type DynSub  = { id: string; name: string; items: DynItem[] };
type DynCat  = { id: string; name: string; emoji?: string; subcategories: DynSub[] };

function buildMenu(nodes: MenuNode[]): DynCat[] {
  const sorted = [...nodes].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  // Group by parentId for O(1) lookup
  const byParent = new Map<string | null, MenuNode[]>();
  for (const n of sorted) {
    const key = n.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  // Recursively flatten a category into one or more DynSub sections.
  // If a subcategory has its own subcategories, each becomes its own section.
  function toSubs(catId: string, catName: string): DynSub[] {
    const children = byParent.get(catId) ?? [];
    const directItems: DynItem[] = children
      .filter(n => n.type === "item")
      .map(i => ({ id: i.id, name: i.name, price: i.price ?? 0, sectorId: i.sectorId }));
    const subCats = children.filter(n => n.type === "category");

    const result: DynSub[] = [];
    if (directItems.length > 0) {
      result.push({ id: catId, name: catName, items: directItems });
    }
    for (const sub of subCats) {
      result.push(...toSubs(sub.id, sub.name));
    }
    return result;
  }

  const roots = (byParent.get(null) ?? []).filter(n => n.type === "category");

  return roots.map(cat => {
    const children = byParent.get(cat.id) ?? [];
    const directItems: DynItem[] = children
      .filter(n => n.type === "item")
      .map(i => ({ id: i.id, name: i.name, price: i.price ?? 0, sectorId: i.sectorId }));
    const subCats = children.filter(n => n.type === "category");

    const subcategories: DynSub[] = [];
    if (directItems.length > 0) {
      subcategories.push({ id: `${cat.id}_direct`, name: cat.name, items: directItems });
    }
    for (const sub of subCats) {
      subcategories.push(...toSubs(sub.id, sub.name));
    }
    return { id: cat.id, name: cat.name, emoji: cat.emoji, subcategories };
  });
}

type OrderItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  sectorId?: string;
};

const { width, height } = Dimensions.get("window");

export default function WaiterScreen() {
  useAuth("waiter");
  const [dynamicMenu, setDynamicMenu] = useState<DynCat[]>([]);
  const [activeCat, setActiveCat] = useState<DynCat | null>(null);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [note, setNote] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("none");
  const [placeZones, setPlaceZones] = useState<Zone[]>([]);
  const [tableCount, setTableCount] = useState(0);
  const [activeZoneTab, setActiveZoneTab] = useState(0);
  const [showZoneSheet, setShowZoneSheet] = useState(false);
  const [showOrdersSheet, setShowOrdersSheet] = useState(false);
  const [placeSectors, setPlaceSectors] = useState<Sector[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerTheme, setHeaderTheme] = useState<"primaryColor" | "white">("white");
  const [sheetTheme, setSheetTheme] = useState<"primaryColor" | "white">("white");
  const { darkMode, primaryColor, setPrimaryColor } = useTheme();

  const [waiterName, setWaiterName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [reconnectedCount, setReconnectedCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const pendingOfflineCountRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    getItem("@role").then(r => { if (r === "admin") setIsAdminPreview(true); });
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      if (!connected) {
        wasOfflineRef.current = true;
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        const count = pendingOfflineCountRef.current;
        pendingOfflineCountRef.current = 0;
        setPendingOfflineCount(0);
        setReconnectedCount(count);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3000);
      }
    });
    return unsub;
  }, []);

  // --- Load menu: cache first, re-fetch only when menuVersion changes ---
  useEffect(() => {
    if (!placeId) return;

    // 1. Show cached menu immediately (instant, no network)
    getItem("@menuCache").then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { version: number; schemaV?: number; menu: DynCat[] };
        // Invalidate cache if built with an older buildMenu schema
        if ((parsed.schemaV ?? 1) < CACHE_SCHEMA_V) return;
        setDynamicMenu(parsed.menu);
        setActiveCat(parsed.menu[0] ?? null);
      } catch {}
    });

    // 2. Watch place doc for menuVersion changes + color sync
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), async placeSnap => {
      if (!placeSnap.exists()) return;
      const placeData = placeSnap.data();
      const serverVersion: number = placeData.menuVersion ?? 0;
      if (placeData.primaryColor) setPrimaryColor(placeData.primaryColor);

      const raw = await getItem("@menuCache");
      const parsed = raw ? JSON.parse(raw) as { version: number; schemaV?: number; menu: DynCat[] } : null;
      const cachedVersion: number = parsed ? (parsed.version ?? -1) : -1;
      const cachedSchema: number = parsed ? (parsed.schemaV ?? 1) : 0;

      if (serverVersion === cachedVersion && cachedSchema === CACHE_SCHEMA_V) return; // cache is up to date


      // 3. Cache stale — fetch fresh menu from Firestore
      const q = query(
        collection(db, menuPath(placeId)),
        orderBy("order"),
        orderBy("createdAt")
      );
      const snap = await getDocsFromServer(q);
      const nodes = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuNode, "id">) }));
      const built = buildMenu(nodes);

      setDynamicMenu(built);
      setActiveCat(prev =>
        prev && built.find(c => c.id === prev.id) ? prev : built[0] ?? null
      );
      await setItem("@menuCache", JSON.stringify({ version: serverVersion, schemaV: CACHE_SCHEMA_V, menu: built }));
    });

    return unsub;
  }, [placeId]);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [90, "45%", "85%"], []);

  const badgeAnim = useRef<{ [key: string]: Animated.Value }>({}).current;
  const navigation = useNavigation();

  // --- ref za svaki ScrollView ---
  const scrollRefs = useRef<{ [key: number]: ScrollView | null }>({});

  // --- refs za horizontal i sticky FlatList ---
  const flatListMainGridRef = useRef<FlatList>(null);
  const flatListStickyCategoryRef = useRef<FlatList>(null);

  const { myOrders } = useMyOrders(placeId, `${waiterName}_${deviceId}`);
  useOrderDoneListener(myOrders);

  // --- Load waiter name, deviceId and placeId ---
  useEffect(() => {
    (async () => {
      const savedName = await getItem("@waiterName");
      const savedDeviceId = await getItem("@deviceId");
      const savedPlaceId = await getItem("@placeId");

      if (savedPlaceId) {
        setPlaceId(savedPlaceId);
        // Fetch place settings (location mode, zones, tableCount)
        getPlaceById(savedPlaceId).then(p => {
          if (!p) return;
          const mode = p.locationMode ?? "none";
          const rawZones: any[] = p.zones ?? [];
          const zones: Zone[] = rawZones.map(z => typeof z === "string" ? { name: z, tableCount: 0 } : z);
          const tc = p.tableCount ?? 0;
          setLocationMode(mode);
          setPlaceZones(zones);
          setTableCount(tc);
          setPlaceSectors(p.sectors ?? []);
          if (zones.length > 0) setSelectedZone(zones[0].name);
          if (p.primaryColor) setPrimaryColor(p.primaryColor);
        });
      }

      if (savedDeviceId) {
        setDeviceId(savedDeviceId);
      } else {
        const newDeviceId =
          Device.osInternalBuildId ||
          `${Math.random().toString(36).substr(2, 9)}`;
        setDeviceId(newDeviceId);
        await setItem("@deviceId", newDeviceId);
      }

      if (savedName) {
        setWaiterName(savedName);
      } else {
        const role = await getItem("@role");
        if (role === "admin") {
          // Admin uses their own name set in the drawer (@adminName)
          const adminName = await getItem("@adminName");
          setWaiterName(adminName || "Admin");
        } else {
          setShowNameModal(true);
        }
      }

      const h = await getItem("@waiterHeaderTheme");
      const s = await getItem("@waiterSheetTheme");
      if (h === "primaryColor" || h === "white") setHeaderTheme(h);
      if (s === "primaryColor" || s === "white") setSheetTheme(s);
    })();

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      const h = await getItem("@waiterHeaderTheme");
      const s = await getItem("@waiterSheetTheme");
      if (h === "primaryColor" || h === "white") setHeaderTheme(h);
      if (s === "primaryColor" || s === "white") setSheetTheme(s);
    })();
  }, []));

  // --- Update header ---
  useLayoutEffect(() => {
    if (loading) {
      navigation.setOptions({ headerShown: false });
      return;
    }
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <Pressable onPress={() => setShowNameModal(true)} hitSlop={10}>
          <Text style={{ color: headerTheme === "primaryColor" ? "#fff" : darkMode ? "#F9FAFB" : "#18181B", fontWeight: "700", fontSize: 16, letterSpacing: -0.3 }}>
            {waiterName || t("waiter.setName")}
          </Text>
        </Pressable>
      ),
      headerTitleAlign: "center",
      headerLeft: () => (
        <Pressable onPress={() => setDrawerOpen(true)} style={{ paddingLeft: 8 }} hitSlop={10}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: headerTheme === "primaryColor" ? "rgba(255,255,255,0.18)" : darkMode ? "#374151" : primaryColor + "20",
            borderWidth: headerTheme !== "primaryColor" && !darkMode ? 1 : 0,
            borderColor: primaryColor,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="menu" size={20} color={headerTheme === "primaryColor" ? "#fff" : darkMode ? "#E5E7EB" : primaryColor} />
          </View>
        </Pressable>
      ),
      headerRight: () => {
        const last25h = Date.now() - 25 * 60 * 60 * 1000;
        const doneCount = myOrders.filter(o => o.status === "done" && (o.finishedAt ?? o.createdAt) >= last25h).length
        const pendingCount = myOrders.filter(o => o.status === "pending").length
      
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 }}>
            {/* Orders */}
            <Pressable onPress={() => setShowOrdersSheet(true)} hitSlop={10}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: headerTheme === "primaryColor" ? "rgba(255,255,255,0.18)" : darkMode ? "#374151" : primaryColor + "20",
                borderWidth: headerTheme !== "primaryColor" && !darkMode ? 1 : 0,
                borderColor: primaryColor,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="receipt-outline" size={20} color={headerTheme === "primaryColor" ? "#fff" : darkMode ? "#E5E7EB" : primaryColor} />
                {pendingCount > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: "#ef4444",
                    alignItems: "center", justifyContent: "center",
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{pendingCount}</Text>
                  </View>
                )}
                {doneCount > 0 && (
                  <View style={{
                    position: "absolute", top: -4, left: -4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: "#22c55e",
                    alignItems: "center", justifyContent: "center",
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{doneCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>

          </View>
        )
      },
      headerStyle: {
        backgroundColor: headerTheme === "primaryColor" ? primaryColor : darkMode ? "#1F2937" : "#fff",
        shadowColor: headerTheme === "primaryColor" ? primaryColor : "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
      },
      headerShadowVisible: !darkMode && headerTheme !== "primaryColor",
      headerTintColor: headerTheme === "primaryColor" ? "#fff" : darkMode ? "#F9FAFB" : "#18181B",
    });
  }, [navigation, waiterName, myOrders, headerTheme, darkMode, primaryColor, loading]);

  // --- Badge animation ---
  const animateBadge = (id: string) => {
    if (!badgeAnim[id]) badgeAnim[id] = new Animated.Value(1);
    Animated.sequence([
      Animated.timing(badgeAnim[id], {
        toValue: 1.2,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(badgeAnim[id], {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getQty = (id: string) => order.find((o) => o.id === id)?.quantity || 0;

  const addItem = (item: DynItem, categoryName: string) => {
    if (!waiterName) {
      if (isAdminPreview) { /* name already set from @adminName */ }
      else { setShowNameModal(true); return; }
    }
    haptic.light();
    setOrder((o) => {
      const existing = o.find((x) => x.id === item.id);
      if (existing)
        return o.map((x) =>
          x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x
        );
      return [...o, { ...item, quantity: 1, category: categoryName, sectorId: item.sectorId }];
    });
    animateBadge(item.id);
  };

  const removeItem = (id: string) => {
    setOrder((o) =>
      o
        .map((x) => (x.id === id ? { ...x, quantity: x.quantity - 1 } : x))
        .filter((x) => x.quantity > 0)
    );
    animateBadge(id);
  };

  const submitOrder = async () => {
    if (sending) return;

    if (!waiterName) {
      setShowNameModal(true);
      return;
    }

    if (order.length === 0) return;

    setSending(true);

    const input = {
      waiterId: `${waiterName}_${deviceId}`,
      waiterName,
      status: "pending" as const,
      createdAt: Date.now(),
      dayKey: new Date().toISOString().slice(0, 10),
      orderNote: note.trim() || null,
      region:
        locationMode === "none" ? "" :
        locationMode === "zones" ? selectedZone :
        locationMode === "tables" ? (selectedTable ? `${t("waiter.tableLabel", { n: selectedTable })}` : "") :
        /* zones_tables */ selectedZone && selectedTable ? `${selectedZone} · ${t("waiter.tableLabel", { n: selectedTable })}` : selectedZone,
      totalPrice: order.reduce((sum, o) => sum + o.price * o.quantity, 0),
      items: order.map((o) => ({
        name: o.name,
        qty: o.quantity,
        category: o.category,
        price: o.price,
        sectorId: o.sectorId ?? "",
      })),
      sectorStatus: Object.fromEntries(
        [...new Set(order.map(o => o.sectorId).filter(Boolean))].map(id => [id, "pending"])
      ) as Record<string, "pending" | "done">,
      sectorFinishedAt: {},
      sectorNames: Object.fromEntries(
        placeSectors
          .filter(s => order.some(o => o.sectorId === s.id))
          .map(s => [s.id, s.name])
      ),
    };

    if (!isConnected) {
      // Fire-and-forget: Firebase buffers the write in memory and sends it
      // automatically when the connection is restored. Don't await — addDoc
      // on web won't resolve until the server confirms, which would block the UI.
      createOrder(placeId, input).catch(console.error);
      haptic.success();
      setOrder([]);
      setNote("");
      sheetRef.current?.snapToIndex(0);
      setSending(false);
      pendingOfflineCountRef.current += 1;
      setPendingOfflineCount(c => c + 1);
      Alert.alert(
        "Narudžba u redu čekanja 📶",
        "Nema konekcije. Narudžba će biti poslana automatski čim se povežeš na internet.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      await createOrder(placeId, input);
      haptic.success();
      setOrder([]);
      setNote("");
      sheetRef.current?.snapToIndex(0);
    } catch (e) {
      console.error(e);
      haptic.error();
      Alert.alert(t("common.error"), t("waiter.errorSend"));
    } finally {
      setSending(false);
    }
  };

  // --- scroll na kategoriju (sticky buttons) ---
  const scrollToCategory = (index: number) => {
    flatListMainGridRef.current?.scrollToOffset({
      offset: width * index,
      animated: true,
    });
    scrollRefs.current[index]?.scrollTo({ y: 0, animated: false }); // reset scroll
  };

  const onHorizontalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const cat = dynamicMenu[index];
    if (cat && cat.id !== activeCat?.id) {
      setActiveCat(cat);
      scrollRefs.current[index]?.scrollTo({ y: 0, animated: false });
    }
    flatListStickyCategoryRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
  };

  // --- Backdrop for BottomSheet ---
  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={0}
      appearsOnIndex={1}
      pressBehavior="none"
      opacity={0.7}
      backgroundColor="#000"
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={() => sheetRef.current?.snapToIndex(0)}
      />
    </BottomSheetBackdrop>
  );

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);
  const { t } = useTranslation();

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#111827" : "#F9FAFB", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <ActivityIndicator size="large" color={primaryColor} />
      <Text style={{ fontSize: 14, color: darkMode ? "#9CA3AF" : "#6B7280", fontWeight: "500" }}>{t("waiter.loading")}</Text>
    </View>
  );

  // --- Sheet color tokens based on sheetTheme ---
  const SC = sheetTheme === "primaryColor" ? {
    bg: primaryColor,
    handle: "#fff",
    headerBg: primaryColor,
    headerBorder: "rgba(255,255,255,0.2)" as const,
    title: "#fff",
    rowBorder: "rgba(255,255,255,0.15)" as const,
    cat: "rgba(255,255,255,0.75)",
    name: "#fff",
    qty: "#fff",
    price: "#fff",
    qtyBtnBg: "#fff",
    qtyBtnBorder: "transparent" as const,
    qtyBtnText: primaryColor,
    totalText: "#fff",
    btnBg: "#fff",
    btnText: primaryColor,
    noteBg: "rgba(255,255,255,0.15)" as const,
    noteText: "#fff",
    noteBorder: "rgba(255,255,255,0.3)" as const,
    notePlaceholder: "rgba(255,255,255,0.5)" as const,
    shadow: primaryColor,
    zoneBg: "rgba(255,255,255,0.2)" as const,
    zoneText: "#fff",
  } : darkMode ? {
    bg: "#1F2937",
    handle: "#6B7280",
    headerBg: "#374151",
    headerBorder: "#4B5563" as const,
    title: "#F9FAFB",
    rowBorder: "#374151" as const,
    cat: "#9CA3AF",
    name: "#F9FAFB",
    qty: "#F9FAFB",
    price: "#F9FAFB",
    qtyBtnBg: "#374151",
    qtyBtnBorder: "#4B5563" as const,
    qtyBtnText: primaryColor,
    totalText: "#F9FAFB",
    btnBg: primaryColor,
    btnText: "#fff",
    noteBg: "#374151" as const,
    noteText: "#F9FAFB",
    noteBorder: "#4B5563" as const,
    notePlaceholder: "#6B7280" as const,
    shadow: "#000",
    zoneBg: "#374151" as const,
    zoneText: primaryColor,
  } : {
    bg: "#fff",
    handle: primaryColor,
    headerBg: primaryColor + "12",
    headerBorder: "#E4E4E7" as const,
    title: primaryColor,
    rowBorder: "#F4F4F5" as const,
    cat: "#71717A",
    name: "#18181B",
    qty: "#18181B",
    price: "#18181B",
    qtyBtnBg: primaryColor + "12",
    qtyBtnBorder: primaryColor + "40" as const,
    qtyBtnText: primaryColor,
    totalText: "#18181B",
    btnBg: primaryColor,
    btnText: "#fff",
    noteBg: "#FAFAFA" as const,
    noteText: "#18181B",
    noteBorder: "#E4E4E7" as const,
    notePlaceholder: "#aaa" as const,
    shadow: primaryColor,
    zoneBg: "#fff" as const,
    zoneText: primaryColor,
  };

  // --- Dark mode tokens ---
  const DM = {
    catBar:    darkMode ? "#1F2937" : "#fff",
    catBorder: darkMode ? "#374151" : "#eee",
    catText:   darkMode ? "#E5E7EB" : "#000",
    subTitle:  darkMode ? "#F3F4F6" : "#18181B",
    cardBg:    darkMode ? "#1F2937" : "#fff",
    cardText:  darkMode ? "#F9FAFB" : "#18181B",
    badgeBg:   darkMode ? "#374151" : "#fff",
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#111827" : "#F4F5F7" }}>
      {/* Offline / flushing banner */}
      {!isConnected && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: "#DC2626",
          paddingHorizontal: 16, paddingVertical: 10,
        }}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }}>
            {pendingOfflineCount > 0
              ? t("waiter.noConnectionPending", { count: pendingOfflineCount })
              : t("waiter.noConnection")}
          </Text>
        </View>
      )}

      {/* Back online banner */}
      {justReconnected && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: "#16a34a",
          paddingHorizontal: 16, paddingVertical: 10,
        }}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }}>
            {reconnectedCount > 0
              ? t("waiter.backOnlineSent", { count: reconnectedCount })
              : t("waiter.backOnline")}
          </Text>
        </View>
      )}

      {/* Sticky Header */}
      <View style={[styles.categories, { backgroundColor: DM.catBar }]}>
        <FlatList
          ref={flatListStickyCategoryRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dynamicMenu}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const active = item.id === activeCat?.id;
            return (
              <Pressable
                onPress={() => scrollToCategory(index)}
                style={[
                  styles.categoryBtn,
                  active && {
                    backgroundColor: darkMode ? primaryColor + "35" : primaryColor + "18",
                    borderWidth: 1,
                    borderColor: primaryColor,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {item.emoji?.includes("-") ? (
                    <Ionicons
                      name={item.emoji as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? primaryColor : DM.catText}
                    />
                  ) : item.emoji ? (
                    <Text style={{ color: active ? primaryColor : DM.catText }}>{item.emoji}</Text>
                  ) : null}
                  <Text style={{ color: active ? primaryColor : DM.catText, fontWeight: active ? "800" : "600" }}>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
      <View style={{ height: 1, backgroundColor: DM.catBorder }} />
      {dynamicMenu.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
      <FlatList
        ref={flatListMainGridRef}
        data={dynamicMenu}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onHorizontalScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        style={{ backgroundColor: "transparent" }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item: category, index }) => (
          <ScrollView
            ref={(ref) => { scrollRefs.current[index] = ref; }}
            style={{ width, height, backgroundColor: "transparent" }}
            contentContainerStyle={{ paddingBottom: 250 }}
          >
            {category.subcategories.map((sub: DynSub) => (
              <View key={sub.id} style={{ marginBottom: 28 }}>
                <Text style={[styles.subTitle, { color: DM.subTitle }]}>{sub.name}</Text>
                <View style={styles.itemsGrid}>
                  {sub.items.map((item: DynItem) => {
                    const qty = getQty(item.id);
                    const selected = qty > 0;

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => addItem(item, sub.name)}
                        style={[
                          styles.itemCard,
                          { backgroundColor: selected ? primaryColor : DM.cardBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemName,
                            { color: selected ? "#fff" : DM.cardText },
                          ]}
                        >
                          {item.name}
                        </Text>
                        {/* <Text
                          style={[
                            styles.itemPrice,
                            selected && { color: "#E0F2F1" },
                          ]}
                        >
                          {item.price.toFixed(2)} KM
                        </Text> */}

                        {selected && (
                          <Animated.View
                            style={[
                              styles.badge,
                              { backgroundColor: DM.badgeBg },
                              {
                                transform: [{ scale: badgeAnim[item.id] || 1 }],
                              },
                            ]}
                          >
                            <Pressable
                              style={styles.badgeMinus}
                              onPress={() => removeItem(item.id)}
                            >
                              <Text style={styles.badgeMinusText}>–</Text>
                            </Pressable>
                            <View style={styles.badgeQty}>
                              <Text style={styles.badgeQtyText}>{qty}</Text>
                            </View>
                          </Animated.View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      />
      )}

      {/* BottomSheet */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: SC.bg }}
        handleIndicatorStyle={{ backgroundColor: SC.handle }}
        style={{
          shadowColor: SC.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 20,
        }}
      >
        <BottomSheetView style={styles.sheet}>
          <Pressable
            onPress={() => sheetRef.current?.snapToIndex(2)}
            style={[styles.sheetHeader, { backgroundColor: SC.headerBg, borderColor: SC.headerBorder }]}
          >
            <Text style={[styles.sheetTitle, { color: SC.title }]}>
              Narudžba ({order.reduce((s, i) => s + i.quantity, 0)})
            </Text>
            {locationMode !== "none" && (
              <Pressable
                onPress={() => setShowZoneSheet(true)}
                style={{
                  marginTop: 8,
                  padding: 6,
                  backgroundColor: SC.zoneBg,
                  borderRadius: 8,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ fontWeight: "700", color: SC.zoneText }}>
                  {
                    locationMode === "zones" ? (selectedZone || t("waiter.selectZone")) :
                    locationMode === "tables" ? (selectedTable ? t("waiter.tableLabel", { n: selectedTable }) : t("waiter.selectTable")) :
                    selectedZone && selectedTable ? `${selectedZone} · ${t("waiter.tableLabel", { n: selectedTable })}` :
                    selectedZone ? `${selectedZone} · ${t("waiter.selectTable")}` : t("waiter.selectLocation")
                  }
                </Text>
              </Pressable>
            )}
          </Pressable>

          <FlatList
            data={order}
            keyExtractor={(o) => o.id}
            style={{ marginTop: 12 }}
            renderItem={({ item: o }) => (
              <View key={o.id} style={[styles.orderRow, { borderColor: SC.rowBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderCat, { color: SC.cat }]}>{o.category}</Text>
                  <Text style={[styles.orderName, { color: SC.name }]}>{o.name}</Text>
                </View>
                <View style={styles.orderControls}>
                  <Pressable
                    style={[styles.qtyBtn, { backgroundColor: SC.qtyBtnBg, borderColor: SC.qtyBtnBorder }]}
                    onPress={() => removeItem(o.id)}
                  >
                    <Text style={[styles.qtyBtnText, { color: SC.qtyBtnText }]}>–</Text>
                  </Pressable>
                  <Text style={[styles.qty, { color: SC.qty }]}>{o.quantity}</Text>
                  <Pressable
                    style={[styles.qtyBtn, { backgroundColor: SC.qtyBtnBg, borderColor: SC.qtyBtnBorder }]}
                    onPress={() => addItem(o, o.category)}
                  >
                    <Text style={[styles.qtyBtnText, { color: SC.qtyBtnText }]}>+</Text>
                  </Pressable>
                  <Text style={[styles.orderPrice, { color: SC.price }]}>
                    {(o.price * o.quantity).toFixed(2)} KM
                  </Text>
                </View>
              </View>
            )}
          />

          {order.length !== 0 && (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Napomena"
              placeholderTextColor={SC.notePlaceholder}
              style={[styles.noteInput, { backgroundColor: SC.noteBg, color: SC.noteText, borderColor: SC.noteBorder }]}
            />
          )}

          <View style={styles.totalRow}>
            <Text style={[styles.totalText, { color: SC.totalText }]}>Ukupno:</Text>
            <Text style={[styles.totalText, { color: SC.totalText }]}>
              {order
                .reduce((sum, i) => sum + i.price * i.quantity, 0)
                .toFixed(2)}{" "}
              KM
            </Text>
          </View>

          {order.length > 0 && (
            <Pressable
              disabled={sending}
              onPress={submitOrder}
              style={[styles.nextBtn, { backgroundColor: SC.btnBg }, sending && { opacity: 0.6 }, !isConnected && { backgroundColor: "#D97706" }]}
            >
              <Text style={{ fontWeight: "800", color: !isConnected ? "#fff" : SC.btnText }}>
                {sending ? "SLANJE..." : !isConnected ? "SAČUVAJ NARUDŽBU 📡" : "POŠALJI NARUDŽBU 🚀"}
              </Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* --- Waiter Name Modal --- */}
      <WaiterNameModal
        visible={showNameModal}
        onClose={() => setShowNameModal(false)}
        darkMode={darkMode}
        onSave={(name) => {
          setWaiterName(name);
          setShowNameModal(false);
        }}
      />

      {/* Location Picker Modal */}
      <Modal
        visible={showZoneSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowZoneSheet(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowZoneSheet(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.regionSheet, { backgroundColor: darkMode ? "#1F2937" : "#fff" }]}
          >
            {/* ZONES only */}
            {locationMode === "zones" && (
              <>
                <Text style={[styles.modalTitle, { color: DM.cardText }]}>Izaberi zonu</Text>
                {placeZones.map((z) => (
                  <Pressable
                    key={z.name}
                    onPress={() => { setSelectedZone(z.name); setShowZoneSheet(false); }}
                    style={styles.regionBtn}
                  >
                    <Text style={[styles.regionText, { color: DM.cardText }, z.name === selectedZone && { fontWeight: "bold", color: primaryColor }]}>
                      {z.name}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {/* TABLES only */}
            {locationMode === "tables" && (
              <>
                <Text style={[styles.modalTitle, { color: DM.cardText }]}>Izaberi sto</Text>
                <View style={styles.tableGrid}>
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => (
                    <Pressable
                      key={n}
                      onPress={() => { setSelectedTable(n); setShowZoneSheet(false); }}
                      style={[styles.tableCell, { backgroundColor: darkMode ? "#374151" : "#f5f5f5", borderColor: darkMode ? "#4B5563" : "#e5e5e5" }, selectedTable === n && styles.tableCellActive]}
                    >
                      <Text style={[styles.tableCellText, { color: DM.cardText }, selectedTable === n && styles.tableCellTextActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* ZONES + TABLES */}
            {locationMode === "zones_tables" && (
              <>
                <Text style={[styles.modalTitle, { color: DM.cardText }]}>Izaberi lokaciju</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneTabs}>
                  {placeZones.map((z, i) => (
                    <Pressable
                      key={z.name}
                      onPress={() => setActiveZoneTab(i)}
                      style={[styles.zoneTab, { backgroundColor: darkMode ? "#374151" : "#fff", borderColor: darkMode ? "#4B5563" : "#ddd" }, activeZoneTab === i && styles.zoneTabActive]}
                    >
                      <Text style={[styles.zoneTabText, { color: darkMode ? "#D1D5DB" : "#555" }, activeZoneTab === i && styles.zoneTabTextActive]}>{z.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.tableGrid}>
                  {Array.from({ length: placeZones[activeZoneTab]?.tableCount ?? 0 }, (_, i) => i + 1).map(n => (
                    <Pressable
                      key={n}
                      onPress={() => {
                        setSelectedZone(placeZones[activeZoneTab]?.name ?? "");
                        setSelectedTable(n);
                        setShowZoneSheet(false);
                      }}
                      style={[
                        styles.tableCell,
                        { backgroundColor: darkMode ? "#374151" : "#f5f5f5", borderColor: darkMode ? "#4B5563" : "#e5e5e5" },
                        selectedTable === n && selectedZone === placeZones[activeZoneTab]?.name && styles.tableCellActive,
                      ]}
                    >
                      <Text style={[
                        styles.tableCellText,
                        { color: DM.cardText },
                        selectedTable === n && selectedZone === placeZones[activeZoneTab]?.name && styles.tableCellTextActive,
                      ]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* My Orders Modal */}
      <Modal
        visible={showOrdersSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrdersSheet(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOrdersSheet(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={styles.ordersModal}
          >
            <MyOrdersScreen waiterId={`${waiterName}_${deviceId}`} placeId={placeId} darkMode={darkMode} onClose={() => setShowOrdersSheet(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={isAdminPreview ? "admin" : "waiter"}
        placeId={placeId}
        sectors={placeSectors}
        isAdminPreview={isAdminPreview}
        onNameChange={(name) => setWaiterName(name)}
        onSettingsPress={() => router.push("/waiter-settings")}
      />
    </View>
  );
}

// --- Styles (ostavljam tvoje originalne) ---
const makeStyles = (p: string) => StyleSheet.create({
  adminBackBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 99,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: p, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  adminBackBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ordersModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "88%",
    overflow: "hidden",
  },
  categories: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
  },
  categoryActive: { backgroundColor: p },
  subTitle: { fontSize: 18, fontWeight: "800", margin: 12 },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 },
  itemCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    margin: "1%",
  },
  itemCardActive: { backgroundColor: p },
  itemName: { fontWeight: "700" },
  itemPrice: { marginTop: 6, color: "#555" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
  },
  badgeMinus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: p,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMinusText: { color: "#fff", fontWeight: "900" },
  badgeQty: {
    marginLeft: 6,
    backgroundColor: p,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeQtyText: { color: "#fff", fontWeight: "800" },
  sheet: {
    paddingHorizontal: 16,
    flex: 1,
    maxHeight: "100%",
    paddingBottom: 100,
    paddingTop: 0,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E4E4E7",
    backgroundColor: p + "12",
    marginHorizontal: -16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: { color: p, fontWeight: "800", fontSize: 15 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F4F4F5",
  },
  orderCat: { color: "#71717A", fontSize: 12 },
  orderName: { color: "#18181B", fontWeight: "700", fontSize: 14 },
  orderControls: { flexDirection: "row", alignItems: "center" },
  qtyBtn: {
    backgroundColor: p + "12",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    borderWidth: 1.5,
    borderColor: p + "50",
  },
  qtyBtnText: { color: p, fontWeight: "800", fontSize: 16, includeFontPadding: false, textAlignVertical: "center", textAlign: "center" },
  qty: { color: "#18181B", fontWeight: "700", marginHorizontal: 4 },
  orderPrice: { color: "#18181B", marginLeft: 8, fontWeight: "700" },
  noteInput: {
    marginVertical: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 12,
    color: "#18181B",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    fontSize: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  totalText: { color: "#18181B", fontWeight: "800", fontSize: 18 },
  nextBtn: {
    backgroundColor: p,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  regionSheet: {
    backgroundColor: "#fff",
    padding: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "85%",
  },
  modalTitle: { fontWeight: "700", fontSize: 18, marginBottom: 12 },
  regionBtn: { paddingVertical: 12 },
  regionText: { fontSize: 16 },
  zoneTabs: { marginBottom: 16 },
  zoneTab: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd",
    marginRight: 8, backgroundColor: "#fff",
  },
  zoneTabActive: { backgroundColor: p, borderColor: p },
  zoneTabText: { fontSize: 14, fontWeight: "600", color: "#555" },
  zoneTabTextActive: { color: "#fff" },
  tableGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4,
  },
  tableCell: {
    width: 54, height: 54, borderRadius: 10,
    backgroundColor: "#f5f5f5", borderWidth: 1.5, borderColor: "#e5e5e5",
    alignItems: "center", justifyContent: "center",
  },
  tableCellActive: { backgroundColor: p, borderColor: p },
  tableCellText: { fontSize: 16, fontWeight: "700", color: "#333" },
  tableCellTextActive: { color: "#fff" },
});
