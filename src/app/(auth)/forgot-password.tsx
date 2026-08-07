import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import CountryPicker, { COUNTRIES, Country } from "@/components/CountryPicker";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

function stripDigits(val: string): string {
    return val.replace(/\D/g, "");
}

type Step = 1 | 2 | 3;

export default function ForgotPasswordScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState<Step>(1);

    const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
    const [phone, setPhone] = useState("");
    const [pickerVisible, setPickerVisible] = useState(false);

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [hasError, setHasError] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [resetToken, setResetToken] = useState("");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const confirmRef = useRef<TextInput>(null);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
        return () => clearInterval(id);
    }, [resendTimer]);

    const digits = stripDigits(phone);
    const maxLen = Math.max(...selectedCountry.digitLengths);
    const minLen = Math.min(...selectedCountry.digitLengths);
    const isPhoneValid = digits.length >= minLen && digits.length <= maxLen;
    const contact = `${selectedCountry.dialCode}${digits}`;

    const handleSendOTP = async () => {
        if (!isPhoneValid) return;
        setLoading(true);
        setErrorMsg(null);
        try {
            await authApi.forgotPasswordSendOtp(contact);
            setStep(2);
            setResendTimer(RESEND_TIMEOUT);
        } catch (err: any) {
            setErrorMsg(err?.message ?? "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        setOtp(Array(OTP_LENGTH).fill(""));
        setErrorMsg(null);
        setLoading(true);
        try {
            await authApi.forgotPasswordSendOtp(contact);
            setResendTimer(RESEND_TIMEOUT);
        } catch (err: any) {
            setErrorMsg(err?.message ?? "Failed to resend OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const code = otp.join("");
        if (code.length < OTP_LENGTH) {
            setHasError(true);
            setTimeout(() => setHasError(false), 600);
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data } = await authApi.forgotPasswordVerifyOtp(contact, code);
            setResetToken(data.reset_token);
            setStep(3);
        } catch (err: any) {
            setHasError(true);
            setErrorMsg(err?.message ?? "Invalid OTP. Please try again.");
            setTimeout(() => setHasError(false), 600);
        } finally {
            setLoading(false);
        }
    };

    const passwordsMatch =
        newPassword.length >= 8 && newPassword === confirmPassword;

    const handleResetPassword = async () => {
        if (!passwordsMatch) {
            setErrorMsg(
                newPassword.length < 8
                    ? "Password must be at least 8 characters."
                    : "Passwords do not match.",
            );
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
            await authApi.forgotPasswordReset(resetToken, newPassword);
            router.replace("/(auth)/login" as any);
        } catch (err: any) {
            setErrorMsg(err?.message ?? "Failed to reset password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const otpFilled = otp.every((d) => d !== "");

    const goBack = () => {
        if (step === 1) {
            router.back();
        } else if (step === 2) {
            setOtp(Array(OTP_LENGTH).fill(""));
            setErrorMsg(null);
            setStep(1);
        } else {
            setNewPassword("");
            setConfirmPassword("");
            setErrorMsg(null);
            setStep(2);
        }
    };

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

                <View style={styles.header}>
                    <View
                        style={[
                            styles.imageContainer,
                            { paddingTop: insets.top },
                        ]}>
                        <Image
                            source={require("@/assets/images/login.png")}
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
                   
                    {errorMsg ? (
                        <View
                            style={[
                                styles.errorBox,
                                {
                                    backgroundColor: theme.err + "20",
                                    borderColor: theme.err,
                                },
                            ]}>
                            <AppText variant="caption" color="err">
                                {errorMsg}
                            </AppText>
                        </View>
                    ) : null}

                    {step === 1 && (
                        <>
                            <AppText
                                variant="title"
                                style={[styles.cardTitle, { color: theme.text }]}>
                                Forgot Password
                            </AppText>
                            <AppText
                                variant="label1"
                                color="secondaryText"
                                style={styles.subtitle}>
                                Enter your registered phone number. We'll send
                                you a verification code.
                            </AppText>

                            <AppInput
                                label="PHONE NUMBER"
                                placeholder="Enter phone number"
                                keyboardType="phone-pad"
                                autoComplete="tel"
                                returnKeyType="done"
                                maxLength={maxLen}
                                onSubmitEditing={handleSendOTP}
                                value={phone}
                                onChangeText={(t) => {
                                    const raw = stripDigits(t);
                                    if (raw.length <= maxLen) setPhone(raw);
                                    setErrorMsg(null);
                                }}
                                containerStyle={styles.field}
                                leftIcon={
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                        }}>
                                        <Pressable
                                            style={styles.countryPickerTrigger}
                                            onPress={() =>
                                                setPickerVisible(true)
                                            }
                                            hitSlop={8}>
                                            <AppText variant="label1">
                                                {selectedCountry.flag}
                                            </AppText>
                                            <AppText
                                                variant="label1"
                                                style={{ color: theme.text }}>
                                                {selectedCountry.dialCode}
                                            </AppText>
                                            <MaterialCommunityIcons
                                                name="chevron-down"
                                                color={theme.text}
                                            />
                                        </Pressable>
                                        <View style={styles.divider} />
                                    </View>
                                }
                            />

                            <AppButton
                                title="Send OTP"
                                onPress={handleSendOTP}
                                loading={loading}
                                disabled={!isPhoneValid || loading}
                                style={styles.primaryButton}
                            />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <AppText
                                variant="title"
                                style={[styles.cardTitle, { color: theme.text }]}>
                                Enter OTP
                            </AppText>
                            <AppText
                                variant="label1"
                                color="secondaryText"
                                style={styles.subtitle}>
                                A {OTP_LENGTH}-digit code was sent to{"\n"}
                                <AppText variant="label1" color="primaryButton">
                                    {contact}
                                </AppText>
                            </AppText>

                            <View style={styles.otpWrapper}>
                                <OtpInput
                                    value={otp}
                                    onChange={(v) => {
                                        setOtp(v);
                                        setHasError(false);
                                        setErrorMsg(null);
                                    }}
                                    hasError={hasError}
                                    autoFocus
                                />
                            </View>

                            <View style={styles.resendRow}>
                                <AppText variant="label1" color="secondaryText">
                                    Didn't receive the code?{" "}
                                </AppText>
                                <Pressable
                                    onPress={handleResend}
                                    disabled={resendTimer > 0 || loading}
                                    hitSlop={8}>
                                    <AppText
                                        variant="label1"
                                        color={
                                            resendTimer > 0
                                                ? "secondaryText"
                                                : "primaryButton"
                                        }>
                                        {resendTimer > 0
                                            ? `Resend in ${resendTimer}s`
                                            : "Resend"}
                                    </AppText>
                                </Pressable>
                            </View>

                            <AppButton
                                title="Verify OTP"
                                onPress={handleVerifyOTP}
                                loading={loading}
                                disabled={!otpFilled || loading}
                                style={styles.primaryButton}
                            />
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <AppText
                                variant="title"
                                style={[styles.cardTitle, { color: theme.text }]}>
                                New Password
                            </AppText>
                            <AppText
                                variant="label1"
                                color="secondaryText"
                                style={styles.subtitle}>
                                Create a strong password for your account.
                            </AppText>

                            <AppInput
                                label="NEW PASSWORD"
                                placeholder="Enter new password"
                                secureTextEntry={!showNew}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() =>
                                    confirmRef.current?.focus()
                                }
                                value={newPassword}
                                onChangeText={(v) => {
                                    setNewPassword(v);
                                    setErrorMsg(null);
                                }}
                                containerStyle={styles.field}
                                rightIcon={
                                    <Pressable
                                        onPress={() => setShowNew((v) => !v)}
                                        hitSlop={10}>
                                        <AppText
                                            variant="caption"
                                            color="secondaryText">
                                            {showNew ? "Hide" : "Show"}
                                        </AppText>
                                    </Pressable>
                                }
                            />

                            <AppInput
                                ref={confirmRef}
                                label="CONFIRM PASSWORD"
                                placeholder="Re-enter new password"
                                secureTextEntry={!showConfirm}
                                returnKeyType="done"
                                onSubmitEditing={handleResetPassword}
                                value={confirmPassword}
                                onChangeText={(v) => {
                                    setConfirmPassword(v);
                                    setErrorMsg(null);
                                }}
                                containerStyle={styles.field}
                                rightIcon={
                                    <Pressable
                                        onPress={() =>
                                            setShowConfirm((v) => !v)
                                        }
                                        hitSlop={10}>
                                        <AppText
                                            variant="caption"
                                            color="secondaryText">
                                            {showConfirm ? "Hide" : "Show"}
                                        </AppText>
                                    </Pressable>
                                }
                            />

                            <AppButton
                                title="Reset Password"
                                onPress={handleResetPassword}
                                loading={loading}
                                disabled={!passwordsMatch || loading}
                                style={styles.primaryButton}
                            />
                        </>
                    )}
                </View>
            </KeyboardAwareScrollView>

            <CountryPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onSelect={setSelectedCountry}
                selectedCountryCode={selectedCountry.code}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { flexGrow: 1 },
    header: { paddingBottom: 32 },
    backButton: {
        position: "absolute",
        left: 20,
        zIndex: 10,
        padding: 8,
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
           borderWidth:1,
        borderBottomWidth:0,
        borderColor:"#B4B4B4",
        paddingHorizontal: 28,
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
    errorBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 16,
    },
    cardTitle: {
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        textAlign: "center",
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    field: { marginBottom: 20 },
    countryPickerTrigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: "#D1D5DB",
        marginHorizontal: 12,
    },
    primaryButton: {
        borderRadius: 16,
        marginBottom: 12,
    },
    otpWrapper: { marginBottom: 24 },
    resendRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 32,
    },
});
