import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import CountryPicker, { COUNTRIES, Country } from "@/components/CountryPicker";
import { Fonts } from "@/constants/fonts";
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

function stripDigits(val: string): string {
    return val.replace(/\D/g, "");
}

interface Step1PhoneProps {
    onNext: (phone: string, dialCode: string) => void;
}

export default function Step1Phone({ onNext }: Step1PhoneProps) {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [selectedCountry, setSelectedCountry] = useState<Country>(
        COUNTRIES[0],
    );
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    const phoneRef = useRef<TextInput>(null);

    useEffect(() => {
        setPhone("");
        setTimeout(() => phoneRef.current?.focus(), 100);
    }, [selectedCountry]);

    const digits = stripDigits(phone);
    const maxLen = Math.max(...selectedCountry.digitLengths);
    const minLen = Math.min(...selectedCountry.digitLengths);

    const isPhoneValid = digits.length >= minLen && digits.length <= maxLen;
    const isValid = isPhoneValid;

    const handleSend = async () => {
        if (!isValid) return;
        setError(null);
        setLoading(true);
        try {
            const contact = `${selectedCountry.dialCode}${digits}`;
            await authApi.sendSignupPhoneOtp(contact);
            onNext(digits, selectedCountry.dialCode);
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to send OTP. Please try again.";
            setError(message);
        } finally {
            setLoading(false);
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
                            Step 1
                        </AppText>
                    </View>

                    <AppText
                        variant="title"
                        style={[styles.cardTitle, { color: theme.text }]}>
                        Enter Your Details
                    </AppText>
                    <AppText
                        variant="label1"
                        color="secondaryText"
                        style={styles.subtitle}>
                        Welcome to the dollar traq, We will send you six digit
                        code to verify it's you
                    </AppText>

                    {error ? (
                        <AppText
                            variant="caption"
                            color="err"
                            style={styles.errorText}>
                            {error}
                        </AppText>
                    ) : null}

                    <AppInput
                        ref={phoneRef}
                        label="PHONE NUMBER"
                        placeholder="Enter phone number"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        returnKeyType="done"
                        maxLength={maxLen}
                        onSubmitEditing={handleSend}
                        value={phone}
                        onChangeText={(t) => {
                            const raw = stripDigits(t);
                            if (raw.length <= maxLen) setPhone(raw);
                        }}
                        containerStyle={styles.field}
                        leftIcon={
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}>
                                <Pressable
                                    onPress={() => setPickerVisible(true)}
                                    style={styles.countryPickerTrigger}
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
                        title="Continue"
                        onPress={handleSend}
                        loading={loading}
                        disabled={!isValid}
                        style={styles.primaryButton}
                    />

                    <View style={styles.switchRow}>
                        <AppText variant="label1" color="secondaryText">
                            Don't have an account?{" "}
                        </AppText>
                        <Pressable
                            onPress={() => router.push("/(auth)/login" as any)}
                            hitSlop={8}>
                            <AppText
                                variant="label1"
                                color="primaryButton"
                               >
                                Login now
                            </AppText>
                        </Pressable>
                    </View>
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
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    errorText: {
        textAlign: "center",
        marginBottom: 12,
        color: "#ec3131ff",
    },
    field: {
        marginBottom: 24,
    },
    inputLabel: {
        fontFamily: Fonts.medium,
        fontSize: 13,
        marginLeft: 2,
        marginBottom: 8,
    },
    phoneInputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 32,
    },
    countryPickerTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
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
        marginBottom: 24,
    },
    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
   
});
