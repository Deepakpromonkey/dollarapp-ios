import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Dimensions,
    Image,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

interface ProfileData {
    name: string;
    carrier: string;
    email: string;
    password: string;
}

interface Step3ProfileProps {
    registrationToken: string;
    onNext: (data: ProfileData) => void;
}

export default function Step3Profile({ registrationToken, onNext }: Step3ProfileProps) {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [name, setName] = useState("");
    const [carrier, setCarrier] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Partial<ProfileData>>({});

    const carrierRef = useRef<TextInput>(null);
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);

    const validate = (): boolean => {
        const errs: Partial<ProfileData> = {};
        if (!name.trim()) errs.name = "Name is required";
        if (!carrier.trim()) errs.carrier = "Carrier is required";
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim()) {
            errs.email = "Email is required";
        } else if (!emailRe.test(email.trim())) {
            errs.email = "Enter a valid email address";
        }
        if (!password.trim()) {
            errs.password = "Password is required";
        } else if (password.length < 8) {
            errs.password = "Password must be at least 8 characters";
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleContinue = async () => {
        if (!validate()) return;
        setApiError(null);
        setLoading(true);
        try {
            const { data: otpData } = await authApi.sendSignupEmailOtp(registrationToken, email.trim());
            if (otpData.dev_note) {
                console.log("[DEV] Email OTP:", otpData.dev_note);
            }
            onNext({
                name: name.trim(),
                carrier: carrier.trim(),
                email: email.trim(),
                password: password.trim(),
            });
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to send email OTP. Please try again.";
            setApiError(message);
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
                            Step 3
                        </AppText>
                    </View>

                    <AppText
                        variant="title"
                        style={[styles.cardTitle, { color: theme.text }]}>
                        Create Your Profile
                    </AppText>
                    <AppText
                        variant="label1"
                        style={[
                            styles.subtitle,
                            { color: theme.secondaryText },
                        ]}>
                        Welcome to the dollar traq, We will send you six digit
                        code to verify it's you
                    </AppText>

                    {apiError ? (
                        <AppText
                            variant="caption"
                            color="err"
                            style={styles.errorText}>
                            {apiError}
                        </AppText>
                    ) : null}

                    <AppInput
                        label="NAME"
                        placeholder="Enter your name"
                        autoCapitalize="words"
                        autoComplete="name"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => carrierRef.current?.focus()}
                        value={name}
                        onChangeText={(t) => {
                            setName(t);
                            if (errors.name)
                                setErrors((e) => ({ ...e, name: undefined }));
                        }}
                        error={errors.name}
                        containerStyle={styles.field}
                    />

                    <AppInput
                        ref={carrierRef}
                        label="CARRIER"
                        placeholder="Enter your carrier"
                        autoCapitalize="words"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => emailRef.current?.focus()}
                        value={carrier}
                        onChangeText={(t) => {
                            setCarrier(t);
                            if (errors.carrier)
                                setErrors((e) => ({
                                    ...e,
                                    carrier: undefined,
                                }));
                        }}
                        error={errors.carrier}
                        containerStyle={styles.field}
                    />

                    <AppInput
                        ref={emailRef}
                        label="EMAIL"
                        placeholder="Please enter your email address"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            if (errors.email)
                                setErrors((e) => ({ ...e, email: undefined }));
                        }}
                        error={errors.email}
                        containerStyle={styles.field}
                    />

                    <AppInput
                        ref={passwordRef}
                        label="PASSWORD"
                        placeholder="Enter your password"
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="new-password"
                        returnKeyType="done"
                        onSubmitEditing={handleContinue}
                        value={password}
                        onChangeText={(t) => {
                            setPassword(t);
                            if (errors.password)
                                setErrors((e) => ({ ...e, password: undefined }));
                        }}
                        error={errors.password}
                        containerStyle={styles.field}
                    />

                    <AppButton
                        title="Continue"
                        onPress={handleContinue}
                        loading={loading}
                        disabled={!name.trim() || !carrier.trim() || !email.trim() || !password.trim()}
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
    errorText: {
        textAlign: "center",
        marginBottom: 16,
        color: "#ec3131ff",
    },
    field: {
        marginBottom: 24,
    },
    primaryButton: {
        borderRadius: 16,

        marginBottom: 24,
        marginTop: 8,
    },
    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
});
