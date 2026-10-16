import { Screen, Typography } from "@/components/ui";

export default function CartScreen() {
  return (
    <Screen edges={["top", "bottom"]}>
      <Typography variant="title">Cart</Typography>
      <Typography tone="muted">Checkout is the next build step.</Typography>
    </Screen>
  );
}
