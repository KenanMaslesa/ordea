import { db, menuPath, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import * as Device from "expo-device";
import { useNavigation, useRouter } from "expo-router";
import { collection, doc, getDocsFromServer, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

  const [waiterName, setWaiterName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getItem("@role").then(r => { if (r === "admin") setIsAdminPreview(true); });
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

    // 2. Watch place doc for menuVersion changes only
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), async placeSnap => {
      if (!placeSnap.exists()) return;
      const serverVersion: number = placeSnap.data().menuVersion ?? 0;

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
          setWaiterName("Admin");
        } else {
          setShowNameModal(true);
        }
      }
    })();

    setLoading(false);
  }, []);

  // --- Update header ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable onPress={() => setShowNameModal(true)}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
            Konobar
          </Text>
        </Pressable>
      ),
      // headerTitleAlign: "center",
      headerLeft: isAdminPreview ? () => (
        <Pressable onPress={() => router.replace("/admin")} style={{ paddingLeft: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
      ) : () => null,
      headerRight: () => {
        const doneCount = myOrders.filter(o => o.status === "done").length
        const pendingCount = myOrders.filter(o => o.status === "pending").length
      
        return (
          <Pressable
            onPress={() => setShowOrdersSheet(true)}
            style={{ padding: 16 }}
          >
            <View style={{ position: "relative" }}>
              {/* Ikonica */}
              <Text style={{ color: "white", fontSize: 20 }}>📃</Text>
      
              {/* CRVENI – NA ČEKANJU */}
              {pendingCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    left: -10,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#ef4444",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>
                    {pendingCount}
                  </Text>
                </View>
              )}
      
              {/* ZELENI – ZAVRŠENE */}
              {doneCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -10,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#22c55e",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>
                    {doneCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        )
      },
      headerStyle: { backgroundColor: "#0E7C86" },
      headerTintColor: "#fff",
    });
  }, [navigation, waiterName, myOrders]);

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
      if (isAdminPreview) { setWaiterName("Admin"); }
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

    try {
      setSending(true);

      await createOrder(placeId, {
        waiterId: `${waiterName}_${deviceId}`,
        waiterName,
        status: "pending",
        createdAt: Date.now(),
        dayKey: new Date().toISOString().slice(0, 10),
        orderNote: note.trim() || null,
        region:
          locationMode === "none" ? "" :
          locationMode === "zones" ? selectedZone :
          locationMode === "tables" ? (selectedTable ? `Sto ${selectedTable}` : "") :
          /* zones_tables */ selectedZone && selectedTable ? `${selectedZone} · Sto ${selectedTable}` : selectedZone,
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
      });

      // ✅ SUCCESS
      haptic.success();
      setOrder([]);
      setNote("");
      sheetRef.current?.snapToIndex(0);
    } catch (e) {
      console.error(e);
      haptic.error();
      Alert.alert("Greška", "Narudžba nije poslana. Pokušaj ponovo.");
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

  if (loading) return <ActivityIndicator size={"large"} style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      {/* Sticky Header */}
      <View style={styles.categories}>
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
                style={[styles.categoryBtn, active && styles.categoryActive]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {item.emoji?.includes("-") ? (
                    <Ionicons
                      name={item.emoji as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? "#fff" : "#000"}
                    />
                  ) : item.emoji ? (
                    <Text style={{ color: active ? "#fff" : "#000" }}>{item.emoji}</Text>
                  ) : null}
                  <Text style={{ color: active ? "#fff" : "#000", fontWeight: active ? "800" : "600" }}>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Menu items */}
      {dynamicMenu.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#0E7C86" />
        </View>
      ) : (
      <FlatList
        ref={flatListMainGridRef}
        data={dynamicMenu}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onHorizontalScroll} // ili onMomentumScrollEnd
        scrollEventThrottle={16}
        nestedScrollEnabled
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item: category, index }) => (
          <ScrollView
            ref={(ref) => { scrollRefs.current[index] = ref; }} // 👈 svaki scrollView svoj ref
            style={{ width, height }}
            contentContainerStyle={{ paddingBottom: 250 }}
          >
            {category.subcategories.map((sub: DynSub) => (
              <View key={sub.id} style={{ marginBottom: 28 }}>
                <Text style={styles.subTitle}>{sub.name}</Text>
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
                          selected && styles.itemCardActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemName,
                            selected && { color: "#fff" },
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
        backgroundStyle={{ backgroundColor: "#0E7C86" }}
      >
        <BottomSheetView style={styles.sheet}>
          <Pressable
            onPress={() => sheetRef.current?.snapToIndex(2)}
            style={styles.sheetHeader}
          >
            <Text style={styles.sheetTitle}>
              Narudžba ({order.reduce((s, i) => s + i.quantity, 0)})
            </Text>
            {locationMode !== "none" && (
              <Pressable
                onPress={() => setShowZoneSheet(true)}
                style={{
                  marginTop: 8,
                  padding: 6,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ fontWeight: "700", color: "#0E7C86" }}>
                  {
                    locationMode === "zones" ? (selectedZone || "Odaberi zonu") :
                    locationMode === "tables" ? (selectedTable ? `Sto ${selectedTable}` : "Odaberi sto") :
                    selectedZone && selectedTable ? `${selectedZone} · Sto ${selectedTable}` :
                    selectedZone ? `${selectedZone} · odaberi sto` : "Odaberi lokaciju"
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
              <View key={o.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCat}>{o.category}</Text>
                  <Text style={styles.orderName}>{o.name}</Text>
                </View>
                <View style={styles.orderControls}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => removeItem(o.id)}
                  >
                    <Text style={styles.qtyBtnText}>–</Text>
                  </Pressable>
                  <Text style={styles.qty}>{o.quantity}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => addItem(o, o.category)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                  <Text style={styles.orderPrice}>
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
              placeholderTextColor="#ccc"
              style={styles.noteInput}
            />
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Ukupno:</Text>
            <Text style={styles.totalText}>
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
              style={[styles.nextBtn, sending && { opacity: 0.6 }]}
            >
              <Text style={{ fontWeight: "800" }}>
                {sending ? "SLANJE..." : "POŠALJI NARUDŽBU 🚀"}
              </Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* --- Waiter Name Modal --- */}
      <WaiterNameModal
        visible={showNameModal}
        onClose={() => setShowNameModal(false)}
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
            style={styles.regionSheet}
          >
            {/* ZONES only */}
            {locationMode === "zones" && (
              <>
                <Text style={styles.modalTitle}>Izaberi zonu</Text>
                {placeZones.map((z) => (
                  <Pressable
                    key={z.name}
                    onPress={() => { setSelectedZone(z.name); setShowZoneSheet(false); }}
                    style={styles.regionBtn}
                  >
                    <Text style={[styles.regionText, z.name === selectedZone && { fontWeight: "bold", color: "#0E7C86" }]}>
                      {z.name}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {/* TABLES only */}
            {locationMode === "tables" && (
              <>
                <Text style={styles.modalTitle}>Izaberi sto</Text>
                <View style={styles.tableGrid}>
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => (
                    <Pressable
                      key={n}
                      onPress={() => { setSelectedTable(n); setShowZoneSheet(false); }}
                      style={[styles.tableCell, selectedTable === n && styles.tableCellActive]}
                    >
                      <Text style={[styles.tableCellText, selectedTable === n && styles.tableCellTextActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* ZONES + TABLES */}
            {locationMode === "zones_tables" && (
              <>
                <Text style={styles.modalTitle}>Izaberi lokaciju</Text>
                {/* Zone tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneTabs}>
                  {placeZones.map((z, i) => (
                    <Pressable
                      key={z.name}
                      onPress={() => setActiveZoneTab(i)}
                      style={[styles.zoneTab, activeZoneTab === i && styles.zoneTabActive]}
                    >
                      <Text style={[styles.zoneTabText, activeZoneTab === i && styles.zoneTabTextActive]}>{z.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {/* Table grid */}
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
                        selectedTable === n && selectedZone === placeZones[activeZoneTab]?.name && styles.tableCellActive,
                      ]}
                    >
                      <Text style={[
                        styles.tableCellText,
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
            <MyOrdersScreen waiterId={`${waiterName}_${deviceId}`} placeId={placeId} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// --- Styles (ostavljam tvoje originalne) ---
const styles = StyleSheet.create({
  adminBackBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 99,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0E7C86", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  adminBackBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ordersModal: {
    backgroundColor: "#fff",
    padding: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "90%",
  },
  categories: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
  },
  categoryActive: { backgroundColor: "#0E7C86" },
  subTitle: { fontSize: 18, fontWeight: "800", margin: 12 },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8 },
  itemCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    margin: "1%",
  },
  itemCardActive: { backgroundColor: "#0E7C86" },
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
    backgroundColor: "#0E7C86",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMinusText: { color: "#fff", fontWeight: "900" },
  badgeQty: {
    marginLeft: 6,
    backgroundColor: "#0E7C86",
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  sheetTitle: { color: "#fff", fontWeight: "800" },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  orderCat: { color: "#ccc", fontSize: 12 },
  orderName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  orderControls: { flexDirection: "row", alignItems: "center" },
  qtyBtn: {
    backgroundColor: "#fff",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  qtyBtnText: { color: "#0E7C86", fontWeight: "800", fontSize: 18 },
  qty: { color: "#fff", fontWeight: "700", marginHorizontal: 4 },
  orderPrice: { color: "#fff", marginLeft: 8, fontWeight: "700" },
  noteInput: {
    marginVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    color: "#000",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  totalText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  nextBtn: {
    backgroundColor: "#fff",
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
  zoneTabActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
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
  tableCellActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  tableCellText: { fontSize: 16, fontWeight: "700", color: "#333" },
  tableCellTextActive: { color: "#fff" },
});
