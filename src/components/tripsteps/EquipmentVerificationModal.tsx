import AppText from "@/components/AppText";
import LiveCamera, { CaptureResult } from "@/components/LiveCamera";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
 
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface EquipmentVerificationModalProps {
    visible: boolean;
    onComplete: () => void;
    onClose: () => void;
}

type CameraTarget =
    | "tractor_front"
    | "tractor_rear"
    | "tractor_left"
    | "tractor_right"
    | "trailer_front"
    | "trailer_rear"
    | "trailer_left"
    | "trailer_right"
    | "trailer_cargo"
    | "trailer_seal"
    | null;

const TRACTOR_ANGLES = ["Front", "Rear", "Left", "Right"] as const;
const TRAILER_ANGLES = ["Front", "Rear", "Left", "Right", "Cargo", "Seal"] as const;

export default function EquipmentVerificationModal({
    visible,
    onComplete,
    onClose,
}: EquipmentVerificationModalProps) {
    const theme = useAppTheme();

    const [vinVerified, setVinVerified] = useState(false);
    const [vin, setVin] = useState("");
    const [tractorPhotos, setTractorPhotos] = useState<Partial<Record<string, string>>>({});
    const [trailerPhotos, setTrailerPhotos] = useState<Partial<Record<string, string>>>({});
    const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);

    const tractorDone = Object.keys(tractorPhotos).length;
    const trailerDone = Object.keys(trailerPhotos).length;
    const totalDone = tractorDone + trailerDone;
    const totalRequired = 10;


    const nextTractorAngle = TRACTOR_ANGLES.find(
        (a) => !tractorPhotos[a.toLowerCase()]
    );
    
    const nextTrailerAngle = TRAILER_ANGLES.find(
        (a) => !trailerPhotos[a.toLowerCase()]
    );

    const currentCameraLabel = () => {
        if (!cameraTarget) return "";
        const [type, ...rest] = cameraTarget.split("_");
        return `${type === "tractor" ? "Tractor" : "Trailer"} • ${rest
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}`;
    };

    const handleCapture = (result: CaptureResult) => {
        if (!cameraTarget) return;
        const [type, ...rest] = cameraTarget.split("_");
        const key = rest.join("_");
        if (type === "tractor") {
            setTractorPhotos((prev) => ({ ...prev, [key]: result.uri }));
        } else {
            setTrailerPhotos((prev) => ({ ...prev, [key]: result.uri }));
        }
        setCameraTarget(null);
    };

    const handleCapturePress = () => {
        if (!vinVerified) {
            Alert.alert("VIN Required", "Please verify VIN number first");
            return;
        }

        if (nextTractorAngle) {
            setCameraTarget(`tractor_${nextTractorAngle.toLowerCase()}` as CameraTarget);
        } else if (nextTrailerAngle) {
            setCameraTarget(`trailer_${nextTrailerAngle.toLowerCase()}` as CameraTarget);
        }
    };

    const canComplete =
        vinVerified && tractorDone === 4 && trailerDone === 6;

    const handleComplete = () => {
        if (!canComplete) {
            Alert.alert(
                "Incomplete",
                `Please complete all steps:\n${!vinVerified ? "• VIN verification\n" : ""}${tractorDone < 4 ? `• Tractor photos (${tractorDone}/4)\n` : ""}${trailerDone < 6 ? `• Trailer photos (${trailerDone}/6)` : ""}`
            );
            return;
        }
        onComplete();
    };


    const captureLabel = () => {
        if (!vinVerified) return "Verify VIN First";
        if (nextTractorAngle) return `Capture Tractor • ${nextTractorAngle}`;
        if (nextTrailerAngle) return `Capture Trailer • ${nextTrailerAngle}`;
        return "All Photos Captured ✓";
    };

    const allPhotosDone = tractorDone === 4 && trailerDone === 6;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}>
            <SafeAreaView
                style={[styles.screen, { backgroundColor: "#EEEEE6" }]}>
               
                <Modal
                    visible={!!cameraTarget}
                    animationType="slide"
                    presentationStyle="fullScreen"
                    onRequestClose={() => setCameraTarget(null)}>
                    <View style={styles.cameraContainer}>
                        <SafeAreaView style={styles.cameraHeader}>
                            <AppText
                                variant="label"
                                style={styles.cameraTitle}>
                                {currentCameraLabel()}
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

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}>
                   
                    <View
                        style={[
                            styles.bannerCard,
                            { backgroundColor: "#E8EAF6" },
                        ]}>
                        <View
                            style={[
                                styles.bannerIcon,
                                { backgroundColor: "#fff" },
                            ]}>
                            <MaterialCommunityIcons
                                name="shield-check"
                                size={28}
                                color="#1A237E"
                            />
                        </View>
                        <View style={styles.bannerText}>
                            <AppText
                                variant="label"
                                style={[
                                    styles.bannerTitle,
                                    { color: "#1A237E" },
                                ]}>
                                Security Check
                            </AppText>
                            <AppText
                                variant="caption"
                                style={{ color: "#3949AB", lineHeight: 18 }}>
                                Before starting, verify your tractor and trailer.
                                This protects you and the freight — unlocking
                                your first check-in.
                            </AppText>
                        </View>
                    </View>

              
                    <View style={styles.stepSection}>
                        <AppText
                            variant="tiny"
                            style={[styles.stepLabel, { color: "#2563EB" }]}>
                            STEP 1
                        </AppText>
                        <View
                            style={[
                                styles.stepCard,
                                { backgroundColor: "#fff" },
                            ]}>
                            <View
                                style={[
                                    styles.stepIconBox,
                                    { backgroundColor: "#EEF2FF" },
                                ]}>
                                <AppText style={styles.stepIconText}>#</AppText>
                            </View>
                            <View style={styles.stepCardContent}>
                                <AppText
                                    variant="label"
                                    style={styles.stepCardTitle}>
                                    VIN Verification
                                </AppText>
                                <AppText
                                    variant="tiny"
                                    style={{ color: "#6B7280" }}>
                                    Live OCR • Matched to COI
                                </AppText>
                            </View>
                            {vinVerified ? (
                                <View style={styles.checkCircle}>
                                    <MaterialCommunityIcons
                                        name="check"
                                        size={16}
                                        color="#fff"
                                    />
                                </View>
                            ) : (
                                <Pressable
                                    onPress={() => {
                                        /* open VIN input */
                                    }}
                                    style={styles.plusCircle}>
                                    <MaterialCommunityIcons
                                        name="plus"
                                        size={20}
                                        color="#374151"
                                    />
                                </Pressable>
                            )}
                        </View>

     
                        {!vinVerified && (
                            <View
                                style={[
                                    styles.vinInputCard,
                                    { backgroundColor: "#fff" },
                                ]}>
                                <TextInput
                                    style={[
                                        styles.vinInput,
                                        {
                                            color: "#111827",
                                            borderColor: "#D1D5DB",
                                        },
                                    ]}
                                    placeholder="Enter VIN number"
                                    placeholderTextColor="#9CA3AF"
                                    value={vin}
                                    onChangeText={setVin}
                                    autoCapitalize="characters"
                                    maxLength={17}
                                />
                                <Pressable
                                    style={[
                                        styles.vinBtn,
                                        {
                                            backgroundColor:
                                                vin.trim().length >= 5
                                                    ? "#2563EB"
                                                    : "#D1D5DB",
                                        },
                                    ]}
                                    onPress={() => {
                                        if (vin.trim().length >= 5) {
                                            setVinVerified(true);
                                        }
                                    }}
                                    disabled={vin.trim().length < 5}>
                                    <AppText
                                        variant="caption"
                                        style={{
                                            color: "#fff",
                                            fontWeight: "700",
                                        }}>
                                        Verify VIN
                                    </AppText>
                                </Pressable>
                            </View>
                        )}

                        {vinVerified && (
                            <View
                                style={[
                                    styles.vinVerifiedBadge,
                                    { backgroundColor: "#F0FDF4" },
                                ]}>
                                <MaterialCommunityIcons
                                    name="check-circle"
                                    size={14}
                                    color="#16A34A"
                                />
                                <AppText
                                    variant="tiny"
                                    style={{
                                        color: "#16A34A",
                                        fontWeight: "600",
                                    }}>
                                    VIN Verified: {vin}
                                </AppText>
                            </View>
                        )}
                    </View>

                    {/* Step 2 — Equipment Photos */}
                    <View style={styles.stepSection}>
                        <View style={styles.stepLabelRow}>
                            <AppText
                                variant="tiny"
                                style={[
                                    styles.stepLabel,
                                    { color: "#2563EB" },
                                ]}>
                                STEP 2
                            </AppText>
                            <AppText
                                variant="label"
                                style={{ fontWeight: "700", color: "#111827" }}>
                                Equipment Photos
                            </AppText>
                            <View
                                style={[
                                    styles.totalBadge,
                                    {
                                        backgroundColor: "#fff",
                                        borderColor: "#E5E7EB",
                                    },
                                ]}>
                                <AppText
                                    variant="tiny"
                                    style={{ color: "#374151", fontWeight: "600" }}>
                                    {totalDone} / {totalRequired} Total
                                </AppText>
                            </View>
                        </View>

                        <View
                            style={[
                                styles.photoCard,
                                { backgroundColor: "#fff" },
                            ]}>
                           
                            <View style={styles.vehicleRow}>
                                <View style={styles.vehicleInfo}>
                                    <AppText
                                        variant="caption"
                                        style={{
                                            fontWeight: "600",
                                            color: "#111827",
                                        }}>
                                        Tractor
                                    </AppText>
                                    <AppText
                                        variant="tiny"
                                        style={{
                                            color:
                                                tractorDone >= 4
                                                    ? "#16A34A"
                                                    : "#2563EB",
                                            fontWeight: "700",
                                        }}>
                                        {tractorDone}/4
                                    </AppText>
                                </View>
                                <View style={styles.vehicleInfo}>
                                    <AppText
                                        variant="caption"
                                        style={{
                                            fontWeight: "600",
                                            color: "#111827",
                                        }}>
                                        Trailer
                                    </AppText>
                                    <AppText
                                        variant="tiny"
                                        style={{
                                            color:
                                                trailerDone >= 6
                                                    ? "#16A34A"
                                                    : "#2563EB",
                                            fontWeight: "700",
                                        }}>
                                        {trailerDone}/6
                                    </AppText>
                                </View>
                            </View>

                           
                            <View style={styles.vehicleRow}>
                                <ProgressBar value={tractorDone} max={4} />
                                <ProgressBar value={trailerDone} max={6} />
                            </View>

                           
                            <View style={styles.vehicleRow}>
                                <View style={styles.angleInfo}>
                                    <MaterialCommunityIcons
                                        name="truck"
                                        size={14}
                                        color="#6B7280"
                                    />
                                    <AppText
                                        variant="tiny"
                                        style={{ color: "#6B7280" }}>
                                        4 angles required
                                    </AppText>
                                </View>
                                <View style={styles.angleInfo}>
                                    <MaterialCommunityIcons
                                        name="truck-trailer"
                                        size={14}
                                        color="#6B7280"
                                    />
                                    <AppText
                                        variant="tiny"
                                        style={{ color: "#6B7280" }}>
                                        6 angles required
                                    </AppText>
                                </View>
                            </View>

             
                            <View style={styles.vehicleRow}>
                                <AngleDots
                                    angles={TRACTOR_ANGLES as unknown as string[]}
                                    captured={tractorPhotos}
                                />
                                <AngleDots
                                    angles={TRAILER_ANGLES as unknown as string[]}
                                    captured={trailerPhotos}
                                />
                            </View>
                        </View>

     
                        <Pressable
                            style={({ pressed }) => [
                                styles.captureBtn,
                                {
                                    backgroundColor: allPhotosDone
                                        ? "#16A34A"
                                        : !vinVerified
                                          ? "#9CA3AF"
                                          : "#2563EB",
                                    opacity: pressed ? 0.9 : 1,
                                },
                            ]}
                            onPress={handleCapturePress}
                            disabled={allPhotosDone || !vinVerified}>
                            <MaterialCommunityIcons
                                name="camera"
                                size={20}
                                color="#fff"
                            />
                            <AppText
                                variant="caption"
                                style={{
                                    color: "#fff",
                                    fontWeight: "700",
                                    letterSpacing: 0.3,
                                }}>
                                {captureLabel()}
                            </AppText>
                        </Pressable>
                    </View>

            
                    <View
                        style={[
                            styles.infoNote,
                            { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
                        ]}>
                        <MaterialCommunityIcons
                            name="information-outline"
                            size={16}
                            color="#9CA3AF"
                        />
                        <AppText
                            variant="tiny"
                            style={{ color: "#6B7280", flex: 1, lineHeight: 17 }}>
                            License plates are captured during check-in. VIN and
                            condition photos are required to unlock the load.
                        </AppText>
                    </View>

      
                    <Pressable
                        style={({ pressed }) => [
                            styles.completeBtn,
                            {
                                backgroundColor: canComplete
                                    ? "#2563EB"
                                    : "#D1D5DB",
                                opacity: pressed && canComplete ? 0.9 : 1,
                            },
                        ]}
                        onPress={handleComplete}>
                        <AppText
                            variant="label"
                            style={{
                                color: "#fff",
                                fontWeight: "700",
                                letterSpacing: 0.3,
                            }}>
                            {canComplete
                                ? "Confirm & Unlock Load"
                                : "Complete All Steps to Continue"}
                        </AppText>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}



