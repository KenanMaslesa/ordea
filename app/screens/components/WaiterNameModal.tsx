import { getItem, setItem } from "@/app/helper";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type WaiterNameModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void; // nova funkcionalnost
};

export default function WaiterNameModal({ visible, onClose, onSave }: WaiterNameModalProps) {
  const [waiterName, setWaiterName] = useState("");
  const [hasName, setHasName] = useState(false);

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
          style={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {hasName ? "Promijeni ime konobara" : "Unesi ime konobara"}
          </Text>
          <TextInput
            value={waiterName}
            onChangeText={setWaiterName}
            placeholder="Ime konobara"
            style={styles.input}
          />

          {hasName ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
              <Pressable
                style={[styles.button, { flex: 1, marginRight: 8, backgroundColor: "#ccc" }]}
                onPress={cancel}
              >
                <Text style={{ color: "#000", fontWeight: "700" }}>Odustani</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: "#0E7C86",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
