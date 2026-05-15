import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "./context/ThemeContext";
import MyOrdersScreen from "./screens/MyOrdersScreen";

export default function ModalScreen() {
  const { darkMode } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: darkMode ? "#111827" : "#fff" }]}>
      <MyOrdersScreen waiterId="" darkMode={darkMode} />
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
