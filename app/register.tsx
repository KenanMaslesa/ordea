import { auth } from "@/firebase";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput
} from "react-native";
import { useTheme } from "./context/ThemeContext";
import { setItem } from "./helper";
import { createPlace } from "./services/place.service";

export default function RegisterScreen() {
  const router = useRouter();
  const { darkMode, primaryColor } = useTheme();

  const D = darkMode ? {
    wrapper: "#111827",
    subtitle: "#9CA3AF",
    label: "#D1D5DB",
    hint: "#6B7280",
    input: "#1F2937",
    inputBorder: "#374151",
    inputText: "#E5E7EB",
    placeholder: "#6B7280",
    link: "#22D3EE",
  } : {
    wrapper: "#F4F5F7",
    subtitle: "#666",
    label: "#444",
    hint: "#888",
    input: "#fff",
    inputBorder: "#ddd",
    inputText: "#18181B",
    placeholder: "#A1A1AA",
    link: primaryColor,
  };

  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = placeName.trim();

    if (!trimmedEmail || !password) {
      return Alert.alert("Greška", "Unesite email i lozinku.");
    }
    if (password.length < 6) {
      return Alert.alert("Greška", "Lozinka mora imati najmanje 6 znakova.");
    }
    if (!trimmedName) {
      return Alert.alert("Greška", "Unesite naziv objekta.");
    }

    setLoading(true);
    try {
      let uid = auth.currentUser?.uid;

      if (!uid) {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        uid = cred.user.uid;
      }

      const place = await createPlace(trimmedName);

      await setItem("@loggedIn", "true");
      await setItem("@role", "admin");
      await setItem("@placeId", place.id);

      router.replace("/admin");
    } catch (err: any) {
      Alert.alert("Greška", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.wrapper, { backgroundColor: D.wrapper }]}
    >
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: D.wrapper }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Registracija</Text>
        <Text style={[styles.subtitle, { color: D.subtitle }]}>Kreirajte admin nalog za vaš objekat</Text>

        <Text style={[styles.label, { color: D.label }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          placeholder="admin@email.com"
          placeholderTextColor={D.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: D.label }]}>Lozinka</Text>
        <TextInput
          style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          placeholder="Min. 6 znakova"
          placeholderTextColor={D.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={[styles.label, { color: D.label }]}>Naziv objekta</Text>
        <TextInput
          style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          placeholder="npr. Caffe Bar Centar"
          placeholderTextColor={D.placeholder}
          value={placeName}
          onChangeText={setPlaceName}
        />

        <Text style={[styles.hint, { marginTop: 8, textAlign: "center", color: D.hint }]}>
          Zone, stolove i ostale postavke podešavate u admin panelu nakon registracije.
        </Text>

        <Pressable
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? "Kreiranje..." : "Kreiraj nalog"}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={[styles.linkText, { color: D.link }]}>Već imate nalog? Prijavite se</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F5F7" },
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "800", color: p, marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 4, marginTop: 12 },
  hint: { fontSize: 12, color: "#888", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 4,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  btn: {
    backgroundColor: p,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 28,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkText: { color: p, fontSize: 14 },
});
