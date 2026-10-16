import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Typography } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/auth";

interface Props {
  productId: string;
  orderId: string;
  initial?: number | null;
}

/** Five-star rating for an item in a delivered order. Writes product_reviews (RLS: owner only). */
export function RateItem({ productId, orderId, initial }: Props) {
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const [rating, setRating] = useState<number>(initial ?? 0);

  const save = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("product_reviews")
        .upsert({ product_id: productId, order_id: orderId, user_id: userId, rating: value }, { onConflict: "product_id,user_id,order_id" });
      if (error) throw error;
    },
  });

  const pick = (value: number) => {
    setRating(value);
    save.mutate(value);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Pressable key={v} onPress={() => pick(v)} hitSlop={6} accessibilityLabel={`Rate ${v} of 5`}>
          <Ionicons name={v <= rating ? "star" : "star-outline"} size={18} color={v <= rating ? colors.rating : colors.textMuted} />
        </Pressable>
      ))}
      {save.isError ? <Typography variant="caption" tone="danger">Could not save</Typography> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xxs },
});
