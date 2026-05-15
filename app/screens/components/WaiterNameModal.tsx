import { getItem, setItem } from "@/app/helper";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTheme } from "../../context/ThemeContext";

type WaiterNameModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  darkMode?: boolean;
};

export default function WaiterNameModal({ visible, onClose, onSave, darkMode = false }: WaiterNameModalProps) {
  const [waiterName, setWaiterName] = useState("");
  const { primaryColor } = useTheme();
  const styles = useMemo(() => makeStyles(primaryColor), [primaryColor]);
  const [hasName, setHasName] = useState(false);

  const D = {
    content: darkMode ? "#1F2937" : "#fff",
    title:   darkMode ? "#F9FAFB" : "#18181B",
    input:   darkMode ? "#374151" : "#fff",
    inputBorder: darkMode ? "#4B5563" : "#ccc",
    inputText: darkMode ? "#F9FAFB" : "#18181B",
    placeholder: darkMode ? "#6B7280" : "#aaa",
    cancelBg: darkMode ? "#374151" : "#ccc",
    cancelText: darkMode ? "#E5E7EB" : "#000",
  };

  useEffect(() => {
    const fetchName = async () => {
      const name = await getItem("@waiterName");
      if (name) {
        setWaiterName(name);
        setHasName(true);
      } else {
        setHasName(false);
      }
    };
    fetchName();
  }, [visible]);

  const saveName = async () => {
    if (waiterName.trim().length === 0) return;
    await setItem("@waiterName", waiterName.trim());
    setHasName(true);
    onSave(waiterName.trim()); // update header odmah
    onClose();
  };

  const cancel = () => {
    if (hasName) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={cancel}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={cancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalContent, { backgroundColor: D.content }]}
        >
          <Text style={[styles.modalTitle, { color: D.title }]}>
            {hasName ? "Promijeni ime konobara" : "Unesi ime konobara"}
          </Text>
          <TextInput
            value={waiterName}
            onChangeText={setWaiterName}
            placeholder="Ime konobara"
            placeholderTextColor={D.placeholder}
            style={[styles.input, { backgroundColor: D.input, borderColor: D.inputBorder, color: D.inputText }]}
          />

          {hasName ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
              <Pressable
                style={[styles.button, { flex: 1, marginRight: 8, backgroundColor: D.cancelBg }]}
                onPress={cancel}
              >
                <Text style={{ color: D.cancelText, fontWeight: "700" }}>Odustani</Text>
              </Pressable>
              <Pressable
                style={[styles.button, { flex: 1 }]}
                onPress={saveName}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Spremi</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={saveName}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Spremi</Text>
            </Pressable>
          )}
          
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (p: string) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  button: {
    backgroundColor: p,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
