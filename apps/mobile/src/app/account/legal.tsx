import { Stack, useLocalSearchParams } from "expo-router";

import { Screen, Typography } from "@/components/ui";
import { spacing } from "@/constants/theme";

const PAGES: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of service",
    body: [
      "RATION is a quick-commerce grocery service operated by RATION Private Limited (\"we\", \"us\"). By placing an order you agree to these terms.",
      "Orders are fulfilled from the dark store serving your address. Prices, availability and delivery times are shown at checkout and may change between sessions.",
      "You must be 18 or older to order. Age-restricted items, where offered, require ID at delivery.",
      "We may cancel an order if an item is unavailable, the address is unreachable, or we suspect misuse. Any payment made will be refunded.",
      "These terms are governed by the laws of India. Disputes are subject to the courts of the city where RATION Private Limited is registered.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    body: [
      "We collect your phone number to log you in, your addresses and location to deliver, and your order history to serve you better.",
      "Payments are processed by Razorpay. We never see or store your card number, UPI PIN or bank credentials.",
      "We do not sell your personal data. We share it only with delivery partners, payment and SMS providers as needed to fulfil your order.",
      "You can ask us to delete your account and data from Help and support. We retain invoices as required by Indian tax law.",
    ],
  },
  refunds: {
    title: "Refund and cancellation policy",
    body: [
      "You can cancel an order from the order page until the store starts packing it. The full amount is refunded.",
      "Missing, damaged or incorrect items reported within 24 hours of delivery are refunded to your RATION wallet immediately.",
      "Refunds to the original payment method take 5 to 7 working days depending on your bank. Cash on delivery orders are refunded to the wallet.",
      "Perishable items are not eligible for return once accepted at the door unless they are damaged or expired.",
    ],
  },
};

export default function LegalScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const content = PAGES[page ?? "terms"] ?? PAGES.terms;
  return (
    <Screen scroll edges={[]}>
      <Stack.Screen options={{ title: content.title }} />
      <Typography variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</Typography>
      {content.body.map((p, i) => (
        <Typography key={i} style={{ marginBottom: spacing.md }}>{p}</Typography>
      ))}
    </Screen>
  );
}
