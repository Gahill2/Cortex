import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiErrorMessage } from "../api/client";

type MailAccount = { id: string; email?: string; provider?: string };
type MailMessage = { id: string; subject?: string; from?: string; unread?: boolean };

export function MailScreen() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const acc = await api.get<{ data?: { accounts?: MailAccount[] } }>("/mail/accounts");
      const list = acc.data?.data?.accounts ?? [];
      setAccounts(list);
      if (list.length === 0) {
        setMessages([]);
        return;
      }
      const inbox = await api.get<{ data?: { messages?: MailMessage[] } }>("/mail/inbox", {
        params: { unified: "true", maxResults: 30 },
      });
      setMessages(inbox.data?.data?.messages ?? []);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load mail."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connectGmail = async () => {
    try {
      const r = await api.post<{ data?: { url?: string } }>("/mail/accounts/gmail/connect", {
        returnOrigin: null,
      });
      const url = r.data?.data?.url;
      if (url) await Linking.openURL(url);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not start Gmail connect."));
    }
  };

  if (loading && accounts.length === 0 && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5b8dff" />
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.emptyTitle}>No mail accounts</Text>
        <Text style={styles.emptyBody}>Connect Gmail on your Cortex server, then refresh.</Text>
        <Pressable style={styles.button} onPress={() => void connectGmail()}>
          <Text style={styles.buttonText}>Connect Gmail</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => void load()} style={styles.linkBtn}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#5b8dff" />}
        ListEmptyComponent={<Text style={styles.empty}>Inbox empty</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.subject, item.unread && styles.unread]} numberOfLines={1}>
              {item.subject || "(no subject)"}
            </Text>
            <Text style={styles.from} numberOfLines={1}>
              {item.from ?? ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0e0e10", paddingTop: 8 },
  center: { flex: 1, backgroundColor: "#0e0e10", alignItems: "center", justifyContent: "center" },
  error: { color: "#ff6b6b", padding: 16, fontSize: 14 },
  empty: { color: "#71717a", textAlign: "center", marginTop: 40 },
  emptyTitle: { color: "#f4f4f5", fontSize: 20, fontWeight: "600", textAlign: "center", marginTop: 48 },
  emptyBody: { color: "#a1a1aa", textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
  button: {
    backgroundColor: "#5b8dff",
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  linkBtn: { alignItems: "center", padding: 16 },
  link: { color: "#5b8dff" },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2a32",
    gap: 4,
  },
  subject: { color: "#d4d4d8", fontSize: 16 },
  unread: { color: "#f4f4f5", fontWeight: "600" },
  from: { color: "#71717a", fontSize: 13 },
});
