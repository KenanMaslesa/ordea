import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { db, placesRoot } from "../firebase";
import SideDrawer from "./components/SideDrawer";
import { useTheme } from "./context/ThemeContext";
import { getItem } from "./helper";
import useAuth from "./hooks/useAuth";
import AdminDashboard from "./screens/admin/AdminDashboard";
import AdminPlaceSettings from "./screens/admin/AdminPlaceSettings";
import AdminSettings from "./screens/admin/AdminSettings";
import { Sector } from "./types/order.types";

const Tab = createBottomTabNavigator();

export default function AdminScreen() {
  useAuth("admin");
  const [placeId, setPlaceId] = useState("");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { darkMode, primaryColor } = useTheme();

  useEffect(() => {
    getItem("@placeId").then(id => {
      if (id) setPlaceId(id);
    });
  }, []);

  useEffect(() => {
    if (!placeId) return;
    const unsub = onSnapshot(doc(db, placesRoot(), placeId), d => {
      if (d.exists()) setSectors((d.data().sectors as Sector[]) ?? []);
    });
    return unsub;
  }, [placeId]);

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#111827" : undefined }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: darkMode ? "#6B7280" : "#999",
          tabBarStyle: {
            height: 62,
            paddingBottom: 8,
            backgroundColor: darkMode ? "#1F2937" : "#fff",
            borderTopColor: darkMode ? "#374151" : "#E5E7EB",
          },
          tabBarLabelStyle: { fontSize: 11 },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Dashboard: "bar-chart-outline",
              Meni: "restaurant-outline",
              Postavke: "settings-outline",
            };
            return <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard">
          {() => <AdminDashboard placeId={placeId} onMenuPress={() => setDrawerOpen(true)} />}
        </Tab.Screen>
        <Tab.Screen name="Meni">
          {() => <AdminSettings placeId={placeId} onMenuPress={() => setDrawerOpen(true)} />}
        </Tab.Screen>
        <Tab.Screen name="Postavke">
          {() => <AdminPlaceSettings placeId={placeId} onMenuPress={() => setDrawerOpen(true)} />}
        </Tab.Screen>
      </Tab.Navigator>


      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role="admin"
        placeId={placeId}
        sectors={sectors}
        isAdminPreview={false}
      />
    </View>
  );
}
