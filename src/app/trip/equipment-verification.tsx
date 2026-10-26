import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { LiveCamera, type CaptureResult } from "@/components/LiveCamera";
import NavHeader from "@/components/NavHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useShipments } from "@/hooks/useShipments";
import { api, ApiError } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { friendlyError } from "@/lib/loadApi";
import { extractVin } from "@/utils/ocr";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CameraTarget = "vin_image" | "tractor_image" | "trailer_image" | null;
type Slot = Exclude<CameraTarget, null>;

const SLOTS: Slot[] = ["vin_image", "tractor_image", "trailer_image"];

const SLOT_LABELS: Record<Slot, string> = {
    vin_image: "VIN plate photo",
    tractor_image: "Tractor image",
    trailer_image: "Trailer image",
};

/* How long Confirm waits for text still being read before sending without it. */
const TEXT_WAIT_MS = 15_000;

/*
| Far beyond anything a plate produces, but a photo of a page of print can run
| to thousands of characters, and the API should not reject the photos' text
| for being long.
*/
const MAX_TEXT_LENGTH = 5000;

const EMPTY_SLOTS = { vin_image: null, tractor_image: null, trailer_image: null };
const EMPTY_TEXTS = { vin_image: "", tractor_image: "", trailer_image: "" };
const IDLE_SLOTS = { vin_image: false, tractor_image: false, trailer_image: false };

/*
 * Loads whose equipment photos this session has already uploaded.
 *
 * Keyed by shipment, not a single boolean. A bare flag stayed true for the rest
 * of the session once any load had been verified, so the next load rendered its
 * stop cards as though it had been photographed too — and "Mark arrival" then
 * failed on the server with a message the card offered no way to act on. Which
 * is exactly what a driver sees as "it asks for the VIN but there is no button".
 *
 * Only an optimistic echo of what the server already knows, so the UI can move
 * on without waiting for the next refresh. The server stays the authority.
 */
const locallyVerified = new Set<string>();

export function markEquipmentVerified(uuid: string): void {
    locallyVerified.add(uuid);
}

export function isEquipmentVerifiedLocally(
    uuid: string | null | undefined,
): boolean {
    return !!uuid && locallyVerified.has(uuid);
}

