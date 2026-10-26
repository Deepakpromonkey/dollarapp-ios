import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import PhotoCaptureModal from "@/components/PhotoCaptureModal";
import StopEventsCard from "@/components/loads/StopEventsCard";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { StopProgress } from "@/hooks/useStopProgress";
import { ApiError, api } from "@/lib/api";
import { invalidate, onInvalidate } from "@/lib/invalidate";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  ensureForegroundLocation,
  getPositionWithin,
  NO_POSITION_MESSAGE,
  type LocationAccess,
} from "@/utils/currentPosition";
import { shrinkPhoto } from "@/utils/photos";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";

const OTP_LENGTH = 6;

/*
| What the driver has filled in for a stop, kept outside the card.
|
| The card can be rebuilt while the driver is busy with it (the screen around
| it refreshing), and a rebuilt card used to start blank: the paperwork photo
| just taken was gone, and "Complete delivery" asked for it again. This lives
| in memory, so it survives a rebuilt card but not the whole app being closed.
| Kept per load and stop, dropped once the stop is done or the driver signs out.
*/
interface StopDraft {
  podUri: string | null;
  receiverName: string;
  condition: "Clean" | "Claused";
  seal: string;
}

const drafts = new Map<string, StopDraft>();
onInvalidate("session", () => drafts.clear());

/*
| Why "Mark arrival" could not use the driver's location, shown under the
| button. A refused permission is final (App Review 5.1.1(iv)): no alert and no
| automatic trip to Settings, only this static text with a Settings button the
| driver can use or ignore.
*/
const LOCATION_ISSUE_TEXT: Record<Exclude<LocationAccess, "ok">, string> = {
  denied: "Location access is required to mark arrival. Enable it in Settings to continue.",
  services_off: "Location Services are off. Turn them on in Settings to mark arrival.",
};

interface Props {
  shipmentUuid: string;
  stop: StopProgress;
  /** Called with the stop list the action returned, so the screen can show it straight away. */
  onAdvance: (stops: StopProgress[]) => void;
  equipmentVerified?: boolean;
}

