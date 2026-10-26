import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { formatDayClock } from "@/utils/tripEta";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

interface TripCompletedCardProps {
  /** shipment_no, or the PRO number when the load has none. */
  loadName: string | null;
  /** When the last stop was completed, if known. */
  deliveredAt: Date | null;
  onDone: () => void;
}

const GREEN = "#16A34A";

const DONE_ITEMS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[] = [
  { icon: "shield-check", label: "Verified" },
  { icon: "file-document-check", label: "POD Saved" },
  { icon: "truck-check", label: "Delivered" },
];

/*
| Shown on My Trip once every stop is done, and kept there until the driver
| taps Done: the server moves a delivered load to Past straight away, so
| without this the screen went to "No active load" a moment after the last
| stop and the driver never saw that the trip had finished.
*/
export default function TripCompletedCard({ loadName, deliveredAt, onDone }: TripCompletedCardProps) {
  const what = loadName ? `Load ${loadName}` : "This load";
  // With the day in front when it was not today: the card can be reopened the next morning.
  const when = deliveredAt ? ` at ${formatDayClock(deliveredAt)}` : "";

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <MaterialCommunityIcons name="check-bold" size={32} color="#fff" />
      </View>

      <AppText variant="h3" style={styles.title}>
        Trip Completed!
      </AppText>
      <AppText variant="caption" style={styles.body}>
        {`${what} was delivered${when}. Every step is done.`}
      </AppText>

      <View style={styles.items}>
        {DONE_ITEMS.map((item) => (
          <View key={item.label} style={styles.item}>
            <MaterialCommunityIcons name={item.icon} size={18} color={GREEN} />
            <AppText variant="tiny" style={styles.itemLabel}>
              {item.label}
            </AppText>
          </View>
        ))}
      </View>

      <AppButton title="Done" onPress={onDone} style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: GREEN,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: "#15803D",
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: "#166534",
    textAlign: "center",
    lineHeight: 20,
  },
  items: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
    width: "100%",
    justifyContent: "space-around",
  },
  item: {
    alignItems: "center",
    gap: 2,
  },
  itemLabel: {
    color: "#15803D",
    fontWeight: "600",
  },
  done: {
    alignSelf: "stretch",
    marginTop: 6,
  },
});
