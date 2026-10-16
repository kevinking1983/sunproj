import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Screen, TextField, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { normaliseIndianMobile } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

export default function PhoneScreen() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e164 = normaliseIndianMobile(phone);
    if (!e164) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms", shouldCreateUser: false } });
    setLoading(false);
    if (otpError) {
      setError(/signups not allowed/i.test(otpError.message) ? "This number is not registered as a delivery partner. Contact your store." : otpError.message);
      return;
    }
    router.push({ pathname: "/(auth)/otp", params: { phone: e164 } });
  };

  return (
    <Screen background={colors.primaryDark} keyboard padded={false}>
      <View style={styles.hero}>
        <Typography variant="display" tone="onDark">RATION Partner</Typography>
        <Typography variant="body" tone="onDark" style={styles.tagline}>
          Deliver orders, earn per drop and tips. Log in with your registered partner number.
        </Typography>
      </View>
      <View style={styles.sheet}>
        <Typography variant="title">Partner login</Typography>
        <Typography variant="body" tone="muted" style={{ marginBottom: spacing.lg }}>
          We will send a one-time password to your number.
        </Typography>
        <TextField
          label="Mobile number"
          prefix={<Text style={styles.prefix}>+91</Text>}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={10}
          placeholder="98765 43210"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
          error={error}
          returnKeyType="done"
          onSubmitEditing={submit}
          autoFocus
        />
        <Button title="Continue" variant="accent" size="lg" fullWidth loading={loading} onPress={submit} style={{ marginTop: spacing.xl }} />
        <Typography variant="caption" tone="muted" center style={{ marginTop: spacing.lg }}>
          By continuing you agree to the RATION Terms of Service and Privacy Policy.
        </Typography>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: "flex-end", padding: spacing.xxl, gap: spacing.sm },
  tagline: { opacity: 0.85 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  prefix: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