function ProgressBar({ value, max }: { value: number; max: number }) {
    const pct = Math.min(value / max, 1);
    return (
        <View style={progressStyles.track}>
            <View
                style={[
                    progressStyles.fill,
                    {
                        width: `${pct * 100}%` as any,
                        backgroundColor: pct >= 1 ? "#16A34A" : "#2563EB",
                    },
                ]}
            />
        </View>
    );
}

function AngleDots({
    angles,
    captured,
}: {
    angles: string[];
    captured: Partial<Record<string, string>>;
}) {
    return (
        <View style={dotStyles.row}>
            {angles.map((a) => {
                const done = !!captured[a.toLowerCase()];
                return (
                    <View
                        key={a}
                        style={[
                            dotStyles.dot,
                            {
                                backgroundColor: done ? "#16A34A" : "#E5E7EB",
                            },
                        ]}>
                        <AppText
                            variant="tiny"
                            style={{
                                color: done ? "#fff" : "#6B7280",
                                fontSize: 8,
                                fontWeight: "700",
                            }}>
                            {a.charAt(0)}
                        </AppText>
                    </View>
                );
            })}
        </View>
    );
}

const progressStyles = StyleSheet.create({
    track: {
        flex: 1,
        height: 4,
        backgroundColor: "#E5E7EB",
        borderRadius: 2,
        marginHorizontal: 2,
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        borderRadius: 2,
    },
});

