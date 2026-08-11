import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import { api } from "@/lib/api";
import { loadApi } from "@/lib/loadApi";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

const OTP_LENGTH = 6;

interface PreFillData {
    appointment_number: string;
    phone: string;
    tractor: string;
    trailer: string;
    license_plate: string;
    seal: string;
}

interface PreFillResponse {
    status: boolean;
    message: string;
    data: PreFillData;
}

export default function DeliveredReceiverFormScreen() {
    const theme = useAppTheme();
    const { uuid } = useLocalSearchParams<{ uuid: string }>();

    const [prefill, setPrefill] = useState<PreFillData | null>(null);
    const [prefillLoading, setPrefillLoading] = useState(true);

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [otpError, setOtpError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Where the code went, masked by the API. Doubles as "a code has been sent".
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [sendingOtp, setSendingOtp] = useState(false);

    /**
     * The code goes to the receiver, never to the driver — possession of it is
     * what proves someone at the delivery point signed off.
     */
    const sendOtp = async () => {
        if (!uuid) return;
        setSendingOtp(true);
        try {
            const res = await loadApi.sendStopOtp(uuid, "delivery");
            setSentTo(res.data?.data?.sent_to ?? "the receiver");
            Alert.alert(
                "Code sent",
                "The receiver contact has been texted a 6-digit code. Ask them to read it out.",
            );
        } catch (err: unknown) {
            Alert.alert(
                "Could not send code",
                err instanceof Error ? err.message : "Please try again.",
            );
        } finally {
            setSendingOtp(false);
        }
    };

    const otpFilled = otp.every((d) => d !== "");

    useEffect(() => {
        if (!uuid) {
            setPrefillLoading(false);
            return;
        }
        (async () => {
            try {
                const res = await api.get<PreFillResponse>(
                    `/shipments/${uuid}/pre-fill`,
                );
                if (res.data?.data) setPrefill(res.data.data);
            } catch {
                // Non-fatal
            } finally {
                setPrefillLoading(false);
            }
        })();
    }, [uuid]);

    const handleSubmit = async () => {
        if (!otpFilled) {
            setOtpError(true);
            setTimeout(() => setOtpError(false), 700);
            return;
        }
        if (!uuid) {
            Alert.alert("Error", "Shipment ID missing. Please go back and try again.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/shipments/${uuid}/journey/delivered-receiver`, {
                otp: otp.join(""),
            });

            Alert.alert(
                "Delivery Confirmed",
                "You have successfully confirmed delivery at the receiver.",
                [{ text: "OK", onPress: () => router.back() }],
            );
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Failed to confirm delivery. Please try again.";
            Alert.alert("Submission Failed", msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Delivered at Receiver" />

            {prefillLoading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={theme.primaryButton} />
                </View>
            ) : (
                <KeyboardAwareScrollView
                    enableOnAndroid
                    extraScrollHeight={24}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}>

                    {/* Header row */}
                    <View style={styles.confirmRow}>
                        <AppText
                            variant="body"
                            style={[styles.confirmTitle, { color: theme.text }]}>
                            Confirm delivery
                        </AppText>
                        {prefill && (
                            <View
                                style={[
                                    styles.prefilledBadge,
                                    { backgroundColor: "#E8EDFF" },
                                ]}>
                                <MaterialIcons
                                    name="bolt"
                                    size={14}
                                    color="#4B6BFF"
                                />
                                <AppText
                                    variant="tiny"
                                    style={{
                                        color: "#4B6BFF",
                                        fontWeight: "600",
                                    }}>
                                    PRE-FILLED
                                </AppText>
                            </View>
                        )}
                    </View>

                    {prefill && (
                        <>
                            <View
                                style={[
                                    styles.card,
                                    { backgroundColor: theme.card },
                                ]}>
                                <InfoRow
                                    label="APPOINTMENT #"
                                    value={prefill.appointment_number}
                                    theme={theme}
                                />
                                <InfoRow
                                    label="PHONE"
                                    value={prefill.phone}
                                    theme={theme}
                                />
                            </View>

                            <View
                                style={[
                                    styles.card,
                                    { backgroundColor: theme.card },
                                ]}>
                                <AppText
                                    variant="tiny"
                                    style={[
                                        styles.sectionLabel,
                                        { color: theme.secondaryText },
                                    ]}>
                                    VEHICLE DETAILS
                                </AppText>
                                <View style={styles.twoCol}>
                                    <InfoRow
                                        label="TRACTOR"
                                        value={prefill.tractor}
                                        theme={theme}
                                        flex
                                    />
                                    <InfoRow
                                        label="TRAILER"
                                        value={prefill.trailer}
                                        theme={theme}
                                        flex
                                    />
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.card,
                                    { backgroundColor: theme.card },
                                ]}>
                                <AppText
                                    variant="tiny"
                                    style={[
                                        styles.sectionLabel,
                                        { color: theme.secondaryText },
                                    ]}>
                                    COMPLIANCE
                                </AppText>
                                <View style={styles.twoCol}>
                                    <InfoRow
                                        label="LICENSE PLATE"
                                        value={prefill.license_plate}
                                        theme={theme}
                                        flex
                                    />
                                    <InfoRow
                                        label="SEAL"
                                        value={prefill.seal}
                                        theme={theme}
                                        flex
                                    />
                                </View>
                            </View>
                        </>
                    )}

                    {/* OTP */}
                    <View
                        style={[styles.card, { backgroundColor: theme.card }]}>
                        <AppText
                            variant="body"
                            style={[styles.otpTitle, { color: theme.text }]}>
                            Receiver OTP
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            {sentTo
                                ? `Code sent to the receiver contact (${sentTo}). Ask them to read it out.`
                                : "Send a code to the receiver contact, then ask them to read it out to you."}
                        </AppText>

                        <AppButton
                            title={
                                sendingOtp
                                    ? "Sending..."
                                    : sentTo
                                      ? "Resend code"
                                      : "Send code to receiver"
                            }
                            variant="secondary"
                            onPress={sendOtp}
                            loading={sendingOtp}
                            style={styles.sendOtpBtn}
                        />

                        <OtpInput
                            value={otp}
                            onChange={(v) => {
                                setOtp(v);
                                setOtpError(false);
                            }}
                            hasError={otpError}
                            autoFocus={false}
                        />
                    </View>

                    <AppButton
                        title="Confirm Delivery"
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={!otpFilled || submitting}
                        style={styles.submitBtn}
                    />
                </KeyboardAwareScrollView>
            )}
        </SafeAreaView>
    );
}


