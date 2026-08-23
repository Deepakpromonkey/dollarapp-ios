import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import StopEventsCard from "@/components/loads/StopEventsCard";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { StopProgress } from "@/hooks/useStopProgress";
import { ApiError, api } from "@/lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, StyleSheet, TextInput, View } from "react-native";

const OTP_LENGTH = 6;

interface Props {
  shipmentUuid: string;
  stop: StopProgress & { requires_otp?: boolean }; // Ensures TS knows about the flag
  onAdvance: (stops: StopProgress[]) => void;
  onRefresh: () => void;
  equipmentVerified?: boolean;
}

export default function StopActionCard({
  shipmentUuid,
  stop,
  onAdvance,
  onRefresh,
  equipmentVerified = true,
}: Props) {
  const theme = useAppTheme();

  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState(false);
  const [seal, setSeal] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [condition, setCondition] = useState<"Clean" | "Claused">("Clean");
  const [podUri, setPodUri] = useState<string | null>(null);

  const where = [stop.stop_name, stop.city, stop.state]
    .filter(Boolean)
    .join(", ");

  const openEquipmentVerification = () =>
    router.push({
      pathname: "/trip/equipment-verification",
      params: { uuid: shipmentUuid },
    });

  const fail = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    const isEquipmentGate =
      err instanceof ApiError &&
      err.status === 422 &&
      /equipment|vin|tractor|trailer/i.test(err.message);

    if (isEquipmentGate) {
      Alert.alert("Verify your equipment first", message, [
        { text: "Not now", style: "cancel" },
        { text: "Take photos", onPress: openEquipmentVerification },
      ]);
      return;
    }

    Alert.alert("Could not continue", message);
  };

  const arrive = async () => {
    setBusy(true);
    try {
      const fgPermission = await Location.requestForegroundPermissionsAsync();
      if (!fgPermission.granted) {
        Alert.alert(
          "Location needed",
          "We need your location to mark arrival so the broker can see you reached this stop.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        setBusy(false);
        return;
      }

      const bgPermission = await Location.requestBackgroundPermissionsAsync();
      if (!bgPermission.granted) {
        Alert.alert(
          "Background Tracking Required",
          "To mark arrival and start this trip, you must set location access to 'Allow all the time'.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        setBusy(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const res = await api.post<{ data: { stops: StopProgress[] } }>(
        `/shipments/${shipmentUuid}/stops/${stop.stop_id}/arrive`,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      );

      onAdvance(res.data?.data?.stops ?? []);
    } catch (err) {
      fail(err, "Arrival was not recorded.");
    } finally {
      setBusy(false);
    }
  };

  const pickPod = async () => {
    const ImagePicker = await import("expo-image-picker");
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    const result = permission.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

    if (!result.canceled && result.assets?.length) {
      setPodUri(result.assets[0].uri);
    }
  };

  const complete = async () => {
        const code = otp.join("");
        if (stop.requires_otp && code.length !== OTP_LENGTH) {
            setOtpError(true);
            setTimeout(() => setOtpError(false), 700);
            return;
        }

        if (stop.is_final && (!podUri || !receiverName.trim())) {
            Alert.alert(
                "Almost there",
                "The last stop needs a photo of the paperwork and the receiver's printed name.",
            );
            return;
        }

        setBusy(true);
        try {
            const form = new FormData();
            
            // 👇 FIX: Prevent React Native Network Error on empty FormData
            form.append("device_platform", "mobile");

            // 👇 Only append OTP if required
            if (stop.requires_otp) {
                form.append("otp", code);
            }

            if (stop.stop_type === "Pickup" && seal.trim()) {
                form.append("seal_number", seal.trim());
            }

            if (stop.is_final) {
                form.append("delivery_condition", condition);
                form.append("receiver_printed_name", receiverName.trim());
                form.append("pod_image", {
                    uri: podUri!,
                    name: "pod.jpg",
                    type: "image/jpeg",
                } as unknown as Blob);
            }

            const res = await api.upload<{
                data: { stops: StopProgress[] };
            }>(`/shipments/${shipmentUuid}/stops/${stop.stop_id}/complete`, form);

            setOtp(Array(OTP_LENGTH).fill(""));
            onAdvance(res.data?.data?.stops ?? []);
        } catch (err) {
            fail(err, "This stop was not completed.");
        } finally {
            setBusy(false);
        }
    };

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor:
                stop.stop_type === "Pickup"
                  ? theme.primaryButton + "18"
                  : "#EF444418",
            },
          ]}
        >
          <AppText
            variant="tiny"
            style={{
              color:
                stop.stop_type === "Pickup" ? theme.primaryButton : "#EF4444",
              fontWeight: "700",
            }}
          >
            STOP {stop.stop_number} · {stop.stop_type.toUpperCase()}
            {stop.is_final ? " · FINAL" : ""}
          </AppText>
        </View>
      </View>

      <AppText variant="label" style={{ color: theme.text, fontWeight: "700" }}>
        {where || `Stop ${stop.stop_number}`}
      </AppText>

      {stop.comment_to_driver ? (
        <View style={[styles.note, { backgroundColor: theme.cardSecondary }]}>
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={theme.secondaryText}
          />
          <AppText
            variant="caption"
            style={{ color: theme.secondaryText, flex: 1 }}
          >
            {stop.comment_to_driver}
          </AppText>
        </View>
      ) : null}

      {stop.next_action === "arrive" && (
        <>
          {equipmentVerified ? (
            <>
              <AppText
                variant="caption"
                style={{ color: theme.secondaryText, marginTop: 10 }}
              >
                Get within 500 m of this stop, then mark your arrival.
              </AppText>
              <AppButton
                title={busy ? "Checking your location..." : "Mark arrival "}
                onPress={arrive}
                loading={busy}
                style={styles.action}
              />
            </>
          ) : (
            <>
              <AppText
                variant="caption"
                style={{ color: theme.err, marginTop: 10 }}
              >
                Photograph the VIN, tractor and trailer before marking arrival.
              </AppText>
              <AppButton
                title="Verify equipment"
                onPress={openEquipmentVerification}
                style={styles.action}
              />
            </>
          )}
        </>
      )}

      {stop.next_action === "answer_questions" && (
        <>
          <AppText
            variant="caption"
            style={{ color: theme.err, marginTop: 10 }}
          >
            {stop.events_outstanding} question
            {stop.events_outstanding === 1 ? "" : "s"} must be answered before
            you can leave this stop.
          </AppText>
          <View style={{ marginTop: 12, marginHorizontal: -16 }}>
            <StopEventsCard
              shipmentUuid={shipmentUuid}
              stopId={stop.stop_id}
              title="Questions for this stop"
              onSaved={onRefresh}
            />
          </View>
        </>
      )}

      {(stop.next_action === "verify_and_depart" ||
        stop.next_action === "complete_with_pod") && (
        <>
          {/* 👇 CONDITIONAL OTP RENDERING 👇 */}
          {stop.requires_otp ? (
            <>
              <AppText
                variant="caption"
                style={{
                  color: theme.secondaryText,
                  marginTop: 10,
                  marginBottom: 12,
                }}
              >
                The broker requires an OTP for this stop. Please ask the contact
                for the 6-digit code.
              </AppText>
              <OtpInput
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setOtpError(false);
                }}
                hasError={otpError}
                autoFocus={false}
              />
            </>
          ) : (
            <AppText
              variant="caption"
              style={{
                color: theme.secondaryText,
                marginTop: 10,
                marginBottom: 4,
              }}
            >
              No OTP is required for this stop. You may depart when ready.
            </AppText>
          )}

          {stop.stop_type === "Pickup" && (
            <View style={{ marginTop: 12 }}>
              <AppText
                variant="tiny"
                style={[styles.label, { color: theme.secondaryText }]}
              >
                SEAL NUMBER
              </AppText>
              <TextInput
                value={seal}
                onChangeText={setSeal}
                placeholder="Seal on the trailer"
                placeholderTextColor={theme.secondaryText}
                style={[
                  styles.input,
                  { backgroundColor: theme.cardSecondary, color: theme.text },
                ]}
              />
            </View>
          )}

          {stop.is_final && (
            <>
              <View style={{ marginTop: 12 }}>
                <AppText
                  variant="tiny"
                  style={[styles.label, { color: theme.secondaryText }]}
                >
                  RECEIVER'S PRINTED NAME
                </AppText>
                <TextInput
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder="Who signed for the load"
                  placeholderTextColor={theme.secondaryText}
                  style={[
                    styles.input,
                    { backgroundColor: theme.cardSecondary, color: theme.text },
                  ]}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <AppText
                  variant="tiny"
                  style={[styles.label, { color: theme.secondaryText }]}
                >
                  DELIVERY CONDITION
                </AppText>
                <View style={styles.row}>
                  {(["Clean", "Claused"] as const).map((option) => (
                    <AppButton
                      key={option}
                      title={option}
                      variant={condition === option ? "primary" : "secondary"}
                      onPress={() => setCondition(option)}
                      style={{ flex: 1 }}
                    />
                  ))}
                </View>
              </View>

              <AppButton
                title={
                  podUri
                    ? "Retake proof of delivery"
                    : "Photograph the paperwork"
                }
                variant="secondary"
                onPress={pickPod}
                style={styles.action}
              />
            </>
          )}

          <AppButton
            title={
              busy
                ? "Submitting..."
                : stop.is_final
                  ? "Complete delivery"
                  : "Confirm and depart"
            }
            onPress={complete}
            loading={busy}
            style={styles.action}
          />
        </>
      )}

      {stop.next_action === "done" && (
        <View style={styles.doneRow}>
          <MaterialCommunityIcons
            name="check-circle"
            size={16}
            color={theme.secondaryButton}
          />
          <AppText variant="caption" style={{ color: theme.secondaryText }}>
            Completed {stop.seal_number ? ` · seal ${stop.seal_number}` : ""}
          </AppText>
        </View>
      )}

      {stop.next_action === "waiting" && (
        <AppText
          variant="caption"
          style={{ color: theme.secondaryText, marginTop: 8 }}
        >
          Finish the stops before this one first.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 14 },
  header: { flexDirection: "row", marginBottom: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  action: { marginTop: 12 },
  label: { letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: 10 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
});
