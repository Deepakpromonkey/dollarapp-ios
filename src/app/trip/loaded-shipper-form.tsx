import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import OtpInput from "@/components/signup/OtpInput";
import { useAppTheme } from "@/hooks/useAppTheme";
import { api } from "@/lib/api";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    TextInput,
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

export default function LoadedShipperFormScreen() {
    const theme = useAppTheme();
    const { uuid } = useLocalSearchParams<{ uuid: string }>();


    const [prefill, setPrefill] = useState<PreFillData | null>(null);
    const [prefillLoading, setPrefillLoading] = useState(true);

    const [sealNumber, setSealNumber] = useState("");
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [otpError, setOtpError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const otpFilled = otp.every((d) => d !== "");
    const canSubmit = otpFilled && sealNumber.trim().length > 0;


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
                const data = res.data?.data;
                if (data) {
                    setPrefill(data);
                    setSealNumber(data.seal ?? "");
                }
            } catch {
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
        if (!sealNumber.trim()) {
            Alert.alert("Missing Info", "Please enter the seal number.");
            return;
        }
        if (!uuid) {
            Alert.alert("Error", "Shipment ID missing. Please go back and try again.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/shipments/${uuid}/journey/loaded-shipper`, {
                otp: otp.join(""),
                seal_number: sealNumber.trim(),
            });

            Alert.alert("Loading Confirmed", "You're confirmed loaded at the shipper.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Failed to confirm loading. Please try again.";
            Alert.alert("Submission Failed", msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Loaded At Shipper" />

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
                            Confirm details
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
                                <InfoRow
                                    label="LICENSE PLATE"
                                    value={prefill.license_plate}
                                    theme={theme}
                                />
                            </View>
                        </>
                    )}

    
                    <View
                        style={[styles.card, { backgroundColor: theme.card }]}>
                        <AppText
                            variant="tiny"
                            style={[
                                styles.sectionLabel,
                                { color: theme.secondaryText },
                            ]}>
                            SEAL NUMBER
                        </AppText>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    color: theme.text,
                                    borderColor: theme.cardSecondary,
                                    backgroundColor: theme.cardSecondary,
                                },
                            ]}
                            placeholder="Enter seal number"
                            placeholderTextColor={theme.secondaryText}
                            value={sealNumber}
                            onChangeText={setSealNumber}
                            autoCapitalize="characters"
                        />
                    </View>

                    {/* OTP */}
                    <View
                        style={[styles.card, { backgroundColor: theme.card }]}>
                        <AppText
                            variant="body"
                            style={[styles.otpTitle, { color: theme.text }]}>
                            Shipper OTP
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            Get the 6-digit verification code from the shipper.
                        </AppText>
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
                        title="Confirm Loaded"
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={!canSubmit || submitting}
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
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        letterSpacing: 0.5,
    },
    otpTitle: {
        fontWeight: "700",
        fontSize: 16,
    },
    submitBtn: {
        borderRadius: 16,
        height: 56,
        marginTop: 4,
    },
});
