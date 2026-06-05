import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiErrorMessage } from "../api/client";

type Task = {
  id: string;
  title: string;
  status?: string;
};

export function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get("/tasks");
      const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
      setTasks(data);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load tasks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5b8dff" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#5b8dff" />}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.status ? <Text style={styles.badge}>{item.status}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10" },
  center: { flex: 1, backgroundColor: "#0e0e10", alignItems: "center", justifyContent: "center" },
  error: { color: "#ff6b6b", padding: 16, fontSize: 14 },
  empty: { color: "#71717a", textAlign: "center", marginTop: 40, fontSize: 15 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a32",
    gap: 4,
  },
  rowTitle: { color: "#f4f4f5", fontSize: 16 },
  badge: { color: "#a1a1aa", fontSize: 12, textTransform: "uppercase" },
});
