import { db, menuPath, placesRoot } from "@/firebase";
import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MENU } from "../../../assets/data";
import { useTheme } from "../../context/ThemeContext";
import { incrementMenuVersion } from "../../services/place.service";
import { MenuNode, Sector } from "../../types/order.types";

const CATEGORY_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  "restaurant-outline", "cafe-outline", "pizza-outline", "fast-food-outline",
  "ice-cream-outline", "flame-outline", "fish-outline", "leaf-outline",
  "nutrition-outline", "basket-outline", "cart-outline", "bag-outline",
  "storefront-outline", "home-outline", "business-outline", "bed-outline",
  "people-outline", "person-outline", "star-outline", "heart-outline",
  "trophy-outline", "medal-outline", "ribbon-outline", "gift-outline",
  "water-outline", "cut-outline", "thermometer-outline", "time-outline",
  "calendar-outline", "receipt-outline", "cash-outline", "card-outline",
  "bag-handle-outline", "bicycle-outline", "car-outline", "map-outline",
  "pin-outline", "sunny-outline", "umbrella-outline", "flower-outline",
  "key-outline", "grid-outline", "layers-outline", "bookmark-outline",
];

interface Props {
  placeId: string;
  onMenuPress?: () => void;
}

type ModalState =
  | { mode: "add"; parentId: string | null }
  | { mode: "edit"; node: MenuNode }
  | null;

function getSiblings(nodes: MenuNode[], parentId: string | null) {
  return [...nodes.filter(n => n.parentId === parentId)].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt
  );
}

function getAllDescendantIds(nodes: MenuNode[], id: string): string[] {
  const children = nodes.filter(n => n.parentId === id);
  const result: string[] = [];
  children.forEach(c => {
    result.push(c.id);
    result.push(...getAllDescendantIds(nodes, c.id));
  });
  return result;
}

