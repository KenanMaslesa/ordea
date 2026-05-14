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
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

export default function AdminSettings({ placeId }: Props) {
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
          <View style={[styles.rowOuter]}>
            <View style={styles.row}>
              {!isItem ? (
                <Pressable onPress={() => toggleCollapse(node.id)} style={styles.collapseBtn}>
                  <Ionicons name={isCollapsed ? "chevron-forward" : "chevron-down"} size={14} color="#888" />
                </Pressable>
              ) : null}

              {!isItem && node.parentId === null && (
                <Pressable onPress={() => openEditModal(node)} style={styles.emojiBtn}>
                  {node.emoji?.includes("-")
                    ? <Ionicons name={node.emoji as keyof typeof Ionicons.glyphMap} size={18} color="#0E7C86" />
                    : <Text style={styles.emoji}>{node.emoji || "📁"}</Text>}
                </Pressable>
              )}

              <TextInput
                style={[styles.nameInput, isItem && styles.itemNameInput]}
                value={node.name}
                onChangeText={text => updateName(node.id, text)}
              />

              {isItem && (
                <TextInput
                  style={styles.priceInput}
                  value={localPrices[node.id] ?? node.price?.toString() ?? ""}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
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
                  style={[styles.sectorChip, node.sectorId ? styles.sectorChipActive : undefined]}
                >
                  <Ionicons
                    name={(sectors.find(s => s.id === node.sectorId)?.icon as any) || "help-circle-outline"}
                    size={14}
                    color={node.sectorId ? "#0E7C86" : "#aaa"}
                  />
                </Pressable>
              )}

              {!isItem && (
                <Pressable onPress={() => openAddModal(node.id)} style={styles.addBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              )}

              <Pressable onPress={() => moveNode(node, "up")} style={styles.moveBtn}>
                <Ionicons name="arrow-up" size={14} color="#555" />
              </Pressable>
              <Pressable onPress={() => moveNode(node, "down")} style={styles.moveBtn}>
                <Ionicons name="arrow-down" size={14} color="#555" />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, minWidth: 420 }}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.header}>Upravljanje menijem</Text>

          {!placeId ? (
            <Text style={{ color: "#888", textAlign: "center", marginTop: 32 }}>Učitavanje...</Text>
          ) : (
            <>
              {renderChildren(null)}
              <Pressable onPress={() => openAddModal(null)} style={styles.newRootBtn}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.newRootBtnText}>Nova kategorija</Text>
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>
      </ScrollView>

      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModal(null)}>
          <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {modal?.mode === "edit"
                ? `Uredi: ${modal.node.name}`
                : modal?.parentId === null
                ? "Nova kategorija"
                : "Dodaj unutar kategorije"}
            </Text>

            {modal?.mode === "add" && (
              <View style={styles.typeRow}>
                <Pressable
                  onPress={() => setModalType("category")}
                  style={[styles.typeBtn, modalType === "category" && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, modalType === "category" && { color: "#fff" }]}>
                    Kategorija
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setModalType("item")}
                  style={[styles.typeBtn, modalType === "item" && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, modalType === "item" && { color: "#fff" }]}>
                    Artikal
                  </Text>
                </Pressable>
              </View>
            )}

            {modalType === "category" &&
              (modal?.mode === "add" ? modal.parentId === null : (modal as any)?.node?.parentId === null) && (
                <>
                  <Text style={styles.fieldLabel}>Ikona kategorije (opciono)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.iconPickerScroll}
                    contentContainerStyle={styles.iconPickerRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {CATEGORY_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        style={[styles.iconPickerItem, modalEmoji === ic && styles.iconPickerItemActive]}
                        onPress={() => setModalEmoji(modalEmoji === ic ? "" : ic)}
                      >
                        <Ionicons name={ic} size={22} color={modalEmoji === ic ? "#fff" : "#555"} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

            <Text style={styles.fieldLabel}>Naziv</Text>
            <TextInput
              style={styles.modalInput}
              value={modalName}
              onChangeText={setModalName}
              placeholder="Unesite naziv..."
              autoFocus
            />

            {modalType === "item" && (
              <>
                <Text style={styles.fieldLabel}>Cijena (KM)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={modalPrice}
                  onChangeText={setModalPrice}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
                {sectors.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>Sektor</Text>
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
              <Pressable onPress={() => setModal(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Otkaži</Text>
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
      {/* Delete confirmation modal */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteConfirm(null)}>
          <Pressable style={styles.modalBox} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: "#ef4444" }]}>Brisanje</Text>
            <Text style={{ fontSize: 15, color: "#333", marginBottom: 20 }}>
              Obrisati "{deleteConfirm?.name}"
              {deleteConfirm?.type === "category" ? " i sve unutra?" : "?"}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteConfirm(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Otkaži</Text>
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

const styles = StyleSheet.create({
  header: { fontSize: 18, fontWeight: "700", color: "#0E7C86", marginBottom: 16 },
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
  iconPickerItemActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  nameInput: { flex: 1, flexShrink: 1, minWidth: 60, fontSize: 14, paddingVertical: 4, paddingHorizontal: 6, color: "#1a1a1a", fontWeight: "500" },
  itemNameInput: { color: "#555", fontWeight: "400" },
  priceInput: {
    width: 56, fontSize: 13, paddingVertical: 4, paddingHorizontal: 6,
    borderWidth: 1, borderColor: "#ddd", borderRadius: 6, textAlign: "right", color: "#333",
  },
  addBtn: {
    backgroundColor: "#0E7C86", borderRadius: 6, width: 28, height: 28,
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
  sectorChipActive: { borderColor: "#0E7C86", backgroundColor: "#e8f8f9" },
  inlineSectorPicker: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4,
  },
  inlineSectorBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff",
  },
  inlineSectorBtnActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  inlineSectorLabel: { fontSize: 12, color: "#555" },
  newRootBtn: {
    marginTop: 20, backgroundColor: "#0E7C86", padding: 14,
    borderRadius: 10, alignItems: "center",
  },
  newRootBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0E7C86", marginBottom: 16 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "#555" },
  fieldLabel: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 8 },
  modalInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: "#fafafa",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#f0f0f0" },
  cancelBtnText: { color: "#555", fontWeight: "600" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: "#0E7C86" },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  sectorPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  sectorPickerBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff",
  },
  sectorPickerBtnActive: { backgroundColor: "#0E7C86", borderColor: "#0E7C86" },
  sectorPickerText: { fontSize: 13, fontWeight: "600", color: "#555" },
});
