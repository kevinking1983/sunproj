import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";

import { colors, radius } from "@/constants/theme";

interface Props {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Product photo with a brand-tinted placeholder when the catalog has no image yet. */
export function ProductImage({ uri, size = 96, style }: Props) {
  if (!uri) {
    return (
      <View style={[styles.placeholder, { width: size, height: size }, style]}>
        <Ionicons name="basket-outline" size={size * 0.4} color={colors.primaryLight} />
      </View>
    );
  }
  return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: radius.md }, style]} contentFit="cover" transition={150} recyclingKey={uri} />;
}

const styles = StyleSheet.create({
  placeholder: { borderRadius: radius.md, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
});
