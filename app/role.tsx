// app/role.tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { setItem } from "./helper";

export default function RoleScreen() {
  const router = useRouter();

  const selectRole = async (role: "waiter" | "bartender") => {
    await setItem("@role", role);
    router.replace(`/${role}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Odaberi rolu</Text>
      <Pressable style={styles.btn} onPress={() => selectRole("waiter")}>
        <Text style={styles.btnText}>Konobar</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => selectRole("bartender")}>
        <Text style={styles.btnText}>Sanker</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 32 },
  btn: {
    backgroundColor: "#0E7C86",
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    width: "80%",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
