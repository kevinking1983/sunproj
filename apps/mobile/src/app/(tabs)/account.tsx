import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { CartBar } from "@/components/cart/CartBar";
import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { formatIndianMobile } from "@/lib/phone";
import { useAuth } from "@/stores/auth";
import { formatInr } from "@ration/shared";

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}

function Row({ icon, title, subtitle, onPress, danger }: RowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      <View style={{ flex: 1 }}>
        <Typography variant="label" weight="medium" tone={danger ? "danger" : "default"}>{title}</Typography>
        {subtitle ? <Typography variant="caption" tone="muted">{subtitle}</Typography> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const code = profile?.referral_code ?? "";

  const share = async () => {
    await Share.share({ message: `Get groceries in minutes with RATION. Use my code ${code} for ₹50 off your first order.` });
  };

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", "Your referral code is on the clipboard.");
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push("/account/profile")} style={styles.profile}>
          <View style={styles.avatar}>
            <Typography variant="title" tone="onPrimary">{(profile?.full_name ?? "R").charAt(0).toUpperCase()}</Typography>
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="heading">{profile?.full_name ?? "Add your name"}</Typography>
            <Typography variant="caption" tone="muted">{profile?.phone ? formatIndianMobile(profile.phone) : ""}</Typography>
          </View>
          <Ionicons name="create-outline" size={20} color={colors.textMuted} />
        </Pressable>

        <View style={styles.wallet}>
          <View style={{ flex: 1 }}>
            <Typography variant="caption" tone="onDark" style={{ opacity: 0.8 }}>RATION WALLET</Typography>
            <Typography variant="title" tone="onDark">{formatInr(profile?.wallet_balance ?? 0)}</Typography>
            <Typography variant="caption" tone="onDark" style={{ opacity: 0.8 }}>Refunds and rewards land here instantly</Typography>
          </View>
          <Pressable onPress={() => router.push("/account/wallet")} style={styles.walletCta}>
            <Typography variant="label" weight="bold" style={{ color: colors.textOnAccent }}>History</Typography>
          </Pressable>
        </View>

        <View style={styles.referral}>
          <Ionicons name="gift-outline" size={24} color={colors.goldText} />
          <View style={{ flex: 1 }}>
            <Typography variant="label" weight="semibold">Refer friends, earn rewards</Typography>
            <Typography variant="caption" tone="muted">Share code {code} · they get ₹50 off, you get ₹50 after their first order</Typography>
          </View>
          <Pressable onPress={copy} hitSlop={8} style={{ marginRight: spacing.sm }}>
            <Ionicons name="copy-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable onPress={share} hitSlop={8}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.group}>
          <Row icon="receipt-outline" title="Your orders" onPress={() => router.push("/(tabs)/orders")} />
          <Row icon="location-outline" title="Saved addresses" onPress={() => router.push("/location")} />
          <Row icon="wallet-outline" title="Wallet and refunds" onPress={() => router.push("/account/wallet")} />
          <Row icon="help-circle-outline" title="Help and support" subtitle="Chat with us about an order" onPress={() => router.push("/account/support")} />
        </View>

        <View style={styles.group}>
          <Row icon="document-text-outline" title="Terms of service" onPress={() => router.push({ pathname: "/account/legal", params: { page: "terms" } })} />
          <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push({ pathname: "/account/legal", params: { page: "privacy" } })} />
          <Row icon="refresh-outline" title="Refund and cancellation policy" onPress={() => router.push({ pathname: "/account/legal", params: { page: "refunds" } })} />
        </View>

        <View style={styles.group}>
          <Row
            icon="log-out-outline"
            title="Log out"
            danger
            onPress={() => Alert.alert("Log out?", "You will need an OTP to log back in.", [{ text: "Cancel", style: "cancel" }, { text: "Log out", style: "destructive", onPress: () => void signOut() }])}
          />
        </View>
        <Typography variant="caption" tone="muted" center style={{ marginTop: spacing.lg }}>RATION v0.1.0</Typography>
      </ScrollView>
      <CartBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  wallet: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: spacing.lg },
  walletCta: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  referral: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentTint, borderRadius: radius.lg, padding: spacing.md },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
