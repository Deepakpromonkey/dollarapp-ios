import { CaptureResult } from "@/components/LiveCamera";
import Step1Phone from "@/components/signup/Step1Phone";
import Step2PhoneOTP from "@/components/signup/Step2PhoneOTP";
import Step3Profile from "@/components/signup/Step3Profile";
import Step4EmailOTP from "@/components/signup/Step4EmailOTP";
import Step5CDL from "@/components/signup/Step5CDL";
import Step6Liveness from "@/components/signup/Step6Liveness";
import { toStoredDriver, useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { authApi } from "@/lib/api";
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
 
    const handleComplete = async (diditSessionId: string) => {
        try {
            const formData = new FormData();
            formData.append("registration_token", data.registrationToken ?? "");
            formData.append("name", data.fullName ?? "");
            formData.append("carrier_name", data.carrier ?? "");
            formData.append("email", data.email ?? "");
            formData.append("password", data.password ?? "");
            formData.append("didit_session_id", diditSessionId);

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
                carrier_name: data.carrier,
                email: data.email,
                didit_session_id: diditSessionId,
                cdl_front: data.cdlFront?.uri ? "present" : "missing",
                cdl_back: data.cdlBack?.uri ? "present" : "missing",
            });

            const { data: tokens } = await authApi.completeRegistration(formData);
            await saveSession(tokens.token, toStoredDriver(tokens.driver));
            await hydrateFromSession();

            /*
             * The account is real either way — an undecided Didit session is not a
             * failed one — but the driver should hear that their check is still
             * open rather than discover it later from a blocked action.
             */
            if (tokens.liveness_status === "in_review") {
                Alert.alert(
                    "Identity check under review",
                    tokens.message ??
                        "Your account is ready, but your identity check needs a manual look. We will notify you as soon as it clears.",
                );
            }
        } catch (err: unknown) {
            console.error("[Signup] Registration failed:", err);
            const message =
                err instanceof Error
                    ? err.message
                    : "Registration failed. Please try again.";
            Alert.alert("Registration Error", message);
        }
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