/*
| After an arrival or a completed stop, the journey ("trip") and the load lists
| ("shipments": activation, Active/Past) are announced as stale here, where the
| change is made. Answers to a stop's questions are announced by
| StopEventsCard itself, so it is not handed a refresh callback as well.
*/
export default function StopActionCard({
  shipmentUuid,
  stop,
  onAdvance,
  equipmentVerified = true,
}: Props) {
  const theme = useAppTheme();

  const draftKey = `${shipmentUuid}:${stop.stop_id}`;
  const saved = drafts.get(draftKey);

  const [busy, setBusy] = useState(false);
  const [locationIssue, setLocationIssue] = useState<Exclude<LocationAccess, "ok"> | null>(null);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState(false);
  const [seal, setSeal] = useState(saved?.seal ?? "");
  const [receiverName, setReceiverName] = useState(saved?.receiverName ?? "");
  const [condition, setCondition] = useState<"Clean" | "Claused">(saved?.condition ?? "Clean");
  const [podUri, setPodUri] = useState<string | null>(saved?.podUri ?? null);
  const [cameraOpen, setCameraOpen] = useState(false);
  /* A picked photo is being shrunk; completing now would send the previous one. */
  const [preparingPhoto, setPreparingPhoto] = useState(false);

  useEffect(() => {
    drafts.set(draftKey, { podUri, receiverName, condition, seal });
  }, [draftKey, podUri, receiverName, condition, seal]);

  const where = [stop.stop_name, stop.city, stop.state]
    .filter(Boolean)
    .join(", ");

  const openEquipmentVerification = () =>
    router.push({
      pathname: "/trip/equipment-verification",
      // Stop cards are shown only for a load My Trip already knows is activated.
      params: { uuid: shipmentUuid, activated: "1" },
    });

  // The load page is where the Activate button lives.
  const openLoad = () =>
    router.push({ pathname: "/loads/[id]", params: { id: shipmentUuid } });

  const fail = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;

    /*
    | Arriving at (or completing) a stop on a load that was never started is
    | refused with "Activate this load before starting the journey." Saying so
    | was not enough on its own: the driver standing at the dock still had to
    | work out where the Activate button was. Offer the way there.
    */
    const needsActivation =
      err instanceof ApiError && err.status === 400 && /activate/i.test(err.message);

    if (needsActivation) {
      Alert.alert(
        "Start this load first",
        "This load hasn't been activated yet. Open the load and tap Activate Load, then mark your arrival.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open load", onPress: openLoad },
        ],
      );
      return;
    }

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

  /*
  | Ask the server whether an action that looked like it failed went through.
  |
  | A slow photo upload can time out on the phone after the server has saved
  | it: the driver saw "Network Error", tried again, and was told the load was
  | already complete. If the server shows the stop done, it is done — move on.
  |
  | Only outcomes that could hide a success are checked: no answer at all, a
  | server or proxy error, or the server saying the stop has moved on. A wrong
  | code or being too far away is a plain "no" and is shown straight away. No
  | answer, or a gateway error, may still be finishing, so those look twice.
  */
  const confirmedOnServer = async (
    done: (s: StopProgress) => boolean,
    err: unknown,
  ): Promise<boolean> => {
    if (!(err instanceof ApiError)) return false;
    const unclear =
      err.status === 0 ||
      err.status >= 500 ||
      (err.status === 422 && /already complete|done in order/i.test(err.message));
    if (!unclear) return false;

    const stillFinishing = err.status === 0 || [502, 503, 504].includes(err.status);
    for (const wait of stillFinishing ? [0, 4000] : [0]) {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        const res = await api.get<{ data: { stops: StopProgress[] } }>(
          `/shipments/${shipmentUuid}/progress`,
          { timeout: 8000 },
        );
        const stops = res.data?.data?.stops ?? [];
        const mine = stops.find((s) => s.stop_id === stop.stop_id);
        if (mine && done(mine)) {
          onAdvance(stops);
          invalidate("trip", "shipments");
          return true;
        }
      } catch {
        // Could not ask; fall back to reporting the original failure.
      }
    }
    return false;
  };

  const arrive = async () => {
    setBusy(true);
    setLocationIssue(null);
    try {
      /*
      | Only the foreground permission: marking arrival needs one fix, not
      | "Always". Tracking asks for that elsewhere; demanding it here kept a
      | driver standing at the dock from checking in.
      */
      const access = await ensureForegroundLocation();
      if (access !== "ok") {
        setLocationIssue(access);
        return;
      }

      const position = await getPositionWithin(Location.Accuracy.Balanced);
      if (!position) {
        throw new Error(NO_POSITION_MESSAGE);
      }

      const res = await api.post<{ data: { stops: StopProgress[] } }>(
        `/shipments/${shipmentUuid}/stops/${stop.stop_id}/arrive`,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      );

      onAdvance(res.data?.data?.stops ?? []);
      invalidate("trip", "shipments");
    } catch (err) {
      if (await confirmedOnServer((s) => !!s.arrived_at, err)) return;
      fail(err, "Arrival was not recorded.");
    } finally {
      setBusy(false);
    }
  };

  /*
  | For paperwork photographed earlier; the in-app camera is the normal way.
  | "Compatible" has iOS hand over a JPEG instead of the HEIC it stores, which
  | the server rejects. The system picker needs no photo-library permission.
  */
  const choosePodFromPhotos = async () => {
    if (busy || preparingPhoto) return;
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.6,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!result.canceled && result.assets?.length) {
        setPreparingPhoto(true);
        setPodUri(await shrinkPhoto(result.assets[0].uri));
      }
    } catch (err) {
      fail(err, "Could not open your photos.");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const complete = async () => {
        if (preparingPhoto) return;
        const code = otp.join("");
        if (stop.requires_otp && code.length !== OTP_LENGTH) {
            setOtpError(true);
            setTimeout(() => setOtpError(false), 700);
            return;
        }

        // Name only what is missing: "needs a photo" when the photo is there sent drivers to retake it.
        if (stop.is_final && !podUri) {
            Alert.alert("Almost there", "Take a photo of the paperwork first.");
            return;
        }
        if (stop.is_final && !receiverName.trim()) {
            Alert.alert("Almost there", "Enter the receiver's printed name.");
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
            drafts.delete(draftKey);
            onAdvance(res.data?.data?.stops ?? []);
            invalidate("trip", "shipments");
        } catch (err) {
            if (await confirmedOnServer((s) => !!s.completed_at, err)) {
                drafts.delete(draftKey);
                return;
            }
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
              {locationIssue && (
                <View style={{ marginTop: 10 }}>
                  <AppText variant="caption" style={{ color: theme.err }}>
                    {LOCATION_ISSUE_TEXT[locationIssue]}
                  </AppText>
                  <AppButton
                    title="Open Settings"
                    variant="secondary"
                    onPress={() => Linking.openSettings()}
                    style={styles.action}
                  />
                </View>
              )}
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
                editable={!busy}
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
                  RECEIVER&apos;S PRINTED NAME
                </AppText>
                <TextInput
                  value={receiverName}
                  onChangeText={setReceiverName}
                  editable={!busy}
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
                      disabled={busy}
                      style={{ flex: 1 }}
                    />
                  ))}
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <AppText
                  variant="tiny"
                  style={[styles.label, { color: theme.secondaryText }]}
                >
                  PROOF OF DELIVERY
                </AppText>

                {podUri ? (
                  <View
                    style={[styles.podPreview, { backgroundColor: theme.cardSecondary }]}
                  >
                    <Image source={{ uri: podUri }} style={styles.podThumb} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.podAdded}>
                        <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                        <AppText variant="label1" style={{ color: "#16A34A", fontWeight: "700" }}>
                          Photo added
                        </AppText>
                      </View>
                      <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                        It is sent when you complete the delivery.
                      </AppText>
                    </View>
                  </View>
                ) : null}

                <AppButton
                  title={podUri ? "Retake photo" : "Take photo of the paperwork"}
                  variant="secondary"
                  onPress={() => setCameraOpen(true)}
                  // Locked while sending: a photo swapped mid-upload looked attached but was not the one sent.
                  disabled={busy || preparingPhoto}
                  loading={preparingPhoto}
                  style={styles.action}
                />
                <Pressable
                  onPress={choosePodFromPhotos}
                  disabled={busy || preparingPhoto}
                  hitSlop={8}
                  style={[styles.photosLink, (busy || preparingPhoto) && { opacity: 0.4 }]}
                >
                  <AppText
                    variant="caption"
                    style={{ color: theme.primaryButton, fontWeight: "600" }}
                  >
                    or choose from your photos
                  </AppText>
                </Pressable>
              </View>

              <PhotoCaptureModal
                visible={cameraOpen}
                title="Proof of delivery"
                onCaptured={(photo) => {
                  setPodUri(photo.uri);
                  setCameraOpen(false);
                }}
                onClose={() => setCameraOpen(false)}
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
            disabled={preparingPhoto}
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
  podPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 10,
  },
  podThumb: { width: 64, height: 64, borderRadius: 8 },
  podAdded: { flexDirection: "row", alignItems: "center", gap: 6 },
  photosLink: { alignSelf: "center", marginTop: 10 },
});