const dotStyles = StyleSheet.create({
    row: {
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        paddingHorizontal: 2,
    },
    dot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
});

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 16, gap: 16, paddingBottom: 40 },


    bannerCard: {
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        gap: 14,
        alignItems: "flex-start",
    },
    bannerIcon: {
        width: 52,
        height: 52,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    bannerText: { flex: 1, gap: 4 },
    bannerTitle: { fontWeight: "700", fontSize: 16, color: "#1A237E" },


    stepSection: { gap: 10 },
    stepLabelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepLabel: { fontWeight: "800", letterSpacing: 0.8, fontSize: 11 },


    stepCard: {
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    stepIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    stepIconText: { fontSize: 22, fontWeight: "900", color: "#3B4CB8" },
    stepCardContent: { flex: 1, gap: 2 },
    stepCardTitle: { fontWeight: "700", fontSize: 15, color: "#111827" },

    checkCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#16A34A",
        justifyContent: "center",
        alignItems: "center",
    },
    plusCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
    },

   
    vinInputCard: {
        borderRadius: 12,
        padding: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
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
    vinBtn: {
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: "center",
    },
    vinVerifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },


    totalBadge: {
        marginLeft: "auto",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    photoCard: {
        borderRadius: 14,
        padding: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    vehicleRow: {
        flexDirection: "row",
        gap: 12,
    },
    vehicleInfo: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 2,
    },
    angleInfo: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 2,
    },


    captureBtn: {
        borderRadius: 14,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
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


    completeBtn: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 4,
    },

  
    cameraContainer: { flex: 1, backgroundColor: "#000" },
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
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: "hidden",
    },
    camera: { flex: 1 },
});
