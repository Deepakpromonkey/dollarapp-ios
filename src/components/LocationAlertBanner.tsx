import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";

interface LocationAlertBannerProps {
  visible: boolean;
  /** True when no fix is possible at all, rather than only background fixes. */
  blocking: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onPressAction: () => void;
}

/**
 * In-app warning that this load has stopped reporting its position.
 *
 * Deliberately a banner rather than an Alert. The previous implementation threw
 * up a modal with a single "Open Settings" button and no way to dismiss it,
 * every single time the app was foregrounded — a driver who cannot grant the
 * permission right now (in a yard with no signal, mid-delivery) had no way past
 * it. A banner says the same thing, stays visible for as long as the problem
 * lasts, and leaves the rest of the screen usable.
 */
export default function LocationAlertBanner({
  visible,
  blocking,
  title,
  body,
  actionLabel,
  onPressAction,
}: LocationAlertBannerProps) {
  const theme = useAppTheme();

  if (!visible) return null;

  // Red reads as "nothing is being reported"; amber as "reduced but running".
  const accent = blocking ? "#DC2626" : "#D97706";
  const tint = blocking ? "#FEF2F2" : "#FFFBEB";

  return (
    <View style={[styles.wrap, { backgroundColor: tint, borderColor: accent }]}>
      <MaterialCommunityIcons
        name={blocking ? "map-marker-off" : "map-marker-alert"}
        size={22}
        color={accent}
        style={styles.icon}
      />

      <View style={styles.content}>
        <AppText variant="label" style={{ color: accent, fontWeight: "700" }}>
          {title}
        </AppText>
        <AppText variant="caption" style={{ color: "#4B5563", marginTop: 2, lineHeight: 18 }}>
          {body}
        </AppText>

        <Pressable
          onPress={onPressAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <AppText variant="caption" style={{ color: theme.textCommon, fontWeight: "600" }}>
            {actionLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  icon: { marginTop: 2 },
  content: { flex: 1 },
  action: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
});
