import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Order, Sector } from "../../types/order.types";
import { AppTheme } from "../../types/theme.types";

interface Props {
  order: Order;
  index: number;
  C: AppTheme;
  sectors: Sector[];
  mySectorIds: string[];
  timerIcon: ComponentProps<typeof Ionicons>["name"];
  timerColor: string;
  timerLabel: string;
  blink?: boolean;
  /** Provide to enable active mode (done button + other items). Omit for history mode. */
  onMarkDone?: () => void;
}

export default function OrderCard({
  order,
  index,
  C,
  sectors,
  mySectorIds,
  timerIcon,
  timerColor,
  timerLabel,
  blink = false,
  onMarkDone,
}: Props) {
  const [otherCollapsed, setOtherCollapsed] = useState(true);
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();

  const myItems =
    mySectorIds.length > 0
      ? order.items.filter(i => mySectorIds.includes(i.sectorId ?? ""))
      : order.items;

  const otherItems =
    mySectorIds.length > 0
      ? order.items.filter(i => !mySectorIds.includes(i.sectorId ?? ""))
      : [];

  const grouped = myItems.reduce<Record<string, typeof myItems>>((acc, item) => {
    const cat = item.category || t("orders.other");
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const isActive = onMarkDone !== undefined;

  return (
    <View style={[styles.card, blink && styles.cardAlert]}>
      {/* ── CARD HEADER ── */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          <View>
            <Text style={styles.waiterName}>{order.waiterName}</Text>
            {order.region ? <Text style={styles.regionText}>{order.region}</Text> : null}
          </View>
        </View>
        <View style={[styles.timerPill, { borderColor: timerColor }]}>
          <Ionicons name={timerIcon} size={13} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>{timerLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── MY ITEMS ── */}
      {Object.entries(grouped).map(([cat, items]) => (
        <View key={cat} style={styles.categoryBlock}>
          <Text style={styles.categoryLabel}>{cat.toUpperCase()}</Text>
          {items.map((item, ii) => (
            <View key={ii} style={styles.itemRow}>
              <Text
                style={[styles.itemName, item.qty > 1 && styles.itemNameHigh]}
                numberOfLines={2}
              >
                {item.name}
              </Text>
              <View style={[styles.qtyBadge, item.qty > 1 && styles.qtyBadgeHigh]}>
                <Text style={[styles.qtyText, item.qty > 1 && styles.qtyTextHigh]}>
                  ×{item.qty}
                </Text>
              </View>
            </View>
          ))}
          {items
            .filter(i => i.note)
            .map((item, ii) => (
              <View key={`note-${ii}`} style={styles.itemNote}>
                <Ionicons name="warning-outline" size={14} color={C.warn} />
                <Text style={styles.itemNoteText}>{item.note}</Text>
              </View>
            ))}
        </View>
      ))}

      {/* ── ORDER NOTE ── */}
      {order.orderNote ? (
        <View style={styles.orderNote}>
          <Ionicons name="document-text-outline" size={14} color={C.orderNoteText} />
          <Text style={styles.orderNoteText}>{order.orderNote}</Text>
        </View>
      ) : null}

      {/* ── OTHER ITEMS (active mode only) ── */}
      {isActive && otherItems.length > 0 && (
        <View style={styles.otherSection}>
          <Pressable
            onPress={() => setOtherCollapsed(p => !p)}
            style={styles.otherToggle}
            hitSlop={8}
          >
            <Ionicons
              name={otherCollapsed ? "chevron-forward" : "chevron-down"}
              size={14}
              color={C.textMuted}
            />
            <Text style={styles.otherToggleText}>
              {t("orders.otherItems", { count: otherItems.reduce((s, i) => s + i.qty, 0) })}
            </Text>
          </Pressable>
          {!otherCollapsed &&
            otherItems.map((item, ii) => {
              const sec = sectors.find(x => x.id === item.sectorId);
              return (
                <View key={ii} style={styles.otherRow}>
                  <Text style={styles.otherSector}>{sec?.name ?? "—"}</Text>
                  <Text style={styles.otherName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.otherQty}>×{item.qty}</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* ── DONE BUTTON (active mode only) ── */}
      {isActive && mySectorIds.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
          onPress={onMarkDone}
        >
          <Ionicons name="checkmark" size={20} color={C.white} />
          <Text style={styles.doneBtnText}>{t("orders.finish")}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ================= STYLES ================= */

const makeStyles = (C: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      ...Platform.select({
        android: { elevation: 4 },
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
      }),
    },
    cardAlert: {
      borderColor: C.danger,
      backgroundColor: C.cardAlertBg,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    indexBadge: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.surfaceHigh,
      alignItems: "center", justifyContent: "center",
    },
    indexText: { fontSize: 16, fontWeight: "800", color: C.textSub },
    waiterName: { fontSize: 17, fontWeight: "700", color: C.text },
    regionText: { fontSize: 12, color: C.textMuted, marginTop: 1 },
    timerPill: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20, borderWidth: 1.5,
      backgroundColor: "transparent",
    },
    timerText: { fontSize: 13, fontWeight: "700" },
    divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
    categoryBlock: { marginBottom: 10 },
    categoryLabel: {
      fontSize: 10, fontWeight: "800", color: C.textMuted,
      letterSpacing: 1.5, marginBottom: 6,
    },
    itemRow: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1, borderBottomColor: C.surfaceHigh,
    },
    itemName: {
      fontSize: 18, fontWeight: "600", color: C.text,
      flex: 1, marginRight: 12,
    },
    itemNameHigh: { color: C.danger, fontWeight: "700" },
    qtyBadge: {
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
      backgroundColor: "transparent", minWidth: 46, alignItems: "center",
      borderWidth: 1.5, borderColor: C.border,
    },
    qtyBadgeHigh: { backgroundColor: C.danger, borderColor: C.danger },
    qtyText: { fontSize: 14, fontWeight: "700", color: C.textMuted },
    qtyTextHigh: { color: "#FFFFFF", fontWeight: "900" },
    itemNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 6,
      backgroundColor: C.itemNoteBg, borderRadius: 8, padding: 8, marginTop: 6,
      borderWidth: 1, borderColor: C.itemNoteBorder,
    },
    itemNoteText: { fontSize: 13, fontWeight: "600", color: C.warn, flex: 1 },
    orderNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 6,
      backgroundColor: C.orderNoteBg, borderRadius: 8, padding: 10, marginTop: 10,
      borderWidth: 1, borderColor: C.orderNoteBorder,
    },
    orderNoteText: { fontSize: 13, fontWeight: "600", color: C.orderNoteText, flex: 1 },
    otherSection: {
      marginTop: 10, borderTopWidth: 1,
      borderTopColor: C.border, paddingTop: 10,
    },
    otherToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
    otherToggleText: { fontSize: 13, color: C.textMuted, fontWeight: "600" },
    otherRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 4 },
    otherSector: {
      fontSize: 11, fontWeight: "700", color: C.textMuted,
      backgroundColor: C.surfaceHigh,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden",
    },
    otherName: { fontSize: 13, color: C.textSub, flex: 1 },
    otherQty: { fontSize: 13, color: C.textMuted, fontWeight: "700" },
    doneBtn: {
      marginTop: 14, height: 54, borderRadius: 14,
      backgroundColor: C.accent,
      alignItems: "center", justifyContent: "center",
      flexDirection: "row", gap: 8,
    },
    doneBtnPressed: { backgroundColor: C.accentDim },
    doneBtnText: { color: C.white, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  });
