import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { StopProgress } from "@/hooks/useStopProgress";
import type { ShipmentStop } from "@/types/shipment";
import { type Coord, formatDuration, formatMiles, stopCoord } from "@/utils/geo";
import { stopAppointment, stopSubtitle, stopTitle } from "@/utils/stops";
import {
  estimateArrival,
  formatDayClock,
  formatWeekdayClock,
  parseInstant,
  punctuality,
  type Punctuality,
} from "@/utils/tripEta";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from "react-native";

interface CurrentStopCardProps {
  /** The stop to show, as /shipments has it (names, appointment window). */
  stop?: ShipmentStop | null;
  /** The same stop as /progress has it, once that has loaded. */
  progress?: StopProgress | null;
  /** Where this stop falls in driving order, from 1. */
  position?: number;
  /** How many stops the load has. */
  total: number;
  /** Every stop is finished. */
  delivered: boolean;
  /** The driver's latest fix, or null without one. */
  userLocation: Coord | null;
}

interface Stat {
  label: string;
  value: string;
  sub?: string;
  /** Shrink the value to fit its column instead of cutting it short. */
  shrinkToFit?: boolean;
}

/*
| The pill shares a third of the card with the other stats, so its own text
| stays to one short word or two; the column heading says what it is about.
| "ARRIVED ON TIME" in the pill itself wrapped and spilled past the outline.
*/
const PILLS: Record<
  Punctuality,
  { heading: string; label: string; color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  on_time: { heading: "STATUS", label: "ON TIME", color: "#16A34A", icon: "check-decagram-outline" },
  at_risk: { heading: "STATUS", label: "AT RISK", color: "#D97706", icon: "clock-alert-outline" },
  late: { heading: "STATUS", label: "LATE", color: "#DC2626", icon: "alert-circle-outline" },
  arrived_on_time: { heading: "ARRIVAL", label: "ON TIME", color: "#16A34A", icon: "check-decagram-outline" },
  arrived_late: { heading: "ARRIVAL", label: "LATE", color: "#DC2626", icon: "alert-circle-outline" },
};

const typeLabel = (type?: string | null): string | null => {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "pickup") return "PICKUP";
  if (t === "delivery") return "DELIVERY";
  // "Intermediate", "Intermediate 2": the position already says which stop it is.
  return null;
};

