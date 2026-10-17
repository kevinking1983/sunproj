import Ionicons from "@expo/vector-icons/Ionicons";
import { COMPANY } from "@ration/shared";
import { Stack } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Screen, Typography } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";

// Set the support number in packages/shared/src/company.ts; call and WhatsApp hide until then.
const SUPPORT_PHONE = COMPANY.supportPhone ? `+${COMPANY.supportPhone}` : null;
const SUPPORT_EMAIL = COMPANY.supportEmail;
const SUPPORT_WHATSAPP = COMPANY.supportPhone;

const FAQ = [
  { q: "Where is my order?", a: "Open the order from the Orders tab to see its live status. Most orders arrive within the promised time." },
  { q: "An item is missing or damaged", a: "Tell us within 24 hours from the order page and we will refund it to your RATION wallet instantly." },
  { q: "How do refunds work?", a: "Online payments are refunded to the original method in 5 to 7 working days. Wallet payments are refunded instantly." },
  { q: "Can I cancel an order?", a: "Yes, until the store starts packing it. After that, contact support and we will do our best." },
];

export default function SupportScreen() {
  return (
    <Screen scroll edges={[]}>
      <Stack.Screen options={{ title: "Help and support" }} />
      <View style={styles.actions}>
        {SUPPORT_WHATSAPP ? (
          <Pressable onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`)} style={styles.action}>
            <Ionicons name="logo-whatsapp" size={24} color={colors.primary} />
            <Typography variant="label" weight="semibold">WhatsApp</Typography>
          </Pressable>
        ) : null}
        {SUPPORT_PHONE ? (
          <Pressable onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={styles.action}>
            <Ionicons name="call-outline" size={24} color={colors.primary} />
            <Typography variant="label" weight="semibold">Call us</Typography>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={styles.action}>
          <Ionicons name="mail-outline" size={24} color={colors.primary} />
          <Typography variant="label" weight="semibold">Email</Typography>
        </Pressable>
      </View>
      <Typography variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Common questions</Typography>
      {FAQ.map((f) => (
        <View key={f.q} style={styles.faq}>
          <Typography variant="label" weight="semibold">{f.q}</Typography>
          <Typography variant="caption" tone="muted">{f.a}</Typography>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1, alignItems: "center", gap: spacing.xs, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  faq: { gap: spacing.xs, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
