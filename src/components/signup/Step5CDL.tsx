import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import LiveCamera, { CaptureResult } from "@/components/LiveCamera";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Dimensions,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

interface CDLImages {
    front?: CaptureResult;
    back?: CaptureResult;
}

interface Step5CDLProps {
    onNext: (images: CDLImages) => void;
}

type CameraTarget = "front" | "back" | null;

export default function Step5CDL({ onNext }: Step5CDLProps) {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [images, setImages] = useState<CDLImages>({});
    const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);

    const handleCapture = (result: CaptureResult) => {
        if (!cameraTarget) return;
        setImages((prev) => ({ ...prev, [cameraTarget]: result }));
        setCameraTarget(null);
    };

    const handleDelete = (target: "front" | "back") => {
        setImages((prev) => {
            const updated = { ...prev };
            delete updated[target];
            return updated;
        });
    };

    const bothCaptured = !!images.front && !!images.back;

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
                            Step 5
                        </AppText>
                    </View>

                    <AppText
                        variant="title"
                        style={[styles.cardTitle, { color: theme.text }]}>
                        Upload your CDL
                    </AppText>
                    <AppText
                        variant="label1"
                        style={[
                            styles.subtitle,
                            { color: theme.secondaryText },
                        ]}>
                        Live - capture the front and back of your Commercial
                        driver's license
                    </AppText>

                    <CDLCaptureRow
                        label="UPLOAD YOUR CDL FRONT"
                        placeholder="Capture the front of CDL"
                        captured={images.front}
                        onPress={() => setCameraTarget("front")}
                        onDelete={() => handleDelete("front")}
                    />

                    <CDLCaptureRow
                        label="UPLOAD YOUR CDL BACK"
                        placeholder="Capture the back of CDL"
                        captured={images.back}
                        onPress={() => setCameraTarget("back")}
                        onDelete={() => handleDelete("back")}
                    />

                    <AppButton
                        title="Continue"
                        onPress={() => onNext(images)}
                        disabled={!bothCaptured}
                        style={styles.primaryButton}
                    />

                </View>
            </KeyboardAwareScrollView>

            <Modal
                visible={cameraTarget !== null}
                animationType="slide"
                onRequestClose={() => setCameraTarget(null)}>
                <LiveCamera
                    accessLevel="limited"
                    showFlip={false}
                    onCapture={handleCapture}
                    onClose={() => setCameraTarget(null)}
                />
            </Modal>
        </View>
    );
}

interface CDLCaptureRowProps {
    label: string;
    placeholder: string;
    captured?: CaptureResult;
    onPress: () => void;
    onDelete: () => void;
}

function CDLCaptureRow({
    label,
    placeholder,
    captured,
    onPress,
    onDelete,
}: CDLCaptureRowProps) {
    const theme = useAppTheme();

    return (
        <View style={styles.fieldWrapper}>
            <AppText variant="caption" style={[{ color: theme.text }]}>
                {label}
            </AppText>

            <View
                style={[
                    styles.captureRow,
                    {
                        backgroundColor: theme.cardSecondary,
                        borderColor: captured
                            ? theme.primaryButton
                            : "transparent",
                        borderWidth: captured ? 1.5 : 0,
                    },
                ]}>
                <Pressable
                    onPress={onPress}
                    style={styles.capturePressable}
                    hitSlop={8}>
                    {!captured && (
                        <Feather
                            name="camera"
                            size={18}
                            color={theme.secondaryText}
                            style={styles.cameraIcon}
                        />
                    )}
                    <AppText
                        variant="caption"
                        style={[
                            {
                                color: captured
                                    ? theme.primaryButton
                                    : theme.secondaryText,
                            },
                        ]}>
                        {captured ? "Captured Tap to retake" : placeholder}
                    </AppText>
                </Pressable>

                {captured ? (
                    <Pressable
                        onPress={onDelete}
                        hitSlop={12}
                        style={styles.iconContainer}>
                        <Feather name="x" size={16} color={theme.text as any} />
                    </Pressable>
                ) : (
                    <View style={styles.iconContainer} pointerEvents="none">
                        <Feather
                            name="chevron-right"
                            size={16}
                            color={theme.secondaryText}
                        />
                    </View>
                )}
            </View>
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
    fieldWrapper: {
        marginBottom: 24,
    },

    captureRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    capturePressable: {
        flex: 1,
        height: "100%",
        flexDirection: "row",
        alignItems: "center",
    },
    cameraIcon: {
        marginRight: 10,
    },

    iconContainer: {
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
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
