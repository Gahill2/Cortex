import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const apiUrl = api.defaults.baseURL ?? "—";

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Account</Text>
      <Text style={styles.value}>{user?.email ?? "—"}</Text>

      <Text style={[styles.label, styles.mt]}>API</Text>
      <Text style={styles.valueMono}>{apiUrl}</Text>
      <Text style={styles.hint}>
        Set EXPO_PUBLIC_API_URL in mobile/.env to your PC IP or Railway URL (include /api).
      </Text>

      <Pressable style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10", padding: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.08 },
  value: { fontSize: 17, color: "#f4f4f5", marginTop: 4 },
  valueMono: { fontSize: 13, color: "#c4c4cc", marginTop: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  hint: { fontSize: 13, color: "#71717a", marginTop: 8, lineHeight: 20 },
  mt: { marginTop: 24 },
  button: {
    marginTop: 32,
    backgroundColor: "#2a2a32",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#f4f4f5", fontWeight: "600", fontSize: 16 },
});