export default function EquipmentVerificationScreen() {
    const theme = useAppTheme();
    const { uuid, activated } = useLocalSearchParams<{ uuid: string; activated?: string }>();
    const isDark = theme.background === "#0D0F14";

    /*
    | Equipment is verified for a load the driver has started; the server
    | refuses the photos before that. Said here, before three photos are
    | taken for nothing. My Trip opens this screen only for a load it knows
    | is activated, and says so: right after Activate the list can still be
    | on its way with the old answer. A load the list doesn't know, or a list
    | being refreshed, is left to the server, whose refusal is handled below.
    */
    const { active, upcoming, past, loading } = useShipments();
    const load = uuid ? [...active, ...upcoming, ...past].find((s) => s.uuid === uuid) : undefined;
    // Not on `refreshing`: a refresh keeps the last answer, and flipping on it
    // swapped the form for the lock (camera and all) every time the list reloaded.
    const notStarted = activated !== "1" && !loading && !!load && !load.is_activated;
    const openLoad = () => {
        if (uuid) router.replace({ pathname: "/loads/[id]", params: { id: uuid } });
    };

    const [photos, setPhotos] = useState<Record<Slot, string | null>>(EMPTY_SLOTS);
    const [texts, setTexts] = useState<Record<Slot, string>>(EMPTY_TEXTS);
    /* A photo still being compressed or read. */
    const [busy, setBusy] = useState<Record<Slot, boolean>>(IDLE_SLOTS);

    const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
    const [submitting, setSubmitting] = useState(false);
    const [waitingForText, setWaitingForText] = useState(false);

    /*
    | Each photo is compressed and read on its own, and a retake can start
    | before the previous shot has finished. One shared "processing" flag let
    | Confirm send while a read was still running (its text then arrived
    | empty), and a slow read of the old photo could land after the retake's
    | and overwrite it. Now every capture gets a number, only the newest
    | capture for a slot may write that slot, and Confirm waits for whatever
    | is still running. The refs hold the newest values for the submit, which
    | reads them after waiting, when its own render's state is out of date.
    */
    const captureCount = useRef(0);
    const newestCapture = useRef<Partial<Record<Slot, number>>>({});
    const pendingWork = useRef<Partial<Record<Slot, Promise<void>>>>({});
    const photosRef = useRef<Record<Slot, string | null>>({ ...EMPTY_SLOTS });
    const textsRef = useRef<Record<Slot, string>>({ ...EMPTY_TEXTS });

    const setPhoto = (slot: Slot, uri: string) => {
        photosRef.current[slot] = uri;
        setPhotos((prev) => ({ ...prev, [slot]: uri }));
    };

    const setText = (slot: Slot, text: string) => {
        textsRef.current[slot] = text;
        setTexts((prev) => ({ ...prev, [slot]: text }));
    };

    const canComplete = SLOTS.every((slot) => !!photos[slot] || busy[slot]);
    const reading = SLOTS.some((slot) => busy[slot]);

    const bg = isDark ? "#0D0F14" : "#EEEEE6";
    const cardBg = isDark ? "#1A1D24" : "#FFFFFF";
    const bannerBg = isDark ? "#1A237E22" : "#E8EAF6";
    const bannerTitle = isDark ? "#7986CB" : "#1A237E";
    const bannerText = isDark ? "#9FA8DA" : "#3949AB";

    const openCamera = (slot: Slot) => {
        if (!submitting) setCameraTarget(slot);
    };

    const handleCapture = (result: CaptureResult) => {
        const slot = cameraTarget;
        if (!slot) return;

        setCameraTarget(null);

        const capture = ++captureCount.current;
        newestCapture.current[slot] = capture;
        const isNewest = () => newestCapture.current[slot] === capture;

        /*
        | Nothing from the photo being replaced may be sent: its text is cleared
        | now, and so is the photo the submit would read (the old thumbnail stays
        | on screen until the new copy is ready).
        */
        setText(slot, "");
        photosRef.current[slot] = null;
        setBusy((prev) => ({ ...prev, [slot]: true }));

        // Read the original full-size image: smaller copies read worse.
        const read = TextRecognition.recognize(result.uri)
            .then((ocr) => {
                if (isNewest()) setText(slot, ocr.text.trim());
            })
            .catch((err: unknown) => {
                console.warn(`[OCR] ${slot} failed:`, err);
            });

        // Upload a copy at most 1280px wide, 70% quality (~200-400KB).
        const compress = manipulateAsync(
            result.uri,
            [{ resize: { width: 1280 } }],
            { compress: 0.7, format: SaveFormat.JPEG },
        )
            .then((compressed) => compressed.uri)
            .catch((err: unknown) => {
                console.warn("[compress] failed, using original:", err);
                return result.uri;
            })
            .then((uri) => {
                if (isNewest()) setPhoto(slot, uri);
            });

        pendingWork.current[slot] = Promise.all([read, compress]).then(() => {
            if (isNewest()) setBusy((prev) => ({ ...prev, [slot]: false }));
        });
    };

    /* Everything still running, but never longer than TEXT_WAIT_MS. */
    const settlePendingWork = async () => {
        const work = SLOTS.map((slot) => pendingWork.current[slot]).filter(
            (job): job is Promise<void> => !!job,
        );
        if (work.length === 0) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
            Promise.all(work),
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, TEXT_WAIT_MS);
            }),
        ]);
        clearTimeout(timer);
    };

    const handleComplete = async () => {
        if (submitting) return;

        if (!canComplete) {
            const missing = SLOTS.filter((slot) => !photos[slot] && !busy[slot])
                .map((slot) => `• ${SLOT_LABELS[slot]}`)
                .join("\n");
            Alert.alert("Incomplete", `Please complete:\n${missing}`);
            return;
        }

        if (!uuid) {
            Alert.alert("Error", "Shipment ID missing. Please try again.");
            return;
        }

        setSubmitting(true);
        try {
            setWaitingForText(true);
            await settlePendingWork();
            setWaitingForText(false);

            const images = photosRef.current;
            const missing = SLOTS.filter((slot) => !images[slot]);
            if (missing.length > 0) {
                Alert.alert(
                    "Incomplete",
                    `Please retake:\n${missing.map((slot) => `• ${SLOT_LABELS[slot]}`).join("\n")}`,
                );
                return;
            }

            const formData = new FormData();
            for (const slot of SLOTS) {
                formData.append(slot, {
                    uri: images[slot]!,
                    name: `${slot}.jpg`,
                    type: "image/jpeg",
                } as unknown as Blob);
            }

            await api.upload(`/shipments/${uuid}/verify-equipment`, formData);

            /*
            | Sent as read, line breaks and all: the broker shows this text
            | as is. The photos are what the load needs, so if only the text
            | fails to save the driver is not sent back to take them again.
            */
            const text = textsRef.current;
            try {
                await api.post(`/shipments/${uuid}/verify-equipment-ocr`, {
                    vin_text: text.vin_image.slice(0, MAX_TEXT_LENGTH),
                    tractor_text: text.tractor_image.slice(0, MAX_TEXT_LENGTH),
                    trailer_text: text.trailer_image.slice(0, MAX_TEXT_LENGTH),
                });
            } catch (err: unknown) {
                console.warn("[OCR] Text not saved:", err);
            }

            markEquipmentVerified(uuid);
            // The trip's next step and My Equipment both depend on this.
            invalidate("profile", "trip");
            // Opened from a link there may be nothing to go back to.
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/trip");
        } catch (err: unknown) {
            // Started nowhere yet: the list here was out of date.
            if (err instanceof ApiError && err.status === 400 && /activate/i.test(err.message)) {
                invalidate("shipments", "trip");
                Alert.alert(
                    "Start this load first",
                    "This load hasn't been activated yet. Open the load and tap Activate Load, then verify your equipment.",
                    [
                        { text: "Not now", style: "cancel" },
                        { text: "Open load", onPress: openLoad },
                    ],
                );
                return;
            }
            Alert.alert(
                "Verification Failed",
                friendlyError(err, "Equipment verification failed. Please try again."),
            );
        } finally {
            setWaitingForText(false);
            setSubmitting(false);
        }
    };

    /* A soft hint only. A worn plate must not stop a driver from continuing. */
    const vinHint = (): PhotoHint | undefined => {
        if (!photos.vin_image) return undefined;
        if (busy.vin_image) return { text: "Reading the VIN…", tone: "muted" };

        const vin = extractVin(texts.vin_image);
        return vin
            ? { text: `VIN ${vin.vin}`, tone: "good" }
            : { text: "Couldn't read a VIN. Retake it if you can.", tone: "warn" };
    };

    // Without a load there is nothing to verify; said now, not after three photos.
    if (!uuid) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
                <NavHeader title="Verify Equipment" />
                <View style={[styles.lockedCard, { backgroundColor: theme.card }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={32} color={theme.primaryButton} />
                    <AppText variant="label" style={[styles.lockedTitle, { color: theme.text }]}>
                        No load selected
                    </AppText>
                    <AppText variant="caption" style={[styles.lockedBody, { color: theme.secondaryText }]}>
                        Open your load on My Trip and verify the equipment from there.
                    </AppText>
                    <AppButton
                        title="Go to My Trip"
                        onPress={() => router.replace("/(tabs)/trip")}
                        style={styles.lockedButton}
                    />
                </View>
            </SafeAreaView>
        );
    }

    if (notStarted) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
                <NavHeader title="Verify Equipment" />
                <View style={[styles.lockedCard, { backgroundColor: theme.card }]}>
                    <MaterialCommunityIcons name="lock-outline" size={32} color={theme.primaryButton} />
                    <AppText variant="label" style={[styles.lockedTitle, { color: theme.text }]}>
                        Activate this load first
                    </AppText>
                    <AppText variant="caption" style={[styles.lockedBody, { color: theme.secondaryText }]}>
                        Equipment is verified for a load you have started. Open the load and tap Activate
                        Load, then come back to take the photos.
                    </AppText>
                    <AppButton title="Open load" onPress={openLoad} style={styles.lockedButton} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
            {/* Live camera modal */}
            <Modal
                visible={!!cameraTarget}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setCameraTarget(null)}>
                <View style={styles.cameraContainer}>
                    <SafeAreaView pointerEvents="none" style={styles.cameraHeader}>
                        <AppText variant="label" style={styles.cameraTitle}>
                            {cameraTarget === "vin_image"
                                ? "Capture VIN Plate"
                                : cameraTarget === "tractor_image"
                                    ? "Capture Tractor"
                                    : "Capture Trailer"}
                        </AppText>
                    </SafeAreaView>
                    <LiveCamera
                        accessLevel="full"
                        onCapture={handleCapture}
                        onClose={() => setCameraTarget(null)}
                        showFlip
                        showCapture
                        style={styles.camera}
                    />
                </View>
            </Modal>

            <NavHeader title="Verify Equipment" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}>

                {/* Info banner */}
                <View style={[styles.bannerCard, { backgroundColor: bannerBg }]}>
                    <View
                        style={[
                            styles.bannerIcon,
                            { backgroundColor: isDark ? "#1A237E44" : "#fff" },
                        ]}>
                        <MaterialCommunityIcons
                            name="shield-check"
                            size={22}
                            color={bannerTitle}
                        />
                    </View>
                    <View style={styles.bannerText}>
                        <AppText
                            variant="label1"
                            style={[styles.bannerTitle, { color: bannerTitle }]}>
                            Equipment Verification
                        </AppText>
                        <AppText
                            variant="tiny"
                            style={{ color: bannerText, lineHeight: 18 }}>
                            Provide your VIN number and capture photos of the
                            tractor and trailer to unlock your first check-in.
                        </AppText>
                    </View>
                </View>

                {/* Step 1 — VIN Image */}
                <View style={styles.stepSection}>
                    <AppText variant="tiny" style={styles.stepLabel}>
                        STEP 1 · VIN PLATE PHOTO
                    </AppText>
                    <PhotoCapture
                        cardBg={cardBg}
                        isDark={isDark}
                        label="VIN Plate"
                        sublabel="Clear photo of the VIN plate"
                        icon="card-account-details-outline"
                        uri={photos.vin_image}
                        hint={vinHint()}
                        onCapture={() => openCamera("vin_image")}
                        onRetake={() => openCamera("vin_image")}
                        theme={theme}
                    />
                </View>

                {/* Step 2 — Tractor Image */}
                <View style={styles.stepSection}>
                    <AppText variant="tiny" style={styles.stepLabel}>
                        STEP 2 · TRACTOR PHOTO
                    </AppText>
                    <PhotoCapture
                        cardBg={cardBg}
                        isDark={isDark}
                        label="Tractor"
                        sublabel="Full side view of your tractor"
                        icon="truck"
                        uri={photos.tractor_image}
                        onCapture={() => openCamera("tractor_image")}
                        onRetake={() => openCamera("tractor_image")}
                        theme={theme}
                    />
                </View>

                {/* Step 3 — Trailer Image */}
                <View style={styles.stepSection}>
                    <AppText variant="tiny" style={styles.stepLabel}>
                        STEP 3 · TRAILER PHOTO
                    </AppText>
                    <PhotoCapture
                        cardBg={cardBg}
                        isDark={isDark}
                        label="Trailer"
                        sublabel="Full side view of your trailer"
                        icon="truck-trailer"
                        uri={photos.trailer_image}
                        onCapture={() => openCamera("trailer_image")}
                        onRetake={() => openCamera("trailer_image")}
                        theme={theme}
                    />
                </View>

                {/* Info note */}
                <View
                    style={[
                        styles.infoNote,
                        {
                            backgroundColor: isDark ? "#23272F" : "#F9FAFB",
                            borderColor: isDark ? "#374151" : "#E5E7EB",
                        },
                    ]}>
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={16}
                        color={theme.secondaryText}
                    />
                    <AppText
                        variant="tiny"
                        style={{
                            color: theme.secondaryText,
                            flex: 1,
                            lineHeight: 17,
                        }}>
                        All three photos are required. The text on them, like the VIN, is read automatically for your broker.
                    </AppText>
                </View>
                
                {reading && (
                    <View
                        style={[
                            styles.processingBanner,
                            {
                                backgroundColor: isDark ? "#1A237E22" : "#EFF6FF",
                                borderColor: isDark ? "#3949AB44" : "#BFDBFE",
                            },
                        ]}>
                        <ActivityIndicator size="small" color="#2563EB" />
                        <AppText
                            variant="tiny"
                            style={{ color: "#2563EB", fontWeight: "600" }}>
                            Reading text from your photos…
                        </AppText>
                    </View>
                )}

                {/* Submit button */}
                <Pressable
                    style={({ pressed }) => [
                        styles.completeBtn,
                        {
                            backgroundColor: canComplete
                                ? "#2563EB"
                                : isDark
                                    ? "#374151"
                                    : "#D1D5DB",
                            opacity: pressed && canComplete ? 0.9 : 1,
                        },
                    ]}
                    onPress={handleComplete}
                    disabled={submitting}>
                    <AppText
                        variant="label"
                        style={{ color: "#fff", fontWeight: "700" }}>
                        {submitting
                            ? waitingForText
                                ? "Reading photos…"
                                : "Submitting…"
                            : canComplete
                                ? "Confirm & Continue"
                                : "Complete Steps to Continue"}
                    </AppText>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}


