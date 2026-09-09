import AppText from "@/components/AppText";
import LiveCamera, { CaptureResult } from "@/components/LiveCamera";
import NavHeader from "@/components/NavHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { api } from "@/lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
    const { uuid } = useLocalSearchParams<{ uuid: string }>();
    const isDark = theme.background === "#0D0F14";

    const [vinImage, setVinImage] = useState<string | null>(null);
    const [tractorImage, setTractorImage] = useState<string | null>(null);
    const [trailerImage, setTrailerImage] = useState<string | null>(null);
    
    // OCR extracted text
    const [vinText, setVinText] = useState<string>("");
    const [tractorText, setTractorText] = useState<string>("");
    const [trailerText, setTrailerText] = useState<string>("");
    
    const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
    const [submitting, setSubmitting] = useState(false);
    const [processingOCR, setProcessingOCR] = useState(false);

    const canComplete = !!vinImage && !!tractorImage && !!trailerImage;

    const bg = isDark ? "#0D0F14" : "#EEEEE6";
    const cardBg = isDark ? "#1A1D24" : "#FFFFFF";
    const bannerBg = isDark ? "#1A237E22" : "#E8EAF6";
    const bannerTitle = isDark ? "#7986CB" : "#1A237E";
    const bannerText = isDark ? "#9FA8DA" : "#3949AB";

    const handleCapture = async (result: CaptureResult) => {
        if (!cameraTarget) return;

        setCameraTarget(null);

        // Run OCR on original full-res image first (better accuracy)
        runOCR(result.uri, cameraTarget);

        // Compress image to max 1280px wide, 70% quality (~200-400KB)
        let finalUri = result.uri;
        try {
            const compressed = await manipulateAsync(
                result.uri,
                [{ resize: { width: 1280 } }],
                { compress: 0.7, format: SaveFormat.JPEG },
            );
            finalUri = compressed.uri;
        } catch (e) {
            console.warn("[compress] failed, using original:", e);
        }

        if (cameraTarget === "vin_image") {
            setVinImage(finalUri);
        } else if (cameraTarget === "tractor_image") {
            setTractorImage(finalUri);
        } else {
            setTrailerImage(finalUri);
        }
    };

    const runOCR = async (uri: string, target: Exclude<CameraTarget, null>) => {
        setProcessingOCR(true);
        console.log(`[OCR] Starting OCR for ${target}...`);
        try {
            const ocrResult = await TextRecognition.recognize(uri);
            const extractedText = ocrResult.text.trim();
            
            console.log(`[OCR] ${target} extracted:`, extractedText);
            
            if (target === "vin_image") {
                setVinText(extractedText);
            } else if (target === "tractor_image") {
                setTractorText(extractedText);
            } else {
                setTrailerText(extractedText);
            }
        } catch (err) {
            console.warn("[OCR] Failed:", err);
        } finally {
            setProcessingOCR(false);
        }
    };

    const handleComplete = async () => {
        if (!canComplete) {
            Alert.alert(
                "Incomplete",
                `Please complete:\n${!vinImage ? "• VIN plate photo\n" : ""}${!tractorImage ? "• Tractor image\n" : ""}${!trailerImage ? "• Trailer image" : ""}`,
            );
            return;
        }

        if (!uuid) {
            Alert.alert("Error", "Shipment ID missing. Please try again.");
            return;
        }

        if (processingOCR) {
            Alert.alert("Please Wait", "Still extracting text from images. Try again in a moment.");
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("vin_image", {
                uri: vinImage!,
                name: "vin_image.jpg",
                type: "image/jpeg",
            } as unknown as Blob);
            formData.append("tractor_image", {
                uri: tractorImage!,
                name: "tractor_image.jpg",
                type: "image/jpeg",
            } as unknown as Blob);
            formData.append("trailer_image", {
                uri: trailerImage!,
                name: "trailer_image.jpg",
                type: "image/jpeg",
            } as unknown as Blob);

            await api.upload(`/shipments/${uuid}/verify-equipment`, formData);

            await api.post(`/shipments/${uuid}/verify-equipment-ocr`, {
                vin_text: vinText,
                tractor_text: tractorText,
                trailer_text: trailerText,
            });

            if (uuid) markEquipmentVerified(uuid);
            router.back();
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Equipment verification failed. Please try again.";
            Alert.alert("Verification Failed", msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
            {/* Live camera modal */}
            <Modal
                visible={!!cameraTarget}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setCameraTarget(null)}>
                <View style={styles.cameraContainer}>
                    <SafeAreaView style={styles.cameraHeader}>
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
                        uri={vinImage}
                        extractedText={vinText}
                        onCapture={() => setCameraTarget("vin_image")}
                        onRetake={() => setCameraTarget("vin_image")}
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
                        uri={tractorImage}
                        extractedText={tractorText}
                        onCapture={() => setCameraTarget("tractor_image")}
                        onRetake={() => setCameraTarget("tractor_image")}
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
                        uri={trailerImage}
                        extractedText={trailerText}
                        onCapture={() => setCameraTarget("trailer_image")}
                        onRetake={() => setCameraTarget("trailer_image")}
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
                        VIN and equipment photos are required. Text is auto-extracted using ML Kit OCR for verification.
                    </AppText>
                </View>
                
                {processingOCR && (
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
                            Extracting text from image…
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
                            ? "Submitting…"
                            : canComplete
                                ? "Confirm & Continue"
                                : "Complete Steps to Continue"}
                    </AppText>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}


interface PhotoCaptureProps {
    cardBg: string;
    isDark: boolean;
    label: string;
    sublabel: string;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
    uri: string | null;
    extractedText?: string;
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
    extractedText,
    onCapture,
    onRetake,
    theme,
}: PhotoCaptureProps) {
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
                        {/* {extractedText ? (
                            <AppText
                                variant="tiny"
                                numberOfLines={2}
                                style={{ 
                                    color: theme.text, 
                                    fontFamily: "Poppins-Medium",
                                    fontSize: 11
                                }}>
                                📝 {extractedText}
                            </AppText>
                        ) : (
                            <AppText
                                variant="tiny"
                                style={{ color: theme.secondaryText }}>
                                Tap retake to redo
                            </AppText>
                        )} */}

                        <AppText
    variant="tiny"
    style={{ color: theme.secondaryText }}>
    Tap retake to redo
</AppText>


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
