// app/screens/Admin.tsx
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React, { useEffect, useState } from "react";
import { getItem } from "./helper";
import useAuth from "./hooks/useAuth";
import AdminDashboard from "./screens/admin/AdminDashboard";
import AdminPlaceSettings from "./screens/admin/AdminPlaceSettings";
import AdminSettings from "./screens/admin/AdminSettings";

const Tab = createBottomTabNavigator();

export default function AdminScreen() {
  useAuth("admin");
  const [placeId, setPlaceId] = useState("");

  useEffect(() => {
    getItem("@placeId").then(id => {
      if (id) setPlaceId(id);
    });
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#0E7C86",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: { height: 62, paddingBottom: 8 },
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
        {() => <AdminDashboard placeId={placeId} />}
      </Tab.Screen>
      <Tab.Screen name="Meni">
        {() => <AdminSettings placeId={placeId} />}
      </Tab.Screen>
      <Tab.Screen name="Postavke">
        {() => <AdminPlaceSettings placeId={placeId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
