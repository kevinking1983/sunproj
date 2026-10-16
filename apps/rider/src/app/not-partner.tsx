import { Button, Screen, Typography } from "@/components/ui";
import { spacing } from "@/constants/theme";
import { formatIndianMobile } from "@/lib/phone";
import { useAuth } from "@/stores/auth";

export default function NotPartnerScreen() {
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const refresh = useAuth((s) => s.refreshProfile);
  return (
    <Screen edges={["top", "bottom"]} style={{ justifyContent: "center", gap: spacing.md }}>
      <Typography variant="title" center>Not a partner account yet</Typography>
      <Typography tone="muted" center>
        {profile?.phone ? formatIndianMobile(profile.phone) : "This number"} is registered as a customer. Ask your store manager to enable delivery partner access, then tap refresh.
      </Typography>
      <Button title="Refresh" variant="accent" fullWidth onPress={() => void refresh()} />
      <Button title="Log out" variant="ghost" fullWidth onPress={() => void signOut()} />
    </Screen>
  );
}
