import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Button, Screen, Typography } from "@/components/ui";
import { colors, fontSize, fontWeight, radius, spacing } from "@/constants/theme";
import { formatIndianMobile } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = async (token: string) => {
    if (!phone || token.length !== OTP_LENGTH) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    setLoading(false);
    if (verifyError) {
      setError("That code did not match. Try again.");
      setCode("");
    }
    // On success the auth listener flips the route guard and the tabs mount.
  };

  const resend = async () => {
    if (!phone || seconds > 0) return;
    setSeconds(RESEND_SECONDS);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone, options: { channel: "sms" } });
    if (otpError) setError(otpError.message);
  };

  return (
    <Screen background={colors.background} keyboard>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Typography variant="label" tone="muted">‹ Change number</Typography>
      </Pressable>
      <Typography variant="title">Enter the code</Typography>
      <Typography variant="body" tone="muted">
        Sent to {phone ? formatIndianMobile(phone) : "your number"}
      </Typography>

      <Pressable onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const char = code[i] ?? "";
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError]}>
              <Typography variant="title">{char}</Typography>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, "").slice(0, OTP_LENGTH);
          setCode(digits);
          if (digits.length === OTP_LENGTH) void verify(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.hidden}
      />
      {error ? <Typography variant="label" tone="danger">{error}</Typography> : null}

      <Button title="Verify" variant="accent" size="lg" fullWidth loading={loading} disabled={code.length !== OTP_LENGTH} onPress={() => verify(code)} style={{ marginTop: spacing.xl }} />

      <Pressable onPress={resend} disabled={seconds > 0} style={styles.resend}>
        <Typography variant="label" tone={seconds > 0 ? "muted" : "accent"} center>
          {seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
        </Typography>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: spacing.xl },
  boxes: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.xxl },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: colors.primary, borderWidth: 1.5 },
  boxError: { borderColor: colors.danger },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
  resend: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
