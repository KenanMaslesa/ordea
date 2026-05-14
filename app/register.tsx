import { auth } from "@/firebase";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
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
import { setItem } from "./helper";
import { createPlace } from "./services/place.service";

export default function RegisterScreen() {
  const router = useRouter();

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
      style={styles.wrapper}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Registracija</Text>
        <Text style={styles.subtitle}>Kreirajte admin nalog za vaš objekat</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="admin@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Lozinka</Text>
        <TextInput
          style={styles.input}
          placeholder="Min. 6 znakova"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>Naziv objekta</Text>
        <TextInput
          style={styles.input}
          placeholder="npr. Caffe Bar Centar"
          value={placeName}
          onChangeText={setPlaceName}
        />

        <Text style={[styles.hint, { marginTop: 8, textAlign: "center" }]}>
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
          <Text style={styles.linkText}>Već imate nalog? Prijavite se</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F4F5F7" },
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "800", color: "#0E7C86", marginBottom: 4 },
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
    backgroundColor: "#0E7C86",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 28,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkText: { color: "#0E7C86", fontSize: 14 },
});
