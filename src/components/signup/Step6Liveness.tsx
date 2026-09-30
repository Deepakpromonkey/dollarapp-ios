import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
import { startVerification, VerificationStatus } from "@didit-protocol/sdk-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StyleSheet,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
 
const { height } = Dimensions.get("window");
 
interface Step6LivenessProps {
    registrationToken: string;
    onComplete: (diditSessionId: string) => void;
}
 
type LivenessState = "intro" | "loading" | "done" | "review" | "skipped" | "error";

/*
 * What the backend accepts, in local only, to skip the Didit call entirely.
 * Keep in sync with $bypassTokens in DriverAuthController::completeRegistration.
 */
const DEV_BYPASS_SESSION_ID = "dev_bypass";
 
export default function Step6Liveness({
    registrationToken,
    onComplete,
}: Step6LivenessProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
 
    const [uiState, setUiState] = useState<LivenessState>("intro");
    const [errorMessage, setErrorMessage] = useState<string>("");

    /*
     * Skipping sends no session id at all — the backend treats a blank
     * `didit_session_id` as the driver's own choice to finish identity
     * verification later, and creates the account with `liveness_status:
     * "skipped"` instead of failing the request.
     */
    const handleSkip = () => {
        setUiState("skipped");
        onComplete("");
    };

    const handleStart = async () => {
        setUiState("loading");
        try {
            const { data } = await authApi.livenessSession(registrationToken);
            const { didit_session_id, session_token, session_url } = data;
 
            const token =
                session_token ??
                session_url?.split("/").pop() ??
                didit_session_id;
 
            const result = await startVerification(token, {
                loggingEnabled: true,
                showCloseButton: false,
                closeOnComplete: true,
            });
 
            switch (result.type) {
                case "completed":
                    /*
                     * Approved is clean. Pending means Didit has not decided — a
                     * duplicate face, or a document queued for a human — and the
                     * verdict arrives at the backend by webhook later, so the
                     * account is still created, just unverified. Only telling the
                     * driver "verified!" for a session that is actually approved
                     * keeps the screen honest about which of the two happened.
                     */
                    if (result.session.status === VerificationStatus.Approved) {
                        setUiState("done");
                        onComplete(didit_session_id);
                    } else if (result.session.status === VerificationStatus.Pending) {
                        setUiState("review");
                        onComplete(didit_session_id);
                    } else {
                        setErrorMessage(
                            `Verification status: ${result.session.status}. Please try again.`,
                        );
                        setUiState("error");
                    }
                    break;
                case "cancelled":
                    setErrorMessage("Verification was cancelled. Please try again.");
                    setUiState("error");
                    break;
                case "failed":
                    setErrorMessage(
                        result.error.message || "Liveness check failed. Please try again.",
                    );
                    setUiState("error");
                    break;
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to start liveness check. Please try again.";
            setErrorMessage(message);
            setUiState("error");
        }
    };
 
    if (uiState === "loading") {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primaryButton} />
                <AppText
                    variant="label1"
                    color="secondaryText"
                    style={styles.loadingText}>
                    Starting liveness check…
                </AppText>
            </View>
        );
    }
 
    if (uiState === "done") {
        return (
            <View style={[styles.resultContainer, { backgroundColor: theme.background }]}>
                <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={64}
                    color={theme.secondaryButton}
                />
                <AppText
                    variant="title"
                    style={{ color: theme.text, textAlign: "center", marginTop: 20 }}>
                    Liveness verified!
                </AppText>
                <AppText
                    variant="label1"
                    style={{ color: theme.secondaryText, textAlign: "center", marginTop: 8 }}>
                    Your identity has been confirmed. Completing registration…
                </AppText>
            </View>
        );
    }
 
    if (uiState === "skipped") {
        return (
            <View style={[styles.resultContainer, { backgroundColor: theme.background }]}>
                <MaterialCommunityIcons
                    name="clock-outline"
                    size={64}
                    color={theme.secondaryText}
                />
                <AppText
                    variant="title"
                    style={{ color: theme.text, textAlign: "center", marginTop: 20 }}>
                    Identity check skipped
                </AppText>
                <AppText
                    variant="label1"
                    style={{ color: theme.secondaryText, textAlign: "center", marginTop: 8, paddingHorizontal: 24 }}>
                    Completing registration… You can verify your identity anytime
                    from your profile.
                </AppText>
            </View>
        );
    }

    if (uiState === "review") {
        return (
            <View style={[styles.resultContainer, { backgroundColor: theme.background }]}>
                <MaterialCommunityIcons
                    name="clock-outline"
                    size={64}
                    color={theme.secondaryText}
                />
                <AppText
                    variant="title"
                    style={{ color: theme.text, textAlign: "center", marginTop: 20 }}>
                    Under review
                </AppText>
                <AppText
                    variant="label1"
                    style={{ color: theme.secondaryText, textAlign: "center", marginTop: 8, paddingHorizontal: 24 }}>
                    Your identity check needs a manual look. We are creating your
                    account now and will notify you as soon as it clears.
                </AppText>
            </View>
        );
    }

    if (uiState === "error") {
        return (
            <View style={[styles.resultContainer, { backgroundColor: theme.background }]}>
                <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={64}
                    color={theme.err}
                />
                <AppText
                    variant="title"
                    style={{ color: theme.text, textAlign: "center", marginTop: 20 }}>
                    Check failed
                </AppText>
                <AppText
                    variant="label1"
                    style={{ color: theme.secondaryText, textAlign: "center", marginTop: 8, paddingHorizontal: 24 }}>
                    {errorMessage}
                </AppText>
                <AppButton
                    title="Try again"
                    onPress={() => setUiState("intro")}
                    style={styles.primaryButton}
                />
            </View>
        );
    }
 
 
    return (
        <View style={[styles.container, { backgroundColor: theme.card }]}>
            <KeyboardAwareScrollView
                enableOnAndroid
                extraScrollHeight={20}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={[
                    styles.scroll,
                    { backgroundColor: theme.card },
                ]}>
                <View style={styles.greenHeader}>
                    <View style={styles.imageContainer}>
                        <Image
                            source={require("@/assets/images/signup.png")}
                            style={{ width: "100%" }}
                        />
                    </View>
                </View>
 
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.card,
                            paddingBottom: Math.max(insets.bottom + 40, 40),
                        },
                    ]}>
                    <View
                        style={[
                            styles.stepBadge,
                            { backgroundColor: theme.cardSecondary },
                        ]}>
                        <AppText variant="label1" style={{ color: theme.text }}>
                            Step 6
                        </AppText>
                    </View>
 
                    <View
                        style={[
                            styles.innerCard,
                            { backgroundColor: theme.cardSecondary },
                        ]}>
                        <View style={styles.iconCircle}>
                            <MaterialCommunityIcons
                                name="account"
                                size={40}
                                color="#3B82F6"
                            />
                        </View>
 
                        <AppText
                            variant="title"
                            style={[styles.innerCardTitle, { color: theme.text }]}>
                            Face liveness check
                        </AppText>
 
                        <AppText
                            variant="caption"
                            style={[
                                styles.innerCardSubtitle,
                                { color: theme.secondaryText },
                            ]}>
                            Takes about ten seconds. Matched against your CDL photo.
                        </AppText>
                    </View>
 
                    <AppButton
                        title="Start liveness check"
                        onPress={handleStart}
                        style={styles.primaryButton}
                    />

                    <AppButton
                        title="Skip for now"
                        variant="secondary"
                        onPress={handleSkip}
                        style={styles.skipButton}
                    />

                    {/*
                      * Development only. The backend honours this session id in
                      * `local` alone, so a build that somehow shipped the button
                      * would get a 422 rather than an unverified account.
                      */} 
                    {/* {__DEV__ && (
                        <AppButton
                            title="Skip liveness (dev)"
                            variant="secondary"
                            onPress={() => {
                                setUiState("done");
                                onComplete(DEV_BYPASS_SESSION_ID);
                            }}
                            style={styles.devButton}
                        />
                    )} */}
                </View>
            </KeyboardAwareScrollView>
        </View>
    );
}
 
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
    },
    loadingText: {
        marginTop: 8,
    },
    greenHeader: {
        paddingBottom: 32,
    },
    imageContainer: {
        height: height * 0.35,
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        flex: 1,
        width: "100%",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 28,
      borderWidth:1,
        borderBottomWidth:0,
        borderColor:"#B4B4B4",
        paddingTop: 32,
        marginTop: -32,
    },
    stepBadge: {
        alignSelf: "center",
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 24,
        marginBottom: 20,
    },
    innerCard: {
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
        marginBottom: 32,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#EBF4FF",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    innerCardTitle: {
        marginBottom: 8,
    },
    innerCardSubtitle: {
        textAlign: "center",
    },
    primaryButton: {
        borderRadius: 16,
        marginBottom: 24,
        marginTop: 12,
        width: "100%",
    },
    skipButton: {
        borderRadius: 16,
        marginBottom: 24,
        width: "100%",
    },
    devButton: {
        borderRadius: 16,
        marginBottom: 24,
        width: "100%",
    },
    resultContainer: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 60,
    },
});
 
 