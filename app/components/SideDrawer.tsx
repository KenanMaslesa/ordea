import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { getItem, setItem } from "../helper";
import { Sector } from "../types/order.types";

const DRAWER_W = 295;

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  role: "admin" | "waiter" | "bartender";
  placeId: string;
  sectors?: Sector[];
  currentSectorIds?: string[];
  onNameChange?: (name: string) => void;
  /** Pass when admin is in waiter/bartender preview mode — shows "← Admin" button */
  isAdminPreview?: boolean;
  /** Called when user taps Postavke — caller navigates to settings screen */
  onSettingsPress?: () => void;
}

export default function SideDrawer({
  isOpen,
  onClose,
  role,
  placeId,
  sectors = [],
  currentSectorIds = [],
  onNameChange,
  isAdminPreview = false,
  onSettingsPress,
}: SideDrawerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const { darkMode, setDarkMode } = useTheme();

  const D = darkMode ? {
    drawer: "#1F2937",
    header: "#111827",
    headerBorder: "#374151",
    profileBorder: "#374151",
    divider: "#374151",
    sectionLabel: "#6B7280",
    menuItemText: "#E5E7EB",
    menuItemActive: "rgba(14,124,134,0.18)",
    closeIcon: "#9CA3AF",
    nameText: "#F9FAFB",
    nameInputBorder: "#0E7C86",
    nameInputText: "#F9FAFB",
    nameInputPlaceholder: "#6B7280",
  } : {
    drawer: "#FFFFFF",
    header: "#FFFFFF",
    headerBorder: "#F4F4F5",
    profileBorder: "#F4F4F5",
    divider: "#F4F4F5",
    sectionLabel: "#A1A1AA",
    menuItemText: "#18181B",
    menuItemActive: "#F0FDFA",
    closeIcon: "#71717A",
    nameText: "#09090B",
    nameInputBorder: "#0E7C86",
    nameInputText: "#09090B",
    nameInputPlaceholder: "#A1A1AA",
  };

  const [adminName, setAdminName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // non-admin name (waiter / bartender)
  const [workerName, setWorkerName] = useState("");

  useEffect(() => {
    (async () => {
      if (role === "admin") {
        // Fall back to @waiterName in case name was set via the name modal
        const n = (await getItem("@adminName")) || (await getItem("@waiterName"));
        setAdminName(n || "");
      } else {
        const n = await getItem("@waiterName");
        setWorkerName(n || "");
      }
    })();
  }, []);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }),
        Animated.timing(backdropAnim, { toValue: 0.45, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_W, duration: 180, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await setItem("@adminName", trimmed);
    await setItem("@waiterName", trimmed);
    setAdminName(trimmed);
    onNameChange?.(trimmed);
    setEditingName(false);
  };

  const goAdmin = () => {
    onClose();
    router.replace("/admin");
  };

  const goWaiter = async () => {
    const name = adminName || "Admin";
    await setItem("@waiterName", name);
    onClose();
    router.replace("/waiter");
  };

  const goSector = async (sectorId: string) => {
    await setItem("@sectorIds", JSON.stringify([sectorId]));
    onClose();
    router.replace("/bartender");
  };

  const shareApp = () => {
    Share.share({ message: "Ordea — digitalni sistem narudžbi za ugostiteljstvo. Brža usluga, manje grešaka." });
  };

  const displayName = role === "admin" ? (adminName || "") : workerName;
  const roleLabel = role === "admin" ? "Admin" : role === "waiter" ? "Konobar" : "Šanker";

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { paddingTop: insets.top, transform: [{ translateX: slideAnim }], backgroundColor: D.drawer }]}>
        {/* App header */}
        <View style={[styles.drawerHeader, { borderBottomColor: D.headerBorder, backgroundColor: D.header }]}>
          <Text style={styles.appName}>Ordea</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={D.closeIcon} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

          {/* Profile */}
          <View style={[styles.profileSection, { borderBottomColor: D.profileBorder }]}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {role === "admin" && editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    style={[styles.nameInput, { borderBottomColor: D.nameInputBorder, color: D.nameInputText }]}
                    placeholder="Tvoje ime"
                    placeholderTextColor={D.nameInputPlaceholder}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={saveName}
                  />
                  <Pressable onPress={saveName} hitSlop={10}>
                    <Ionicons name="checkmark-circle" size={22} color="#0E7C86" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.nameRow}
                  onPress={role === "admin" ? () => { setNameInput(adminName); setEditingName(true); } : undefined}
                  disabled={role !== "admin"}
                >
                  <Text style={[styles.profileName, { color: D.nameText }]} numberOfLines={1}>
                    {displayName || (role === "admin" ? "Postavi ime" : "")}
                  </Text>
                  {role === "admin" && (
                    <Ionicons name="pencil-outline" size={13} color="#A1A1AA" style={{ marginLeft: 5 }} />
                  )}
                </Pressable>
              )}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          {/* Admin: back to panel / sector switching */}
          {role === "admin" && (
            <>
              {isAdminPreview && (
                <>
                  <Pressable style={styles.menuItem} onPress={goAdmin}>
                    <View style={[styles.menuIcon, { backgroundColor: "#F4F4F5" }]}>
                      <Ionicons name="grid-outline" size={18} color="#52525B" />
                    </View>
                    <Text style={styles.menuItemText}>Admin panel</Text>
                    <Ionicons name="chevron-forward" size={15} color="#D4D4D8" />
                  </Pressable>
                  <View style={styles.divider} />
                </>
              )}

              <Text style={styles.sectionLabel}>RADI KAO</Text>

              <Pressable style={styles.menuItem} onPress={goWaiter}>
                <View style={[styles.menuIcon, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="person-outline" size={18} color="#16A34A" />
                </View>
                <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Konobar</Text>
                <Ionicons name="chevron-forward" size={15} color="#D4D4D8" />
              </Pressable>

              {sectors.map(s => (
                <Pressable
                  key={s.id}
                  style={[styles.menuItem, currentSectorIds.includes(s.id) && { backgroundColor: D.menuItemActive }]}
                  onPress={() => goSector(s.id)}
                >
                  <View style={[styles.menuIcon, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons
                      name={(s.emoji as keyof typeof Ionicons.glyphMap) ?? "storefront-outline"}
                      size={18}
                      color="#2563EB"
                    />
                  </View>
                  <Text style={[styles.menuItemText, { color: D.menuItemText }]}>{s.name}</Text>
                  {currentSectorIds.includes(s.id) && (
                    <View style={styles.activeDot} />
                  )}
                  <Ionicons name="chevron-forward" size={15} color="#D4D4D8" />
                </Pressable>
              ))}

              <View style={[styles.divider, { backgroundColor: D.divider }]} />
            </>
          )}

          {/* Common options */}
          <Text style={[styles.sectionLabel, { color: D.sectionLabel }]}>OPCIJE</Text>

          {/* Dark mode toggle */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: darkMode ? "#374151" : "#F1F5F9" }]}>
              <Ionicons name={darkMode ? "moon" : "sunny-outline"} size={18} color={darkMode ? "#93C5FD" : "#F59E0B"} />
            </View>
            <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Dark mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#D1D5DB", true: "#0E7C86" }}
              thumbColor="#fff"
              ios_backgroundColor="#D1D5DB"
            />
          </View>
          {onSettingsPress && (
            <Pressable style={styles.menuItem} onPress={() => { onClose(); onSettingsPress(); }}>
              <View style={[styles.menuIcon, { backgroundColor: "#F0FDFA" }]}>
                <Ionicons name="settings-outline" size={18} color="#0E7C86" />
              </View>
              <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Postavke</Text>
            </Pressable>
          )}
          <Pressable style={styles.menuItem} onPress={shareApp}>
            <View style={[styles.menuIcon, { backgroundColor: "#F5F3FF" }]}>
              <Ionicons name="share-social-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Podijeli aplikaciju</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              /* otvori link za ocjenu kad app bude na storeu */
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons name="star-outline" size={18} color="#D97706" />
            </View>
            <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Ocijeni aplikaciju</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              /* mailto ili feedback form */
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#F0FDF4" }]}>
              <Ionicons name="bulb-outline" size={18} color="#16A34A" />
            </View>
            <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Predloži funkcionalnost</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              /* mailto ili feedback form */
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="bug-outline" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, { color: D.menuItemText }]}>Prijavi grešku</Text>
          </Pressable>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0E7C86",
    letterSpacing: -0.5,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
    marginBottom: 4,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0E7C86",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: "#0E7C86",
    paddingVertical: 2,
    fontSize: 15,
    color: "#09090B",
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#09090B",
  },
  roleBadge: {
    backgroundColor: "#F0FDFA",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0E7C86",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A1A1AA",
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuItemActive: {
    backgroundColor: "#F0FDFA",
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#18181B",
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0E7C86",
    marginRight: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#F4F4F5",
    marginTop: 8,
  },
});
