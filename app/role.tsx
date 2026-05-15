// app/role.tsx
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "./context/ThemeContext";
import { setItem } from "./helper";

export default function RoleScreen() {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);
  const { t } = useTranslation();

  const selectRole = async (role: "waiter" | "bartender") => {
    await setItem("@role", role);
    router.replace(`/${role}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("role.title")}</Text>
      <Pressable style={styles.btn} onPress={() => selectRole("waiter")}>
        <Text style={styles.btnText}>{t("role.waiter")}</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => selectRole("bartender")}>
        <Text style={styles.btnText}>{t("role.bartender")}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 32 },
  btn: {
    backgroundColor: p,
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    width: "80%",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
