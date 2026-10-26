import { CaptureResult } from "@/components/LiveCamera";
import { LogLevel, OneSignal } from 'react-native-onesignal';
import Step1Phone from "@/components/signup/Step1Phone";
import Step2PhoneOTP from "@/components/signup/Step2PhoneOTP";
import Step3Profile from "@/components/signup/Step3Profile";
import Step4EmailOTP from "@/components/signup/Step4EmailOTP";
import Step5CDL from "@/components/signup/Step5CDL";
import Step6Liveness, { type FinishResult } from "@/components/signup/Step6Liveness";
import { toStoredDriver, useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ApiError, authApi, type AuthTokens } from "@/lib/api";
import { friendlyError } from "@/lib/loadApi";
import { saveSession } from "@/lib/secureStore";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

async function compressImage(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
}

/*
 * What the driver can do about a failed /register/complete, read from the
 * server's answer. Sending the same request again only helps when the failure
 * was passing (no signal, a server error); the others need another way on.
 */
function registrationFailure(err: unknown): FinishResult {
    if (err instanceof ApiError) {
        const body = err.body as
            | { liveness_status?: string; errors?: Record<string, unknown> }
            | undefined;

        // Didit declined this session, so the same id would be refused every time.
        if (err.status === 422 && body?.liveness_status === "declined") {
            return {
                ok: false,
                next: "recheck",
                message: "Your face check was not approved. Try it again, or skip it for now.",
            };
        }

        // Most likely an earlier try created the account and its answer was lost.
        if (err.status === 422 && body?.errors?.email) {
            return {
                ok: false,
                next: "login",
                message: "An account with this email already exists. Log in with your email and password.",
            };
        }

        // The codes verified in the earlier steps have run out.
        if (err.status === 403) {
            return {
                ok: false,
                next: "login",
                message: "Your sign-up timed out before it finished. Go back and tap Sign Up to start again.",
            };
        }
    }

    return {
        ok: false,
        next: "retry",
        message: friendlyError(err, "Registration failed. Please try again."),
    };
}

const TOTAL_STEPS = 5;
 
interface SignupData {
    phone: string;
    dialCode: string;
    registrationToken: string;
    fullName: string;
    carrier: string;
    email: string;
    password: string;
    diditSessionId: string;
    cdlFront?: CaptureResult;
    cdlBack?: CaptureResult;
}
 
type InternalStep = 1 | 2 | 3 | 4 | 5 | 6;
 
const stepToBar: Record<InternalStep, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
};
 