interface InfoRowProps {
    label: string;
    value: string;
    theme: ReturnType<typeof import("@/hooks/useAppTheme").useAppTheme>;
    flex?: boolean;
}

function InfoRow({ label, value, theme, flex }: InfoRowProps) {
    return (
        <View style={flex ? { flex: 1 } : undefined}>
            <AppText
                variant="tiny"
                style={{
                    color: theme.secondaryText,
                    letterSpacing: 0.6,
                    marginBottom: 4,
                }}>
                {label}
            </AppText>
            <AppText variant="label1" style={{ color: theme.text }}>
                {value || "—"}
            </AppText>
        </View>
    );
}


const styles = StyleSheet.create({
    screen: { flex: 1 },
    loadingWrap: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        padding: 16,
        gap: 12,
        paddingBottom: 48,
    },
    confirmRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginBottom: 4,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
    prefilledBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    sectionLabel: {
        letterSpacing: 0.8,
        fontWeight: "600",
    },
    twoCol: {
        flexDirection: "row",
        gap: 16,
    },
    otpTitle: {
        fontWeight: "700",
        fontSize: 16,
    },
    sendOtpBtn: {
        marginTop: 12,
        marginBottom: 4,
    },
    submitBtn: {
        borderRadius: 16,
        height: 56,
        marginTop: 4,
    },
});
