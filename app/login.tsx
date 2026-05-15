import { auth } from "@/firebase";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "./context/ThemeContext";
import { setItem } from "./helper";
import { getAdminPlace } from "./services/place.service";

export default function LoginScreen() {
  const router = useRouter();
  const { darkMode, primaryColor } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const D = darkMode ? {
    wrapper: "#111827",
    subtitle: "#9CA3AF",
    input: "#1F2937",
    inputBorder: "#374151",
    inputText: "#E5E7EB",
    placeholder: "#6B7280",
    link: "#22D3EE",
    linkBack: "#6B7280",
  } : {
    wrapper: "#F4F5F7",
    subtitle: "#888",
    input: "#fff",
    inputBorder: "#ddd",
    inputText: "#18181B",
    placeholder: "#A1A1AA",
    link: primaryColor,
    linkBack: "#aaa",
  };

  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const handleLogin = async () => {
    if (!email || !password)
      return Alert.alert(t("common.error"), t("auth.login.errorEmpty"));

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      const place = await getAdminPlace(uid);

      await setItem("@loggedIn", "true");
      await setItem("@role", "admin");

      if (place) {
        await setItem("@placeId", place.id);
        router.replace("/admin");
      } else {
        // Logged in but no place created yet — go to registration to finish setup
        router.replace("/register");
      }
    } catch (err: any) {
      Alert.alert(t("auth.login.errorFailed"), err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.wrapper, { backgroundColor: D.wrapper }]}
    >
      <View style={[styles.container, { backgroundColor: D.wrapper }]}>
        <Text style={styles.title}>{t("auth.login.title")}</Text>
        <Text style={[styles.subtitle, { color: D.subtitle }]}>{t("auth.login.subtitle")}</Text>

        <TextInput
          style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          placeholder={t("auth.login.email")}
          placeholderTextColor={D.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          placeholder={t("auth.login.password")}
          placeholderTextColor={D.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? t("auth.login.submitting") : t("auth.login.submit")}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/register")} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: D.link }]}>{t("auth.login.noAccount")}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/join")} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: D.linkBack }]}>{t("auth.login.backToJoin")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F5F7" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  title: { fontSize: 28, fontWeight: "800", color: p, marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#888", marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  btn: {
    backgroundColor: p,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: p, fontSize: 14 },
});
