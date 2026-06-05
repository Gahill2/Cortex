import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type SendOtpResponse = {
  ok: boolean;
  devOtpCode?: string;
  devHint?: string;
};

export function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<SendOtpResponse>("/auth/send-otp", {
        email: email.trim().toLowerCase(),
      });
      if (res.data.devOtpCode) {
        setCode(res.data.devOtpCode);
        setDevNotice(res.data.devHint ?? "Dev: use the code below (email not sent).");
      } else {
        setDevNotice(null);
      }
      setStep("otp");
    } catch (e) {
      setError(apiErrorMessage(e, "Could not send verification code."));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: { id: string; email: string } }>(
        "/auth/verify-otp",
        { email: email.trim().toLowerCase(), code: code.trim() },
      );
      await signIn(res.data.token, res.data.user);
    } catch (e) {
      setError(apiErrorMessage(e, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Cortex</Text>
        <Text style={styles.subtitle}>Sign in with your email</Text>

        {step === "email" ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#6b6b76"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <Pressable style={styles.button} onPress={() => void sendOtp()} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Code sent to {email}</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#6b6b76"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            {devNotice ? <Text style={styles.dev}>{devNotice}</Text> : null}
            <Pressable style={styles.button} onPress={() => void verifyOtp()} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
            </Pressable>
            <Pressable onPress={() => setStep("email")} style={styles.linkBtn}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0e0e10",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f4f4f5",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a32",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: "#f4f4f5",
  },
  button: {
    backgroundColor: "#5b8dff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: { color: "#a1a1aa", fontSize: 14 },
  dev: { color: "#f5a623", fontSize: 13 },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 8 },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  link: { color: "#5b8dff", fontSize: 14 },
});