/*
| The stop the driver is heading to (or standing at), with a rough distance
| and arrival time. Every figure is an on-phone estimate (see utils/tripEta)
| and shown with "≈"; with no GPS fix or no position for the stop it says "—"
| rather than guessing. The punctuality pill only appears when the stop has
| an appointment the API could pin to an exact time.
*/
export default function CurrentStopCard({
  stop,
  progress,
  position,
  total,
  delivered,
  userLocation,
}: CurrentStopCardProps) {
  const theme = useAppTheme();

  // The estimate is "now + driving time", so it has to move on while the truck is parked.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const shown = stop ?? progress ?? null;

  /*
  | The two sources can disagree: /shipments puts "0","0" on a stop it could
  | not place and may lack appointment_at on an older API, while /progress
  | sends its own copy of both. Whichever has a usable value wins.
  */
  const target = stopCoord(stop) ?? stopCoord(progress);
  const fromStop = stopAppointment(stop);
  const appointment =
    fromStop.at || !progress ? fromStop : { ...fromStop, at: stopAppointment(progress).at };

  const arrivedAt = parseInstant(progress?.arrived_at);
  const completedAt = parseInstant(progress?.completed_at);
  const estimate = !arrivedAt && !delivered ? estimateArrival(userLocation, target, now) : null;

  const pill = punctuality({
    appointment: appointment.at,
    eta: estimate?.eta ?? null,
    arrivedAt,
  });

  const appointmentText = appointment.at
    ? formatDayClock(appointment.at, now)
    : appointment.time
      ? [appointment.time, appointment.timezone].filter(Boolean).join(" ")
      : null;

  const place = position && total ? `${position} OF ${total}` : null;
  const kind = typeLabel(shown?.stop_type);
  const lead = delivered
    ? "DELIVERED"
    : !progress
      ? "DESTINATION"
      : arrivedAt
        ? "AT STOP"
        : "NEXT STOP";
  const header = [lead, delivered ? null : place, delivered ? null : kind]
    .filter(Boolean)
    .join(" · ");

  const stats: Stat[] = delivered
    ? [
        { label: "DELIVERED", value: completedAt ? formatDayClock(completedAt, now) : "—" },
        { label: "ARRIVED", value: arrivedAt ? formatDayClock(arrivedAt, now) : "—" },
      ]
    : arrivedAt
      ? [
          { label: "ARRIVED", value: formatDayClock(arrivedAt, now) },
          { label: "APPOINTMENT", value: appointmentText ?? "—" },
        ]
      : [
          {
            label: "REMAINING",
            value: estimate ? `≈ ${formatDuration(estimate.minutes)}` : "—",
            sub: estimate
              ? `≈ ${formatMiles(estimate.miles)}`
              : !userLocation
                ? "No GPS fix"
                : !target
                  ? "Stop not on map"
                  : undefined,
          },
          {
            label: "ARRIVAL ETA",
            /*
            | With the weekday when it is not today. On a long run the
            | estimate lands tomorrow or later, and a bare "12:48 PM" next to
            | a dated appointment read as this afternoon. The weekday is the
            | shortest form that says so; it shrinks rather than lose its
            | AM/PM when the pill leaves this column narrow.
            */
            value: estimate ? formatWeekdayClock(estimate.eta, now) : "—",
            sub: appointmentText ? `Appt ${appointmentText}` : undefined,
            shrinkToFit: true,
          },
        ];

  /*
  | Driving directions in the phone's own maps app: Apple Maps on iOS, which
  | is always there, Google Maps on Android.
  */
  const navigate = () => {
    if (!target) return;
    const { latitude, longitude } = target;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't open maps", "Try again, or open your maps app and search for the stop."),
    );
  };

  const subtitle = stopSubtitle(shown);
  const pillStyle = pill ? PILLS[pill] : null;

  return (
    <View>
      <View style={styles.top}>
        <View style={styles.titleCol}>
          <AppText variant="tiny" style={[styles.header, { color: theme.secondaryText }]}>
            {header}
          </AppText>
          <AppText variant="h3" style={{ color: theme.text }} numberOfLines={1}>
            {stopTitle(shown)}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" style={{ color: theme.secondaryText }} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {target && !delivered ? (
          <Pressable
            onPress={navigate}
            hitSlop={6}
            style={({ pressed }) => [
              styles.navigate,
              { backgroundColor: theme.primaryButton + "18", opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Navigate to this stop"
          >
            <MaterialCommunityIcons name="navigation-variant" size={16} color={theme.primaryButton} />
            <AppText variant="caption" style={{ color: theme.primaryButton, fontWeight: "600" }}>
              Navigate
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat, i) => (
          <View key={stat.label} style={styles.statWrap}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.cardSecondary }]} /> : null}
            <View style={styles.stat}>
              <AppText variant="tiny" style={{ color: theme.text }}>
                {stat.label}
              </AppText>
              <AppText
                variant="label"
                style={{ color: theme.text }}
                numberOfLines={1}
                adjustsFontSizeToFit={stat.shrinkToFit}
              >
                {stat.value}
              </AppText>
              {stat.sub ? (
                <AppText variant="tiny" style={{ color: theme.secondaryText }} numberOfLines={1}>
                  {stat.sub}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}

        {pillStyle ? (
          <View style={styles.statWrap}>
            <View style={[styles.divider, { backgroundColor: theme.cardSecondary }]} />
            <View style={styles.stat}>
              <AppText variant="tiny" style={{ color: theme.text }}>
                {pillStyle.heading}
              </AppText>
              <View style={[styles.pill, { borderColor: pillStyle.color }]}>
                <MaterialCommunityIcons name={pillStyle.icon} size={13} color={pillStyle.color} />
                <AppText
                  variant="tiny"
                  numberOfLines={1}
                  style={[styles.pillText, { color: pillStyle.color }]}
                >
                  {pillStyle.label}
                </AppText>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  header: {
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  navigate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
  },
  divider: {
    width: 1,
    height: 40,
    marginRight: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  pillText: {
    fontWeight: "600",
    flexShrink: 1,
  },
});
