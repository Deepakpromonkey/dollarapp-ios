import { OneSignal } from 'react-native-onesignal';
import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import CountryPicker, { COUNTRIES, Country } from "@/components/CountryPicker";
import OtpInput from "@/components/signup/OtpInput";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 30;

function stripDigits(val: string): string {
    return val.replace(/\D/g, "");
}

export default function LoginOTPScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { loginOtp, isSubmitting } = useAuth();

    const [step, setStep] = useState<1 | 2>(1);
    const [selectedCountry, setSelectedCountry] = useState<Country>(
        COUNTRIES[0],
    );
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(0);
    const [pickerVisible, setPickerVisible] = useState(false);

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
            await authApi.sendLoginOtp(contact);
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
            await authApi.sendLoginOtp(contact);
            setResendTimer(RESEND_TIMEOUT);
        } catch (err: any) {
            setErrorMsg(err?.message ?? "Failed to resend OTP.");
        } finally {
            setLoading(false);
        }
    };

   const handleVerify = async () => {
        const code = otp.join("");
        if (code.length < OTP_LENGTH) {
            setHasError(true);
            setTimeout(() => setHasError(false), 600);
            return;
        }
        setErrorMsg(null);
        try {
            // 👇 Grab the OneSignal Token safely
            let pushSubscriptionId = null;
            try {
                pushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
            } catch (oneSignalErr) {
                console.warn("Could not get OneSignal Token:", oneSignalErr);
            }

            // 👇 Pass the token into your login function!
            await loginOtp(contact, code, pushSubscriptionId); 
            
        } catch (err: any) {
            setHasError(true);
            setErrorMsg(err?.message ?? "Invalid OTP. Please try again.");
            setTimeout(() => setHasError(false), 600);
        }
    };

    const otpFilled = otp.every((d) => d !== "");
    const isBusy = loading || isSubmitting;

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
                <View style={styles.blueHeader}>
                
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
                    {/* Error banner */}
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

                    {step === 1 ? (
                        <>
                            <AppText
                                variant="title"
                                style={[
                                    styles.cardTitle,
                                    { color: theme.text },
                                ]}>
                                Login with OTP
                            </AppText>
                            <AppText
                                variant="label1"
                                color="secondaryText"
                                style={styles.subtitle}>
                                We'll send a one-time password to your mobile
                                number.
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
                                                style={[{ color: theme.text }]}>
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
                                loading={isBusy}
                                disabled={!isPhoneValid || isBusy}
                                style={styles.primaryButton}
                            />

                            <View style={styles.switchRow}>
                                <AppText variant="label1" color="secondaryText">
                                    Login with password instead?{" "}
                                </AppText>
                                <Pressable
                                    onPress={() =>
                                        router.push("/(auth)/login" as any)
                                    }
                                    hitSlop={8}>
                                    <AppText
                                        variant="label1"
                                        color="primaryButton">
                                        Sign In
                                    </AppText>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
            

                            <AppText
                                variant="title"
                                style={[
                                    styles.cardTitle,
                                    { color: theme.text },
                                ]}>
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
                                    disabled={resendTimer > 0 || isBusy}
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
                                title="Verify & Login"
                                onPress={handleVerify}
                                loading={isBusy}
                                disabled={!otpFilled || isBusy}
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
    blueHeader: {
        paddingBottom: 32,
    },
    backButton: {
        position: "absolute",
        left: 20,
        zIndex: 10,
        padding: 8,
    },
    changeNumber: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginBottom: 16,
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
        paddingTop: 40,
        marginTop: -32,
    },
    errorBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 16,
    },
    cardTitle: {
        textAlign: "center",
        marginBottom: 12,
    },
    subtitle: {
        textAlign: "center",
        marginBottom: 32,
    },
    field: { marginBottom: 32 },
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
    otpWrapper: { marginBottom: 32 },
    resendRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 32,
    },
    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
    },
});
