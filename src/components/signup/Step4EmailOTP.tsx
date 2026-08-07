import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
import { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

interface Step4EmailOTPProps {
    registrationToken: string;
    email: string;
    onVerified: () => void;
    onResend: () => void;
}

export default function Step4EmailOTP({
    registrationToken,
    email,
    onVerified,
    onResend,
}: Step4EmailOTPProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
    const [resendSent, setResendSent] = useState(false);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
        return () => clearInterval(id);
    }, [resendTimer]);

    const handleVerify = async () => {
        const code = otp.join("");
        if (code.length < OTP_LENGTH) {
            setHasError(true);
            setTimeout(() => setHasError(false), 600);
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await authApi.verifySignupEmailOtp(registrationToken, email, code);
            onVerified();
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Invalid OTP. Please try again.";
            setError(message);
            setHasError(true);
            setTimeout(() => setHasError(false), 600);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        setOtp(Array(OTP_LENGTH).fill(""));
        setError(null);
        try {
            await authApi.sendSignupEmailOtp(registrationToken, email);
            setResendTimer(RESEND_TIMEOUT);
            setResendSent(true);
            onResend();
            setTimeout(() => setResendSent(false), 3000);
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to resend OTP. Please try again.";
            setError(message);
        }
    };

    const otpFilled = otp.every((d) => d !== "");

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
                            {
                                backgroundColor: theme.cardSecondary,
                            },
                        ]}>
                        <AppText
                            variant="label1"
                            style={[{ color: theme.text }]}>
                            Step 4
                        </AppText>
                    </View>

                    <AppText
                        variant="title"
                        style={[styles.cardTitle, { color: theme.text }]}>
                        Verify your email
                    </AppText>
                    <AppText
                        variant="label1"
                        style={[
                            styles.subtitle,
                            { color: theme.secondaryText },
                        ]}>
                        Sent to{" "}
                        <AppText variant="label1" color="text">
                            {email}
                        </AppText>
                    </AppText>

                    <View style={styles.otpWrapper}>
                        <OtpInput
                            value={otp}
                            onChange={(v) => {
                                setOtp(v);
                                setHasError(false);
                                setError(null);
                            }}
                            hasError={hasError}
                            autoFocus
                        />
                    </View>

                    {error ? (
                        <AppText
                            variant="caption"
                            color="err"
                            style={styles.errorText}>
                            {error}
                        </AppText>
                    ) : null}

                    <View style={styles.resendRow}>
                        {resendSent ? (
                            <AppText variant="caption" color="primaryButton">
                                New code sent!
                            </AppText>
                        ) : resendTimer > 0 ? (
                            <View style={styles.timerRow}>
                                <AppText
                                    variant="caption"
                                    style={{
                                        color: theme.secondaryText,
                                    }}>
                                    Resend code in{" "}
                                    <AppText
                                        variant="caption"
                                        style={{
                                            color: theme.text,
                                        }}>
                                        {resendTimer}s
                                    </AppText>
                                </AppText>
                            </View>
                        ) : (
                            <Pressable onPress={handleResend} hitSlop={10}>
                                <AppText variant="label" color="primaryButton">
                                    Resend email
                                </AppText>
                            </Pressable>
                        )}
                    </View>

                    <AppButton
                        title="Verify Email"
                        onPress={handleVerify}
                        loading={loading}
                        disabled={!otpFilled}
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

    cardTitle: {
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        textAlign: "center",
        marginBottom: 36,
        paddingHorizontal: 10,
    },
    otpWrapper: {
        marginBottom: 24,
    },
    errorText: {
        textAlign: "center",
        marginBottom: 12,
        color: "#ec3131ff",
    },
    resendRow: {
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 32,
    },
    timerRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    primaryButton: {
        borderRadius: 16,
        marginBottom: 24,
    },
});
