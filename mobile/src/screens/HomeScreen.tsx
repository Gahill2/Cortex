import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";

export function HomeScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.body}>
        Signed in as {user?.email ?? "—"}. The full infinite canvas dashboard is on desktop/web for
        now; this app gives you mail, tasks, and settings on your phone.
      </Text>
      <Text style={styles.note}>
        Next: native home board with iOS-style widgets (same S/M/L sizes as the web canvas).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10", padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#f4f4f5" },
  body: { fontSize: 15, lineHeight: 22, color: "#c4c4cc" },
  note: { fontSize: 13, lineHeight: 20, color: "#71717a", marginTop: 8 },
});