interface PhotoHint {
    text: string;
    tone: "good" | "warn" | "muted";
}

interface PhotoCaptureProps {
    cardBg: string;
    isDark: boolean;
    label: string;
    sublabel: string;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
    uri: string | null;
    /** What was read off the photo, shown in place of the retake tip. */
    hint?: PhotoHint;
    onCapture: () => void;
    onRetake: () => void;
    theme: ReturnType<typeof import("@/hooks/useAppTheme").useAppTheme>;
}

function PhotoCapture({
    cardBg,
    isDark,
    label,
    sublabel,
    icon,
    uri,
    hint,
    onCapture,
    onRetake,
    theme,
}: PhotoCaptureProps) {
    const hintColor =
        hint?.tone === "good"
            ? "#16A34A"
            : hint?.tone === "warn"
                ? isDark
                    ? "#F59E0B"
                    : "#B45309"
                : theme.secondaryText;

    return (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.cardRow}>
                <View
                    style={[
                        styles.iconBox,
                        {
                            backgroundColor: isDark ? "#1A237E44" : "#EEF2FF",
                        },
                    ]}>
                    <MaterialCommunityIcons
                        name={icon}
                        size={20}
                        color={isDark ? "#7986CB" : "#3B4CB8"}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <AppText variant="label1" style={{ color: theme.text }}>
                        {label}
                    </AppText>
                    <AppText
                        variant="tiny"
                        style={{ color: theme.secondaryText }}>
                        {sublabel}
                    </AppText>
                </View>
                {uri && (
                    <View style={styles.checkCircle}>
                        <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color="#fff"
                        />
                    </View>
                )}
            </View>

            {uri ? (
                <View style={styles.photoRow}>
                    <Image
                        source={{ uri }}
                        style={styles.photoThumb}
                        resizeMode="cover"
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <MaterialCommunityIcons
                                name="check-circle"
                                size={14}
                                color="#16A34A"
                            />
                            <AppText
                                variant="tiny"
                                style={{ color: "#16A34A", fontWeight: "700" }}>
                                Photo Captured
                            </AppText>
                        </View>
                        {hint ? (
                            <AppText
                                variant="tiny"
                                numberOfLines={2}
                                style={{ color: hintColor, fontWeight: "600" }}>
                                {hint.text}
                            </AppText>
                        ) : (
                            <AppText
                                variant="tiny"
                                style={{ color: theme.secondaryText }}>
                                Tap retake to redo
                            </AppText>
                        )}
                    </View>
                    <Pressable
                        onPress={onRetake}
                        style={[
                            styles.retakeBtn,
                            {
                                borderColor: isDark ? "#374151" : "#D1D5DB",
                            },
                        ]}>
                        <MaterialCommunityIcons
                            name="camera-retake"
                            size={16}
                            color={theme.secondaryText}
                        />
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    style={({ pressed }) => [
                        styles.captureBtn,
                        { backgroundColor: "#2563EB", opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={onCapture}>
                    <MaterialCommunityIcons name="camera" size={18} color="#fff" />
                    <AppText
                        variant="caption"
                        style={{ color: "#fff", fontWeight: "700" }}>
                        Capture {label}
                    </AppText>
                </Pressable>
            )}
        </View>
    );
}


const styles = StyleSheet.create({
    lockedCard: {
        margin: 20,
        borderRadius: 16,
        padding: 22,
        alignItems: "center",
        gap: 10,
    },
    lockedTitle: {
        fontWeight: "700",
        textAlign: "center",
    },
    lockedBody: {
        textAlign: "center",
        lineHeight: 20,
    },
    lockedButton: {
        alignSelf: "stretch",
        marginTop: 6,
    },
    screen: { flex: 1 },
    content: { padding: 16, gap: 16, paddingBottom: 48 },

    bannerCard: {
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        gap: 14,
        alignItems: "flex-start",
    },
    bannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    bannerText: { flex: 1, gap: 4 },
    bannerTitle: { fontWeight: "700", fontSize: 16 },

    stepSection: { gap: 10 },
    stepLabel: {
        fontWeight: "800",
        letterSpacing: 0.8,
        fontSize: 11,
        color: "#2563EB",
    },

    card: {
        borderRadius: 14,
        padding: 14,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    iconText: { fontSize: 22, fontWeight: "900" },
    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#16A34A",
        justifyContent: "center",
        alignItems: "center",
    },

    vinInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        letterSpacing: 1,
    },

    captureBtn: {
        borderRadius: 12,
        paddingVertical: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    photoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    photoThumb: {
        width: 64,
        height: 48,
        borderRadius: 8,
        backgroundColor: "#E5E7EB",
    },
    retakeBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    infoNote: {
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start",
        borderWidth: 1,
    },

    processingBanner: {
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        borderWidth: 1,
    },

    completeBtn: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },

    cameraContainer: { flex: 1 },
    cameraHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        alignItems: "center",
        paddingTop: 8,
    },
    cameraTitle: {
        color: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: "hidden",
    },
    camera: { flex: 1 },
});
