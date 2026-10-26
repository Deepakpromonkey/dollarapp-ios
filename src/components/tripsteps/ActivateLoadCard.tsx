import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ApiError } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { friendlyError, loadApi } from "@/lib/loadApi";
import type { Shipment } from "@/types/shipment";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

interface ActivateLoadCardProps {
  shipment: Shipment;
  /** The load in the way, if any. Passed in so My Trip can drop one it knows is finished. */
  blockedBy: Shipment["activation_blocked_by"];
}

/*
| My Trip on a load the driver has not started. Activating comes first: the
| server refuses equipment photos and every stop action until it is done, so
| this card stands where "Verify Equipment" used to be offered on a load
| nobody had activated.
*/
export default function ActivateLoadCard({ shipment, blockedBy }: ActivateLoadCardProps) {
  const theme = useAppTheme();
  const [activating, setActivating] = useState(false);

  const activate = async () => {
    if (activating) return;
    setActivating(true);
    try {
      await loadApi.activate(shipment.uuid);
      // The list and this trip both change: the LIVE pill, then equipment.
      invalidate("shipments", "trip");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        invalidate("shipments");
        Alert.alert("Finish your active load first", err.message);
        return;
      }
      // Already started, from the load page or another phone: the refresh shows it.
      if (err instanceof ApiError && err.status === 400) {
        invalidate("shipments", "trip");
        return;
      }
      Alert.alert("Could not activate", friendlyError(err, "Please try again."));
    } finally {
      setActivating(false);
    }
  };

  if (blockedBy) {
    const blocker = blockedBy.shipment_no || null;
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={[styles.icon, { backgroundColor: "#D9770618" }]}>
          <MaterialCommunityIcons name="truck-alert-outline" size={26} color="#D97706" />
        </View>
        <AppText variant="label" style={[styles.title, { color: theme.text }]}>
          Finish your active load first
        </AppText>
        <AppText variant="caption" style={[styles.body, { color: theme.secondaryText }]}>
          {`You are on ${blocker ?? "another load"}. Complete it before starting this load.`}
        </AppText>
        <AppButton
          title={blocker ? `Open ${blocker}` : "Open active load"}
          onPress={() =>
            router.push({ pathname: "/loads/[id]", params: { id: blockedBy.uuid } })
          }
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={[styles.icon, { backgroundColor: theme.primaryButton + "18" }]}>
        <MaterialCommunityIcons name="play-circle-outline" size={26} color={theme.primaryButton} />
      </View>
      <AppText variant="label" style={[styles.title, { color: theme.text }]}>
        Activate this load to start
      </AppText>
      <AppText variant="caption" style={[styles.body, { color: theme.secondaryText }]}>
        Activating unlocks equipment verification and the trip steps.
      </AppText>
      <AppButton
        title={activating ? "Activating..." : "Activate Load"}
        onPress={activate}
        loading={activating}
        disabled={activating}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    alignSelf: "stretch",
    marginTop: 6,
  },
});