export default function AdminSettings({ placeId, onMenuPress }: Props) {
  const { darkMode, primaryColor } = useTheme();

  const D = darkMode ? {
    root: "#111827",
    headerBg: "#1F2937",
    headerBorder: "#374151",
    headerTitle: "#F9FAFB",
    hamburgerBox: "#374151",
    rowOuter: "#1F2937",
    rowBorder: "#374151",
    nameInput: "#E5E7EB",
    itemName: "#9CA3AF",
    priceInput: "#E5E7EB",
    priceInputBorder: "#374151",
    moveBtn: "#374151",
    moveBtnIcon: "#9CA3AF",
    sectorChip: "#374151",
    sectorChipBorder: "#4B5563",
    modalBox: "#1F2937",
    modalInput: "#111827",
    modalInputBorder: "#374151",
    modalInputText: "#E5E7EB",
    fieldLabel: "#9CA3AF",
    cancelBtn: "#374151",
    cancelBtnText: "#E5E7EB",
    typeBtnBorder: "#4B5563",
    typeBtnText: "#9CA3AF",
    deleteConfirmText: "#E5E7EB",
    sampleText: "#6B7280",
    placeholder: "#6B7280",
    emptyText: "#6B7280",
    iconPickerScroll: "#1a2637",
    iconPickerBorder: "#374151",
    iconPickerItem: "#374151",
    iconPickerItemBorder: "#4B5563",
  } : {
    root: "#f9f9f9",
    headerBg: "#fff",
    headerBorder: "#F0F0F0",
    headerTitle: "#18181B",
    hamburgerBox: "#F0FDFA",
    rowOuter: "#fff",
    rowBorder: "#eee",
    nameInput: "#1a1a1a",
    itemName: "#555",
    priceInput: "#333",
    priceInputBorder: "#ddd",
    moveBtn: "#e8e8e8",
    moveBtnIcon: "#555",
    sectorChip: "#f9f9f9",
    sectorChipBorder: "#ddd",
    modalBox: "#fff",
    modalInput: "#fafafa",
    modalInputBorder: "#ddd",
    modalInputText: "#1a1a1a",
    fieldLabel: "#888",
    cancelBtn: "#f0f0f0",
    cancelBtnText: "#555",
    typeBtnBorder: "#ccc",
    typeBtnText: "#555",
    deleteConfirmText: "#333",
    sampleText: "#555",
    placeholder: "#A1A1AA",
    emptyText: "#888",
    iconPickerScroll: "#f0fafb",
    iconPickerBorder: "#b2dfdf",
    iconPickerItem: "#fff",
    iconPickerItemBorder: "#ddd",
  };

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const [nodes, setNodes] = useState<MenuNode[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);

  const [modalType, setModalType] = useState<"category" | "item">("category");
  const [modalName, setModalName] = useState("");
  const [modalPrice, setModalPrice] = useState("");
  const [modalEmoji, setModalEmoji] = useState("");
  const [modalSectorId, setModalSectorId] = useState("");
  const [localPrices, setLocalPrices] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<MenuNode | null>(null);
  const [sectorPickerOpen, setSectorPickerOpen] = useState<string | null>(null);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    const q = query(
      collection(db, menuPath(placeId)),
      orderBy("order"),
      orderBy("createdAt")
    );
    const unsub = onSnapshot(q, snap =>
      setNodes(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuNode, "id">) })))
    );
    return unsub;
  }, [placeId]);

  // Listen to place sectors
  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (d.exists()) setSectors((d.data().sectors as Sector[]) ?? []);
    });
    return unsub;
  }, [placeId]);

  const toggleCollapse = (id: string) =>
    setCollapsed(p => ({ ...p, [id]: !p[id] }));

  const openAddModal = (parentId: string | null) => {
    setModal({ mode: "add", parentId });
    setModalType("category");
    setModalName("");
    setModalPrice("");
    setModalEmoji("");
    setModalSectorId(sectors[0]?.id ?? "");
  };

  const openEditModal = (node: MenuNode) => {
    setModal({ mode: "edit", node });
    setModalType(node.type);
    setModalName(node.name);
    setModalPrice(node.price?.toString() ?? "");
    setModalEmoji(node.emoji ?? "");
    setModalSectorId(node.sectorId ?? sectors[0]?.id ?? "");
  };

  const handleSave = async () => {
    const name = modalName.trim();
    if (!name || !placeId) return;

    if (modal?.mode === "add") {
      const siblings = getSiblings(nodes, modal.parentId);
      await addDoc(collection(db, menuPath(placeId)), {
        type: modalType,
        name,
        emoji: modalType === "category" ? modalEmoji.trim() || null : null,
        price: modalType === "item" ? parseFloat(modalPrice) || 0 : null,
        sectorId: modalType === "item" ? modalSectorId : null,
        parentId: modal.parentId,
        order: siblings.length,
        createdAt: Date.now(),
      });
    } else if (modal?.mode === "edit") {
      const updates: Partial<MenuNode> = { name };
      if (modal.node.type === "category") updates.emoji = modalEmoji.trim() || undefined;
      if (modal.node.type === "item") {
        updates.price = parseFloat(modalPrice) || 0;
        updates.sectorId = modalSectorId || undefined;
      }
      await updateDoc(doc(db, menuPath(placeId), modal.node.id), updates);
    }

    await incrementMenuVersion(placeId);
    setModal(null);
  };

  const updateName = async (id: string, name: string) => {
    await updateDoc(doc(db, menuPath(placeId), id), { name });
    await incrementMenuVersion(placeId);
  };

  const updatePrice = async (id: string, price: number) => {
    await updateDoc(doc(db, menuPath(placeId), id), { price });
    await incrementMenuVersion(placeId);
  };

  const deleteNode = (node: MenuNode) => {
    setDeleteConfirm(node);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const ids = [deleteConfirm.id, ...getAllDescendantIds(nodes, deleteConfirm.id)];
    await Promise.all(ids.map(id => deleteDoc(doc(db, menuPath(placeId), id))));
    await incrementMenuVersion(placeId);
    setDeleteConfirm(null);
  };

  const updateSectorId = async (nodeId: string, sectorId: string) => {
    await updateDoc(doc(db, menuPath(placeId), nodeId), { sectorId });
    await incrementMenuVersion(placeId);
    setSectorPickerOpen(null);
  };

  const loadSampleMenu = async () => {
    if (!placeId) return;
    setLoadingSample(true);
    try {
      for (let catIdx = 0; catIdx < MENU.length; catIdx++) {
        const cat = MENU[catIdx];
        const catRef = await addDoc(collection(db, menuPath(placeId)), {
          type: "category",
          name: cat.name,
          emoji: cat.emoji ?? null,
          price: null,
          sectorId: null,
          parentId: null,
          order: catIdx,
          createdAt: Date.now(),
        });
        for (let subIdx = 0; subIdx < cat.subcategories.length; subIdx++) {
          const sub = cat.subcategories[subIdx];
          const subRef = await addDoc(collection(db, menuPath(placeId)), {
            type: "category",
            name: sub.name,
            emoji: (sub as any).emoji ?? null,
            price: null,
            sectorId: null,
            parentId: catRef.id,
            order: subIdx,
            createdAt: Date.now(),
          });
          for (let itemIdx = 0; itemIdx < sub.items.length; itemIdx++) {
            const item = sub.items[itemIdx];
            await addDoc(collection(db, menuPath(placeId)), {
              type: "item",
              name: item.name,
              emoji: null,
              price: item.price,
              sectorId: sectors[0]?.id ?? null,
              parentId: subRef.id,
              order: itemIdx,
              createdAt: Date.now(),
            });
          }
        }
      }
      await incrementMenuVersion(placeId);
    } finally {
      setLoadingSample(false);
      setShowSampleModal(false);
    }
  };

  const moveNode = async (node: MenuNode, direction: "up" | "down") => {
    const siblings = getSiblings(nodes, node.parentId);
    const idx = siblings.findIndex(n => n.id === node.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const target = siblings[targetIdx];
    await Promise.all([
      updateDoc(doc(db, menuPath(placeId), node.id), { order: target.order }),
      updateDoc(doc(db, menuPath(placeId), target.id), { order: node.order }),
    ]);
    await incrementMenuVersion(placeId);
  };

  const renderChildren = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = getSiblings(nodes, parentId);
    if (children.length === 0) return null;

    return children.map(node => {
      const isItem = node.type === "item";
      const isCollapsed = collapsed[node.id];

      return (
        <View key={node.id} style={{ marginLeft: depth * 14, marginBottom: 6 }}>
          <View style={[styles.rowOuter, { backgroundColor: D.rowOuter, borderColor: D.rowBorder }]}>
            <View style={styles.row}>
              {!isItem ? (
                <Pressable onPress={() => toggleCollapse(node.id)} style={styles.collapseBtn}>
                  <Ionicons name={isCollapsed ? "chevron-forward" : "chevron-down"} size={14} color="#888" />
                </Pressable>
              ) : null}

              {!isItem && node.parentId === null && (
                <Pressable onPress={() => openEditModal(node)} style={styles.emojiBtn}>
                  {node.emoji?.includes("-")
                    ? <Ionicons name={node.emoji as keyof typeof Ionicons.glyphMap} size={18} color={primaryColor} />
                    : <Text style={styles.emoji}>{node.emoji || "📁"}</Text>}
                </Pressable>
              )}

              <TextInput
                style={[styles.nameInput, isItem && styles.itemNameInput, { color: isItem ? D.itemName : D.nameInput }]}
                value={node.name}
                onChangeText={text => updateName(node.id, text)}
              />

              {isItem && (
                <TextInput
                  style={[styles.priceInput, { color: D.priceInput, borderColor: D.priceInputBorder, backgroundColor: D.rowOuter }]}
                  value={localPrices[node.id] ?? node.price?.toString() ?? ""}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={D.placeholder}
                  onChangeText={text => setLocalPrices(p => ({ ...p, [node.id]: text }))}
                  onBlur={() => {
                    const raw = localPrices[node.id];
                    if (raw === undefined) return;
                    const val = parseFloat(raw.replace(",", "."));
                    if (!isNaN(val)) updatePrice(node.id, val);
                    setLocalPrices(p => { const n = { ...p }; delete n[node.id]; return n; });
                  }}
                />
              )}

              {isItem && sectors.length > 0 && (
                <Pressable
                  onPress={() => setSectorPickerOpen(sectorPickerOpen === node.id ? null : node.id)}
                  style={[styles.sectorChip, { backgroundColor: D.sectorChip, borderColor: D.sectorChipBorder }, node.sectorId ? styles.sectorChipActive : undefined]}
                >
                  <Ionicons
                    name={(sectors.find(s => s.id === node.sectorId)?.icon as any) || "help-circle-outline"}
                    size={14}
                    color={node.sectorId ? primaryColor : "#aaa"}
                  />
                </Pressable>
              )}

              {!isItem && (
                <Pressable onPress={() => openAddModal(node.id)} style={styles.addBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              )}

              <Pressable onPress={() => moveNode(node, "up")} style={[styles.moveBtn, { backgroundColor: D.moveBtn }]}>
                <Ionicons name="arrow-up" size={14} color={D.moveBtnIcon} />
              </Pressable>
              <Pressable onPress={() => moveNode(node, "down")} style={[styles.moveBtn, { backgroundColor: D.moveBtn }]}>
                <Ionicons name="arrow-down" size={14} color={D.moveBtnIcon} />
              </Pressable>
              <Pressable onPress={() => deleteNode(node)} style={styles.deleteBtn}>
                <Ionicons name="trash" size={14} color="#ef4444" />
              </Pressable>
            </View>
          </View>

          {isItem && sectorPickerOpen === node.id && sectors.length > 0 && (
            <View style={styles.inlineSectorPicker}>
              {sectors.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => updateSectorId(node.id, s.id)}
                  style={[styles.inlineSectorBtn, node.sectorId === s.id && styles.inlineSectorBtnActive]}
                >
                  <Ionicons
                    name={(s.icon as any) || "wine-outline"}
                    size={14}
                    color={node.sectorId === s.id ? "#fff" : "#555"}
                  />
                  <Text style={[styles.inlineSectorLabel, node.sectorId === s.id && { color: "#fff" }]}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {!isItem && !isCollapsed && renderChildren(node.id, depth + 1)}
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: D.root }}>
      {/* ── HEADER ── */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: D.headerBg,
        paddingHorizontal: 8, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: D.headerBorder,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
      }}>
        <Pressable onPress={onMenuPress} hitSlop={12} style={{ padding: 6 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: D.hamburgerBox, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="menu" size={20} color={primaryColor} />
          </View>
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: D.headerTitle, letterSpacing: -0.3 }}>Meni</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {!placeId ? (
            <Text style={{ color: D.emptyText, textAlign: "center", marginTop: 32 }}>Učitavanje...</Text>
          ) : (
            <>
              {renderChildren(null)}
              <Pressable onPress={() => openAddModal(null)} style={styles.newRootBtn}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.newRootBtnText}>Nova kategorija</Text>
                </View>
              </Pressable>
              {nodes.length === 0 && (
                <Pressable onPress={() => setShowSampleModal(true)} style={styles.sampleBtn}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="sparkles-outline" size={18} color={primaryColor} />
                    <Text style={styles.sampleBtnText}>Učitaj primjer menija</Text>
                  </View>
                </Pressable>
              )}
            </>
          )}
      </ScrollView>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModal(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: D.modalBox }]} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {modal?.mode === "edit"
                ? `Uredi: ${(modal as any).node.name}`
                : modal?.mode === "add" && modal.parentId === null
                ? "Nova kategorija"
                : "Dodaj unutar kategorije"}
            </Text>

            {modal?.mode === "add" && (
              <View style={styles.typeRow}>
                <Pressable
                  onPress={() => setModalType("category")}
                  style={[styles.typeBtn, { borderColor: D.typeBtnBorder }, modalType === "category" && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, { color: D.typeBtnText }, modalType === "category" && { color: "#fff" }]}>
                    Kategorija
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setModalType("item")}
                  style={[styles.typeBtn, { borderColor: D.typeBtnBorder }, modalType === "item" && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, { color: D.typeBtnText }, modalType === "item" && { color: "#fff" }]}>
                    Artikal
                  </Text>
                </Pressable>
              </View>
            )}

            {modalType === "category" &&
              (modal?.mode === "add" ? modal.parentId === null : (modal as any)?.node?.parentId === null) && (
                <>
                  <Text style={[styles.fieldLabel, { color: D.fieldLabel }]}>Ikona kategorije (opciono)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={[styles.iconPickerScroll, { backgroundColor: D.iconPickerScroll, borderColor: D.iconPickerBorder }]}
                    contentContainerStyle={styles.iconPickerRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {CATEGORY_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        style={[styles.iconPickerItem, { backgroundColor: D.iconPickerItem, borderColor: D.iconPickerItemBorder }, modalEmoji === ic && styles.iconPickerItemActive]}
                        onPress={() => setModalEmoji(modalEmoji === ic ? "" : ic)}
                      >
                        <Ionicons name={ic} size={22} color={modalEmoji === ic ? "#fff" : "#555"} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

            <Text style={[styles.fieldLabel, { color: D.fieldLabel }]}>Naziv</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: D.modalInput, borderColor: D.modalInputBorder, color: D.modalInputText }]}
              value={modalName}
              onChangeText={setModalName}
              placeholder="Unesite naziv..."
              placeholderTextColor={D.placeholder}
              autoFocus
            />

            {modalType === "item" && (
              <>
                <Text style={[styles.fieldLabel, { color: D.fieldLabel }]}>Cijena (KM)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: D.modalInput, borderColor: D.modalInputBorder, color: D.modalInputText }]}
                  value={modalPrice}
                  onChangeText={setModalPrice}
                  placeholder="0.00"
                  placeholderTextColor={D.placeholder}
                  keyboardType="numeric"
                />
                {sectors.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { color: D.fieldLabel }]}>Sektor</Text>
                    <View style={styles.sectorPicker}>
                      {sectors.map(s => (
                        <Pressable
                          key={s.id}
                          onPress={() => setModalSectorId(s.id)}
                          style={[styles.sectorPickerBtn, modalSectorId === s.id && styles.sectorPickerBtnActive]}
                        >
                          <Text style={[styles.sectorPickerText, modalSectorId === s.id && { color: "#fff" }]}>
                            {s.icon ? <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={14} color={modalSectorId === s.id ? "#fff" : "#555"} /> : null}{" "}{s.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(null)} style={[styles.cancelBtn, { backgroundColor: D.cancelBtn }]}>
                <Text style={[styles.cancelBtnText, { color: D.cancelBtnText }]}>Otkaži</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>
                  {modal?.mode === "edit" ? "Spremi" : "Dodaj"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Sample menu confirmation modal */}
      <Modal visible={showSampleModal} transparent animationType="fade" onRequestClose={() => setShowSampleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !loadingSample && setShowSampleModal(false)}>
          <Pressable style={[styles.modalBox, { backgroundColor: D.modalBox }]} onPress={e => e.stopPropagation()}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="sparkles" size={36} color={primaryColor} />
            </View>
            <Text style={styles.modalTitle}>Primjer menija</Text>
            <Text style={{ fontSize: 14, color: D.sampleText, marginBottom: 20, lineHeight: 20 }}>
              Ovo će dodati kompletan primjer menija (kafić/bar) sa kategorijama, potkategorijama i artiklima.
              {"\n\n"}Artiklima će biti dodijeljen prvi dostupni sektor.
            </Text>
            {loadingSample ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={{ marginTop: 10, color: D.sampleText, fontSize: 13 }}>Dodavanje artikala...</Text>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowSampleModal(false)} style={[styles.cancelBtn, { backgroundColor: D.cancelBtn }]}>
                  <Text style={[styles.cancelBtnText, { color: D.cancelBtnText }]}>Otkaži</Text>
                </Pressable>
                <Pressable onPress={loadSampleMenu} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Učitaj</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Delete confirmation modal */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteConfirm(null)}>
          <Pressable style={[styles.modalBox, { backgroundColor: D.modalBox }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: "#ef4444" }]}>Brisanje</Text>
            <Text style={{ fontSize: 15, color: D.deleteConfirmText, marginBottom: 20 }}>
              Obrisati "{deleteConfirm?.name}"
              {deleteConfirm?.type === "category" ? " i sve unutra?" : "?"}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteConfirm(null)} style={[styles.cancelBtn, { backgroundColor: D.cancelBtn }]}>
                <Text style={[styles.cancelBtnText, { color: D.cancelBtnText }]}>Otkaži</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={[styles.saveBtn, { backgroundColor: "#ef4444" }]}>
                <Text style={styles.saveBtnText}>Obriši</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  header: { fontSize: 18, fontWeight: "700", color: p, marginBottom: 16 },
  rowOuter: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  nodeControls: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  collapseBtn: { padding: 4 },
  collapseIcon: { fontSize: 12, color: "#888", width: 16 },
  bullet: { fontSize: 16, color: "#aaa", width: 20, textAlign: "center" },
  emojiBtn: { paddingHorizontal: 2 },
  emoji: { fontSize: 18 },
  iconPickerScroll: {
    backgroundColor: "#f0fafb", borderRadius: 10,
    borderWidth: 1, borderColor: "#b2dfdf", marginBottom: 12,
  },
  iconPickerRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  iconPickerItem: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: "#ddd",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  iconPickerItemActive: { backgroundColor: p, borderColor: p },
  nameInput: { flex: 1, flexShrink: 1, minWidth: 60, fontSize: 14, paddingVertical: 4, paddingHorizontal: 6, color: "#1a1a1a", fontWeight: "500" },
  itemNameInput: { color: "#555", fontWeight: "400" },
  priceInput: {
    width: 56, fontSize: 13, paddingVertical: 4, paddingHorizontal: 6,
    borderWidth: 1, borderColor: "#ddd", borderRadius: 6, textAlign: "right", color: "#333",
  },
  addBtn: {
    backgroundColor: p, borderRadius: 6, width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontSize: 16, lineHeight: 20 },
  moveBtn: {
    backgroundColor: "#e8e8e8", borderRadius: 6, width: 26, height: 26,
    alignItems: "center", justifyContent: "center",
  },
  moveBtnText: { fontSize: 13, color: "#555" },
  deleteBtn: {
    backgroundColor: "#fee2e2", borderRadius: 6, width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  deleteBtnText: { fontSize: 14 },
  sectorChip: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: "#ddd",
    alignItems: "center", justifyContent: "center", backgroundColor: "#f9f9f9",
  },
  sectorChipActive: { borderColor: p, backgroundColor: "#e8f8f9" },
  inlineSectorPicker: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4,
  },
  inlineSectorBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff",
  },
  inlineSectorBtnActive: { backgroundColor: p, borderColor: p },
  inlineSectorLabel: { fontSize: 12, color: "#555" },
  newRootBtn: {
    marginTop: 20, backgroundColor: p, padding: 14,
    borderRadius: 10, alignItems: "center",
  },
  newRootBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sampleBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: p, borderStyle: "dashed",
    padding: 14, borderRadius: 10, alignItems: "center", backgroundColor: "#f0fafb",
  },
  sampleBtnText: { color: p, fontWeight: "700", fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: p, marginBottom: 16 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  typeBtnActive: { backgroundColor: p, borderColor: p },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "#555" },
  fieldLabel: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 8 },
  modalInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: "#fafafa",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#f0f0f0" },
  cancelBtnText: { color: "#555", fontWeight: "600" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: p },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  sectorPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  sectorPickerBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff",
  },
  sectorPickerBtnActive: { backgroundColor: p, borderColor: p },
  sectorPickerText: { fontSize: 13, fontWeight: "600", color: "#555" },
});
