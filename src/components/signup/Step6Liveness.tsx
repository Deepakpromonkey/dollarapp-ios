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
 
type LivenessState = "intro" | "loading" | "done" | "error";
 
export default function Step6Liveness({
    registrationToken,
    onComplete,
}: Step6LivenessProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
 
    const [uiState, setUiState] = useState<LivenessState>("intro");
    const [errorMessage, setErrorMessage] = useState<string>("");
 
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
                    if (
                        result.session.status === VerificationStatus.Approved ||
                        result.session.status === VerificationStatus.Pending
                    ) {
                        setUiState("done");
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
    resultContainer: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 60,
    },
});
 
 