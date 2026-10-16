import { Button, Screen, Typography } from "@/components/ui";
import { spacing } from "@/constants/theme";
import { formatIndianMobile } from "@/lib/phone";
import { useAuth } from "@/stores/auth";

export default function AccountScreen() {
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  return (
    <Screen>
      <Typography variant="title">{profile?.full_name ?? "Your account"}</Typography>
      <Typography tone="muted">{profile?.phone ? formatIndianMobile(profile.phone) : ""}</Typography>
      <Button title="Log out" variant="secondary" onPress={signOut} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
