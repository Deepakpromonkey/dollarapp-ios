import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useRef, useState } from "react";
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

// 🚨 NEW: Import OneSignal
import { OneSignal } from 'react-native-onesignal';

const { height } = Dimensions.get("window");

export default function LoginScreen() {
    const theme = useAppTheme();
    const { login, isSubmitting, error, clearError } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) return;
        clearError();
        try {
            // 🚨 SAFETY NET: Wrap OneSignal in a try/catch so it never breaks login
            let pushSubscriptionId = null;
            try {
                pushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
            } catch (oneSignalErr) {
                console.warn("Could not get OneSignal Token:", oneSignalErr);
            }

            await login({ 
                email: email.trim().toLowerCase(), 
                password,
                device_token: pushSubscriptionId 
            });
            
        } catch (err) {
            console.error("Login error:", err);
        }
    };

    const handleOTPLogin = () => {
        router.push("/(auth)/login-otp" as any);
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
                <View style={styles.blueHeader}>
                    <View
                        style={[
                            styles.imageContainer,
                            { paddingTop: insets.top },
                        ]}>
                        <Image
                            source={require("@/assets/images/login.png")}
                            style={{ width: "100%", backgroundColor: theme.card }}
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
                    <AppText
                        variant="title"
                        style={[styles.cardTitle, { color: theme.text }]}>
                        Welcome to DollarTraq{"\n"}login now!
                    </AppText>

                    {error ? (
                        <View
                            style={[
                                styles.errorBox,
                                {
                                    backgroundColor: theme.err + "20",
                                    borderColor: theme.err,
                                },
                            ]}>
                            <AppText variant="caption" color="err">
                                {error}
                            </AppText>
                        </View>
                    ) : null}

                    <AppInput
                        label="EMAIL ADDRESS"
                        placeholder="Enter your email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        value={email}
                        onChangeText={(v) => {
                            setEmail(v);
                            clearError();
                        }}
                        containerStyle={styles.field}
                    />

                    <AppInput
                        ref={passwordRef}
                        label="SECURITY PASSWORD"
                        placeholder="Enter your password"
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                        value={password}
                        onChangeText={(v) => {
                            setPassword(v);
                            clearError();
                        }}
                        containerStyle={styles.field}
                        rightIcon={
                            <Pressable
                                onPress={() => setShowPassword((v) => !v)}
                                hitSlop={10}>
                                <AppText
                                    variant="caption"
                                    color="secondaryText">
                                    {showPassword ? "Hide" : "Show"}
                                </AppText>
                            </Pressable>
                        }
                    />

                    <View style={styles.optionsRow}>
                        <Pressable
                            style={styles.checkboxContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                            hitSlop={8}>
                            <View style={[styles.checkbox]}>
                                {rememberMe ? (
                                    <MaterialCommunityIcons
                                        name="check"
                                        color={theme.secondaryText}
                                    />
                                ) : null}
                            </View>
                            <AppText variant="label1" color="text">
                                Remember me
                            </AppText>
                        </Pressable>

                        <Pressable
                            hitSlop={8}
                            onPress={() =>
                                router.push(
                                    "/(auth)/forgot-password" as any,
                                )
                            }>
                            <AppText variant="label1" color="primaryButton">
                                Forgot password?
                            </AppText>
                        </Pressable>
                    </View>

                    <AppButton
                        title="Login to Account"
                        onPress={handleLogin}
                        loading={isSubmitting}
                        style={styles.primaryButton}
                    />

                    <Pressable
                        onPress={handleOTPLogin}
                        disabled={isSubmitting}
                        style={styles.otpButton}>
                        <AppText variant="label1" color="secondaryText">Login with OTP</AppText>
                    </Pressable>

                    <View style={styles.signupRow}>
                        <AppText variant="label1" color="secondaryText">
                            Don't have an account?{" "}
                        </AppText>
                        <Link href={"/(auth)/signup" as any} asChild>
                            <Pressable hitSlop={8}>
                                <AppText variant="label1" color="primaryButton">
                                    Sign Up
                                </AppText>
                            </Pressable>
                        </Link>
                    </View>
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
    blueHeader: {
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
        
        paddingTop: 40,
        marginTop: -32,
    },
    cardTitle: {
        textAlign: "center",
        marginBottom: 32,
    },
    errorBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 16,
    },
    field: {
        marginBottom: 20,
    },
    optionsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 32,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
    },

    primaryButton: {
        borderRadius: 16,

        marginBottom: 12,
    },
    otpButton: {
        justifyContent: "center",
        alignItems: "center",
    },

    signupRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
    },
});