export default function SignupScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { hydrateFromSession } = useAuth();
 
    const [internalStep, setInternalStep] = useState<InternalStep>(1);
    const [data, setData] = useState<Partial<SignupData>>({});
 
    const goBack = () => {
        if (internalStep === 1) {
            router.back();
        } else if (internalStep === 2) {
            setInternalStep(1);
        } else if (internalStep === 3) {
            setInternalStep(1);
        } else if (internalStep === 4) {
            setInternalStep(3);
        } else if (internalStep === 5) {
            setInternalStep(3);
        } else if (internalStep === 6) {
            setInternalStep(5);
        }
    };
 
    const handleComplete = async (diditSessionId: string): Promise<FinishResult> => {
        let tokens: AuthTokens;
        try {
            /*
            | The OneSignal subscription, for pushes. Optional: without it the
            | account is still created, so a OneSignal failure must never stop
            | the driver registering.
            */
            let pushSubscriptionId: string | null = null;
            try {
                pushSubscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
            } catch (oneSignalErr) {
                console.warn("Could not get OneSignal Token:", oneSignalErr);
            }

            const formData = new FormData();
            formData.append("registration_token", data.registrationToken ?? "");
            formData.append("name", data.fullName ?? "");
            formData.append("carrier_name", data.carrier ?? "");
            formData.append("email", data.email ?? "");
            formData.append("password", data.password ?? "");
            formData.append("didit_session_id", diditSessionId);

            // 🚨 NEW: Append the device token to the API payload!
            if (pushSubscriptionId) {
                formData.append("device_token", pushSubscriptionId);
            }

            if (data.cdlFront?.uri) {
                const uri = await compressImage(data.cdlFront.uri);
                const filename = uri.split("/").pop() ?? "cdl_front.jpg";
                formData.append("cdl_front", { uri, name: filename, type: "image/jpeg" } as any);
            }

            if (data.cdlBack?.uri) {
                const uri = await compressImage(data.cdlBack.uri);
                const filename = uri.split("/").pop() ?? "cdl_back.jpg";
                formData.append("cdl_back", { uri, name: filename, type: "image/jpeg" } as any);
            }

            console.log("[Signup] Sending registration:", {
                registration_token: data.registrationToken,
                name: data.fullName,
                email: data.email,
                didit_session_id: diditSessionId,
                device_token: pushSubscriptionId ?? "missing", // Log the token to terminal!
                cdl_front: data.cdlFront?.uri ? "present" : "missing",
                cdl_back: data.cdlBack?.uri ? "present" : "missing",
            });

            tokens = (await authApi.completeRegistration(formData)).data;
        } catch (err: unknown) {
            // Step 6 shows this with the way on that fits it; an alert left that screen stuck.
            console.error("[Signup] Registration failed:", err);
            return registrationFailure(err);
        }

        // The account exists from here on; a throw would hide that behind "Registration Error".
        try {
            OneSignal.login(tokens.driver.id.toString());
        } catch (oneSignalErr) {
            console.warn("[Signup] OneSignal login failed:", oneSignalErr);
        }

        // Not a failed registration either: the account is made, so the way on is login, never signing up again.
        try {
            await saveSession(tokens.token, toStoredDriver(tokens.driver));
            await hydrateFromSession();
        } catch (err: unknown) {
            console.error("[Signup] Signing in after registration failed:", err);
            return {
                ok: false,
                next: "login",
                message: "Your account is ready. Log in with your email and password.",
            };
        }

        if (tokens.liveness_status === "in_review") {
            Alert.alert(
                "Identity check under review",
                tokens.message ??
                    "Your account is ready, but your identity check needs a manual look. We will notify you as soon as it clears.",
            );
        } else if (tokens.liveness_status === "skipped") {
            Alert.alert(
                "Identity check skipped",
                tokens.message ??
                    "Your account is ready. You can complete identity verification anytime from your profile.",
            );
        }
        return { ok: true };
    };
 
    return (
        <View style={[styles.screen, { backgroundColor: theme.background }]}>
          
 
            {internalStep === 1 && (
                <Step1Phone
                    onNext={(phone, dialCode) => {
                        setData((d) => ({ ...d, phone, dialCode }));
                        setInternalStep(2);
                    }}
                />
            )}
 
            {internalStep === 2 && (
                <Step2PhoneOTP
                    phone={data.phone ?? ""}
                    dialCode={data.dialCode ?? "+1"}
                    onVerified={(registrationToken) => {
                        setData((d) => ({ ...d, registrationToken }));
                        setInternalStep(3);
                    }}
                    onResend={() => {
                        //  Step2PhoneOTP
                    }}
                />
            )}
 
            {internalStep === 3 && (
                <Step3Profile
                    registrationToken={data.registrationToken ?? ""}
                    onNext={(profileData) => {
                        setData((d) => ({
                            ...d,
                            fullName: profileData.name,
                            carrier: profileData.carrier,
                            email: profileData.email,
                            password: profileData.password,
                        }));
                        setInternalStep(4);
                    }}
                />
            )}
 
            {internalStep === 4 && (
                <Step4EmailOTP
                    registrationToken={data.registrationToken ?? ""}
                    email={data.email ?? ""}
                    onVerified={() => setInternalStep(5)}
                    onResend={() => {
                        //  Step4EmailOTP
                    }}
                />
            )}
 
            {internalStep === 5 && (
                <Step5CDL
                    onNext={(images) => {
                        setData((d) => ({
                            ...d,
                            cdlFront: images.front,
                            cdlBack: images.back,
                        }));
                        setInternalStep(6);
                    }}
                />
            )}
 
            {internalStep === 6 && (
                <Step6Liveness
                    registrationToken={data.registrationToken ?? ""}
                    onComplete={handleComplete}
                />
            )}
        </View>
    );
}
 
const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
});