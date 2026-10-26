import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getPositionWithin } from "@/utils/currentPosition";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
// import Constants from "expo-constants";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export type CameraAccessLevel = "limited" | "full";

export interface CaptureResult {
    uri: string;
    ip: string;
    location: string;
    coordinates: string;
    timestamp: string;
}

export interface LiveCameraProps {
    accessLevel?: CameraAccessLevel;

    onCapture?: (data: CaptureResult) => void;

    onClose?: () => void;

    style?: ViewStyle;

    showFlip?: boolean;

    showCapture?: boolean;
}

// function getDeviceIP(): string {
//     const hostUri =
//         (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
//         (Constants as unknown as { debuggerHost?: string })?.debuggerHost ??
//         null;

//     if (hostUri) {
//         const ip = hostUri.split(":")[0];
//         if (ip && ip !== "localhost" && ip !== "127.0.0.1") return ip;
//     }
//     return "unavailable";
// }

export { LiveCamera };
export default LiveCamera;

function LiveCamera({
    accessLevel = "full",
    onCapture,
    onClose,
    style,
    showFlip = true,
    showCapture = true,
}: LiveCameraProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();

    const [cameraPermission, requestCameraPermission, getCameraPermission] =
        useCameraPermissions();

    /*
    | Go straight to the system prompt the first time, showing nothing of our
    | own beforehand.
    |
    | App Review rejected the previous flow under guideline 5.1.1(iv): a custom
    | screen stood in front of the OS dialog with a "Grant Camera Access"
    | button and a "Not now" that dismissed it, letting the driver defer the
    | request indefinitely. Apple requires that a user who sees an explanation
    | always goes on to the real prompt.
    |
    | Opening the camera is itself the driver asking to take a photo, so the
    | prompt needs no preamble. The explanatory screen below now renders only
    | after a denial, which is the case Apple's guidance explicitly allows.
    */
    const hasRequestedCamera = useRef(false);

    useEffect(() => {
        if (!cameraPermission || hasRequestedCamera.current) return;
        if (cameraPermission.status !== "undetermined") return;

        hasRequestedCamera.current = true;
        requestCameraPermission();
    }, [cameraPermission, requestCameraPermission]);

    const [facing, setFacing] = useState<CameraType>("back");
    const [capturing, setCapturing] = useState(false);
    /*
    | The shutter waits for the camera to report itself open. A tap while it is
    | still starting up goes to a camera that is not there and never answers.
    */
    const [cameraReady, setCameraReady] = useState(false);
    /*
    | A camera that never opens (no back camera, an unsupported device, a
    | driver tapping before it bound) used to leave a black preview and a
    | greyed shutter with no explanation. After a wait, or on a start error,
    | the screen says so and offers to start the camera again.
    */
    const [startFailed, setStartFailed] = useState(false);
    const [cameraAttempt, setCameraAttempt] = useState(0);
    const cameraRef = useRef<CameraView>(null);

    // A shot finishing after this camera closed must not land anywhere.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    // Only counts once the camera is allowed: before that the permission card is showing, not a camera.
    const cameraAllowed = !!cameraPermission?.granted;
    useEffect(() => {
        if (!cameraAllowed || cameraReady || startFailed) return;
        const timer = setTimeout(() => setStartFailed(true), 10_000);
        return () => clearTimeout(timer);
    }, [cameraAllowed, cameraReady, startFailed, cameraAttempt]);

    const retryCamera = () => {
        setStartFailed(false);
        setCameraReady(false);
        setCameraAttempt((n) => n + 1);
    };

    const [locationText, setLocationText] = useState<string>("—");
    const [coordsText, setCoordsText] = useState<string>("");

    // const [deviceIP] = useState<string>(getDeviceIP);
    const [deviceIP, setDeviceIP] = useState("Loading...");

    // Promise chains rather than await: state is only ever set once the lookups answer.
    const fetchDeviceIP = useCallback(
        () =>
            Network.getIpAddressAsync()
                .then((ip) => setDeviceIP(ip || "Unavailable"))
                .catch(() => setDeviceIP("Unavailable")),
        [],
    );

    /*
    | The location stamp only reads the permission, it never asks. The trip
    | screen is the one place that asks for location; a second prompt from
    | the camera used to queue up behind the trip screen's own.
    */
    const fetchLocation = useCallback(() => {
        if (accessLevel !== "full") return Promise.resolve();

        return Location.getForegroundPermissionsAsync()
            .catch(() => null)
            .then(async (permission) => {
                if (!permission?.granted) {
                    setLocationText("location off");
                    return;
                }

                const pos = await getPositionWithin(Location.Accuracy.Balanced);
                if (!pos) {
                    setLocationText("unavailable");
                    return;
                }
                const { latitude, longitude } = pos.coords;
                setCoordsText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);

                const [place] = await Location.reverseGeocodeAsync({
                    latitude,
                    longitude,
                });
                if (place) {
                    const city = place.city ?? place.district ?? place.region ?? "";
                    const region = place.region ?? "";
                    setLocationText(
                        [city, region].filter(Boolean).join(", ") || "unknown",
                    );
                }
            })
            .catch(() => setLocationText("unavailable"));
    }, [accessLevel]);

    // useEffect(() => {
    //     fetchLocation();
    // }, [fetchLocation]);
    useEffect(() => {
        fetchLocation();
        fetchDeviceIP();
    }, [fetchLocation, fetchDeviceIP]);

    /*
    | expo's permission hook reads the status once. A driver who enables the
    | camera (or location) in Settings and comes back would otherwise still
    | see the "blocked" card until this screen was opened again.
    */
    const needsLocation = !coordsText;

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") return;
            getCameraPermission().catch(() => {});
            if (needsLocation) fetchLocation();
        });
        return () => subscription.remove();
    }, [getCameraPermission, fetchLocation, needsLocation]);

    const handleCapture = async () => {
        if (!cameraRef.current || capturing || !cameraReady) return;
        try {
            setCapturing(true);
            /*
            | A capture the camera never answers (it can happen while it is
            | still binding) would otherwise leave the shutter greyed out until
            | the camera was closed and reopened.
            */
            const photo = await Promise.race([
                cameraRef.current.takePictureAsync({
                    quality: 0.4,
                    skipProcessing: Platform.OS === "android",
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("The camera did not respond")), 15_000),
                ),
            ]);
            if (photo?.uri) {
                if (!alive.current) return;
                onCapture?.({
                    uri: photo.uri,
                    ip: deviceIP,
                    location: locationText,
                    coordinates: coordsText,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (err) {
            console.warn("[LiveCamera] capture error:", err);
        } finally {
            setCapturing(false);
        }
    };

    if (!cameraPermission || cameraPermission.status === "undetermined") {
        return (
            <View
                style={[
                    styles.centered,
                    { backgroundColor: theme.background },
                    style,
                ]}>
                <ActivityIndicator color={theme.primaryButton} />
            </View>
        );
    }

    if (!cameraPermission.granted) {
     
        const hardDenied = !cameraPermission.canAskAgain;

        return (
            <View style={[styles.permissionOverlay, style]}>
                
                <View style={styles.permissionBg} />


                <View style={styles.permissionIconWrap}>
                    <AppText style={styles.permissionIcon}>📷</AppText>
                </View>

      
                <View
                    style={[
                        styles.permissionCard,
                        { backgroundColor: theme.card },
                    ]}>
     
                    <View
                        style={[
                            styles.permissionHandle,
                            { backgroundColor: theme.cardSecondary },
                        ]}
                    />

                
                    <View
                        style={[
                            styles.permissionBadge,
                            {
                                backgroundColor: hardDenied
                                    ? "#FEF2F2"
                                    : "#EFF6FF",
                            },
                        ]}>
                        <AppText
                            variant="tiny"
                            style={{
                                color: hardDenied ? "#EF4444" : "#2563EB",
                                fontWeight: "700",
                                letterSpacing: 0.6,
                            }}>
                            {hardDenied
                                ? "⛔  ACCESS BLOCKED"
                                : "🔒  PERMISSION NEEDED"}
                        </AppText>
                    </View>

                    <AppText
                        variant="title"
                        style={[
                            styles.permissionTitle,
                            { color: theme.text },
                        ]}>
                        {hardDenied
                            ? "Camera Access Blocked"
                            : "Camera Access Needed"}
                    </AppText>

                    <AppText
                        variant="caption"
                        style={[
                            styles.permissionDesc,
                            { color: theme.secondaryText },
                        ]}>
                        {hardDenied
                            ? "Camera access was permanently denied. Enable it from your device Settings to continue."
                            : "Verification photos cannot be captured without camera access. Tap Continue to allow it."}
                    </AppText>

                    <Pressable
                        onPress={
                            hardDenied
                                ? () => Linking.openSettings()
                                : requestCameraPermission
                        }
                        style={({ pressed }) => [
                            styles.permissionBtn,
                            { backgroundColor: theme.primaryButton },
                            pressed && { opacity: 0.85 },
                        ]}>
                        <AppText
                            variant="label"
                            style={{ color: "#fff", fontWeight: "600" }}>
                            {hardDenied ? "Open Settings" : "Continue"}
                        </AppText>
                    </Pressable>

                    {onClose && (
                        <Pressable
                            onPress={onClose}
                            style={styles.permissionDismiss}>
                            <AppText
                                variant="caption"
                                style={{ color: theme.secondaryText }}>
                                Go back
                            </AppText>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, style]}>
            <CameraView
                key={cameraAttempt}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                onCameraReady={() => {
                    setCameraReady(true);
                    setStartFailed(false);
                }}
                onMountError={(event) => {
                    console.warn("[LiveCamera] camera could not start:", event?.message);
                    setStartFailed(true);
                }}
            />

            {onClose && (
                <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    style={[styles.closeBtn, { top: insets.top + 20 }]}
                    accessibilityLabel="Close camera">
                    <AppText style={styles.closeBtnText}>✕</AppText>
                </Pressable>
            )}

            <View style={[styles.infoBar, { top: insets.top + 20 }]}>
                <View style={styles.infoRow}>
                    <AppText variant="tiny" style={styles.infoLabel}>
                        IP
                    </AppText>
                    <AppText variant="tiny" style={styles.infoValue}>
                        {deviceIP}
                    </AppText>
                </View>

                {accessLevel === "full" && (
                    <View style={styles.infoRow}>
                        <AppText variant="tiny" style={styles.infoLabel}>
                            LOC
                        </AppText>
                        <View style={styles.locationTexts}>
                            {/* <AppText variant="tiny" style={styles.infoValue}>
                                {locationText}
                            </AppText> */}
                            {coordsText ? (
                                <AppText
                                    variant="tiny"
                                    style={styles.coordsText}>
                                    {coordsText}
                                </AppText>
                            ) : null}
                        </View>
                    </View>
                )}
            </View>

            {startFailed && !cameraReady && (
                <View style={styles.startFailed}>
                    <AppText variant="label1" style={styles.startFailedTitle}>
                        Camera couldn&apos;t start
                    </AppText>
                    <AppText variant="caption" style={styles.startFailedBody}>
                        Try again{showFlip ? ", or flip to the other camera" : ""}.
                    </AppText>
                    <Pressable onPress={retryCamera} hitSlop={8} style={styles.startFailedButton}>
                        <AppText variant="label1" style={styles.startFailedButtonText}>
                            Try again
                        </AppText>
                    </Pressable>
                </View>
            )}

            <View style={styles.controls}>
                {showFlip && (
                    <Pressable
                        onPress={() =>
                            setFacing((f) => (f === "back" ? "front" : "back"))
                        }
                        hitSlop={10}
                        style={styles.iconBtn}
                        accessibilityLabel="Flip camera">
                        <AppText style={styles.iconBtnText}>⟳</AppText>
                    </Pressable>
                )}

                {showCapture && (
                    <Pressable
                        onPress={handleCapture}
                        disabled={capturing || !cameraReady}
                        style={[
                            styles.shutterOuter,
                            (capturing || !cameraReady) && styles.shutterDisabled,
                        ]}
                        accessibilityLabel="Take photo">
                        <View style={styles.shutterInner} />
                    </Pressable>
                )}

                {showFlip && <View style={styles.iconBtn} />}
            </View>
        </SafeAreaView>
    );
}

const OVERLAY_BG = "rgba(0,0,0,0.55)";
const OVERLAY_TEXT = "#FFFFFF";

const styles = StyleSheet.create({
    startFailed: {
        position: "absolute",
        left: 24,
        right: 24,
        top: "35%",
        alignItems: "center",
        gap: 8,
        padding: 16,
        borderRadius: 14,
        backgroundColor: "rgba(0,0,0,0.7)",
    },
    startFailedTitle: { color: "#FFFFFF", fontWeight: "700" },
    startFailedBody: { color: "#E5E7EB", textAlign: "center" },
    startFailedButton: {
        marginTop: 4,
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
    },
    startFailedButtonText: { color: "#111827", fontWeight: "700" },
    container: {
        flex: 1,
        overflow: "hidden",
        backgroundColor: "#000",
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        padding: 24,
    },

    permissionOverlay: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "flex-end",
    },
    permissionBg: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "#0a0a0a",
    },
    permissionIconWrap: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 160,
        justifyContent: "center",
        alignItems: "center",
    },
    permissionIcon: {
        fontSize: 64,
        opacity: 0.15,
    },
    permissionCard: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 36,
        gap: 14,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
    },
    permissionHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 4,
    },
    permissionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    permissionTitle: {
        fontWeight: "700",
        textAlign: "center",
    },
    permissionDesc: {
        textAlign: "center",
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    permissionBtn: {
        width: "100%",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 4,
    },
    permissionDismiss: {
        paddingVertical: 4,
    },

    // ── Close ──
    closeBtn: {
        flex:1,
        position: "absolute",
        right: 16,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: OVERLAY_BG,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
  elevation: 9999, 
    },
    closeBtnText: {
        color: OVERLAY_TEXT,
        fontSize: 16,
        lineHeight: 18,
        
    },

    infoBar: {
        position: "absolute",
        left: 16,
        backgroundColor: OVERLAY_BG,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 4,
        maxWidth: "70%",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
    },
    infoLabel: {
        color: "rgba(255,255,255,0.55)",
        letterSpacing: 0.5,
        width: 28,
        marginTop: 1,
    },
    infoValue: {
        color: OVERLAY_TEXT,
        fontWeight: "600",
        flexShrink: 1,
    },
    locationTexts: {
        flex: 1,
        gap: 1,
    },
    coordsText: {
        color: "rgba(255,255,255,0.7)",
    },

    controls: {
        position: "absolute",
        bottom: 36,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: OVERLAY_BG,
        justifyContent: "center",
        alignItems: "center",
    },
    iconBtnText: {
        color: OVERLAY_TEXT,
        fontSize: 22,
    },
    shutterOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: OVERLAY_TEXT,
        justifyContent: "center",
        alignItems: "center",
    },
    shutterInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: OVERLAY_TEXT,
    },
    shutterDisabled: {
        opacity: 0.4,
    },
});
