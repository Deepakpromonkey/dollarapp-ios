import AppButton from "@/components/AppButton";
import AppInput from "@/components/AppInput";
import AppText from "@/components/AppText";
import LiveCamera, { CaptureResult } from "@/components/LiveCamera";
import NavHeader from "@/components/NavHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { api } from "@/lib/api";
import { MaterialIcons } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

type DeliveryCondition = "Clean" | "Claused";

export default function CompleteDeliveryFormScreen() {
    const theme = useAppTheme();
    const { uuid } = useLocalSearchParams<{ uuid: string }>();

    const [condition, setCondition] = useState<DeliveryCondition>("Clean");
    const [cameraVisible, setCameraVisible] = useState(false);
    const [podPhoto, setPodPhoto] = useState<CaptureResult | null>(null);
    const [receiverName, setReceiverName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const podCaptured = podPhoto !== null;
    const canSubmit = podCaptured && receiverName.trim().length > 0;

    const handleCapture = async (result: CaptureResult) => {
        setCameraVisible(false);

        // Compress to max 1280px wide, 70% quality before storing
        let finalUri = result.uri;
        try {
            const compressed = await manipulateAsync(
                result.uri,
                [{ resize: { width: 1280 } }],
                { compress: 0.7, format: SaveFormat.JPEG },
            );
            finalUri = compressed.uri;
        } catch (e) {
            console.warn("[compress] failed, using original:", e);
        }

        setPodPhoto({ ...result, uri: finalUri });
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        if (!uuid) {
            Alert.alert("Error", "Shipment ID missing. Please go back and try again.");
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("delivery_condition", condition);
            formData.append("receiver_printed_name", receiverName.trim());

            const podFilename = podPhoto!.uri.split("/").pop() ?? "pod.jpg";
            formData.append("pod_image", {
                uri: podPhoto!.uri,
                name: podFilename,
                type: "image/jpeg",
            } as any);

            await api.upload(`/shipments/${uuid}/journey/complete-destination`, formData);

            Alert.alert(
                "Delivery Complete",
                "Load has been delivered successfully.",
                [{ text: "OK", onPress: () => router.back() }],
            );
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : "Failed to complete delivery. Please try again.";
            Alert.alert("Submission Failed", msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Complete Delivery" />

            <KeyboardAwareScrollView
                enableOnAndroid
                extraScrollHeight={24}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}>

                {/* Bill of Lading summary card */}
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <View style={styles.bolHeaderRow}>
                        <View>
                            <AppText variant="tiny" color="text">
                                BILL OF LADING
                            </AppText>
                            <AppText variant="label" color="text">
                                BOLDT-48213
                            </AppText>
                        </View>
                        <View style={styles.verifiedBadge}>
                            <MaterialIcons name="check-circle" size={14} color="#16A34A" />
                            <AppText variant="tiny" style={styles.verifiedText}>
                                VERIFIED
                            </AppText>
                        </View>
                    </View>

                    <View style={styles.bolRow}>
                        <View style={styles.bolLeftAccent}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                SHIPPER
                            </AppText>
                            <AppText variant="caption" style={{ color: theme.text }}>
                                Lone Star Distribution
                            </AppText>
                        </View>
                    </View>
                    <View style={styles.bolRow}>
                        <View style={styles.bolLeftAccent}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                RECEIVER
                            </AppText>
                            <AppText variant="caption" style={{ color: theme.text }}>
                                Midwest Cold Storage
                            </AppText>
                        </View>
                    </View>

                    <View style={styles.twoColMeta}>
                        <View style={{ flex: 1 }}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                COMMODITY
                            </AppText>
                            <AppText variant="caption" style={{ color: theme.text }}>
                                Palletized dry goods
                            </AppText>
                        </View>
                        <View style={{ flex: 1 }}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                SEAL NUMBER
                            </AppText>
                            <AppText variant="caption" style={{ color: "#2563EB" }}>
                                DT-SEAL-009132
                            </AppText>
                        </View>
                    </View>

                    <View style={[styles.pieceWeightRow, { borderTopColor: theme.cardSecondary }]}>
                        <View style={styles.pieceWeightItem}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                PIECES
                            </AppText>
                            <AppText variant="label1" style={{ color: theme.text }}>
                                24
                            </AppText>
                        </View>
                        <View style={[styles.pieceWeightDivider, { backgroundColor: theme.cardSecondary }]} />
                        <View style={styles.pieceWeightItem}>
                            <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                                WEIGHT
                            </AppText>
                            <AppText variant="label1" style={{ color: theme.text }}>
                                18,400 lbs
                            </AppText>
                        </View>
                    </View>
                </View>

                {/* Delivery Condition */}
                <View style={styles.sectionHeaderRow}>
                    <AppText variant="label" style={{ color: theme.text }}>
                        Delivery condition
                    </AppText>
                    <Pressable hitSlop={8}>
                        <MaterialIcons name="help-outline" size={20} color={theme.secondaryText} />
                    </Pressable>
                </View>

                <View style={styles.conditionRow}>
                    <Pressable
                        onPress={() => setCondition("Clean")}
                        style={[
                            styles.conditionBtn,
                            condition === "Clean"
                                ? styles.conditionBtnCleanActive
                                : [styles.conditionBtnInactive, { backgroundColor: theme.card, borderColor: theme.cardSecondary }],
                        ]}>
                        <MaterialIcons
                            name="check-circle"
                            size={18}
                            color={condition === "Clean" ? "#16A34A" : theme.secondaryText}
                        />
                        <AppText
                            variant="caption"
                            style={[styles.conditionBtnText, { color: condition === "Clean" ? "#16A34A" : theme.secondaryText }]}>
                            CLEAN
                        </AppText>
                    </Pressable>

                    <Pressable
                        onPress={() => setCondition("Claused")}
                        style={[
                            styles.conditionBtn,
                            condition === "Claused"
                                ? styles.conditionBtnClausedActive
                                : [styles.conditionBtnInactive, { backgroundColor: theme.card, borderColor: theme.cardSecondary }],
                        ]}>
                        <MaterialIcons
                            name="error-outline"
                            size={18}
                            color={condition === "Claused" ? "#DC2626" : theme.secondaryText}
                        />
                        <AppText
                            variant="caption"
                            style={[styles.conditionBtnText, { color: condition === "Claused" ? "#DC2626" : theme.secondaryText }]}>
                            CLAUSED
                        </AppText>
                    </Pressable>
                </View>

                {/* Proof of Delivery */}
                <View style={styles.sectionHeaderRow}>
                    <AppText variant="label" style={{ color: theme.text }}>
                        Proof of delivery
                    </AppText>
                    <View style={styles.requiredBadge}>
                        <AppText variant="tiny" style={styles.requiredText}>
                            REQUIRED
                        </AppText>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => setCameraVisible(true)}
                    activeOpacity={0.8}
                    style={[
                        styles.podBox,
                        {
                            backgroundColor: theme.card,
                            borderColor: podCaptured ? "#16A34A" : theme.cardSecondary,
                        },
                    ]}>
                    {podCaptured && podPhoto ? (
                        <>
                            <Image
                                source={{ uri: podPhoto.uri }}
                                style={styles.podThumbnail}
                                resizeMode="cover"
                            />
                            <View style={styles.podCapturedOverlay}>
                                <MaterialIcons name="check-circle" size={20} color="#16A34A" />
                                <AppText variant="caption" style={{ color: "#16A34A", fontWeight: "700" }}>
                                    POD Captured · Tap to retake
                                </AppText>
                            </View>
                            {podPhoto.coordinates ? (
                                <AppText variant="tiny" style={{ color: theme.secondaryText, marginTop: 4 }}>
                                    📍 {podPhoto.coordinates}
                                </AppText>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <View style={[styles.podIconWrap, { backgroundColor: "#EFF6FF" }]}>
                                <MaterialIcons name="photo-camera" size={32} color="#2563EB" />
                            </View>
                            <AppText variant="body" style={[styles.podTitle, { color: theme.text }]}>
                                Tap to capture POD
                            </AppText>
                            <AppText variant="caption" style={{ color: theme.secondaryText }}>
                                AUTO GPS + TIMESTAMP
                            </AppText>
                        </>
                    )}
                </TouchableOpacity>

                {/* Receiver Details */}
                <AppText variant="label" style={{ color: theme.text, paddingHorizontal: 4 }}>
                    Receiver details
                </AppText>

                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <AppInput
                        label="RECEIVER'S PRINTED NAME"
                        value={receiverName}
                        onChangeText={setReceiverName}
                        placeholder="Legal full name"
                        autoCapitalize="words"
                    />
                </View>

                <AppButton
                    title="Complete Delivery"
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={!canSubmit || submitting}
                    style={styles.submitBtn}
                />
            </KeyboardAwareScrollView>

            {/* Live Camera Modal for POD */}
            <Modal
                visible={cameraVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setCameraVisible(false)}>
                <View style={styles.cameraModal}>
                    <SafeAreaView style={styles.cameraHeader}>
                        <AppText variant="label" style={styles.cameraTitle}>
                            Proof of Delivery
                        </AppText>
                    </SafeAreaView>
                    <LiveCamera
                        accessLevel="full"
                        onCapture={handleCapture}
                        onClose={() => setCameraVisible(false)}
                        showFlip
                        showCapture
                        style={styles.camera}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 16, gap: 12, paddingBottom: 48 },
    card: { borderRadius: 16, padding: 16, gap: 12 },
    bolHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    bolLabel: { letterSpacing: 0.8, fontWeight: "600", marginBottom: 2 },
    bolNumber: { fontSize: 22, fontWeight: "800" },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    verifiedText: { color: "#16A34A", fontWeight: "700" },
    divider: { height: 1, borderRadius: 1 },
    bolRow: { gap: 4 },
    bolLeftAccent: {
        borderLeftWidth: 3,
        borderLeftColor: "#D1D5DB",
        paddingLeft: 10,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 2,
    },
    bolSubLabel: { letterSpacing: 0.6, fontWeight: "600" },
    bolValue: { fontWeight: "500" },
    twoColMeta: { flexDirection: "row", gap: 12, marginTop: 4 },
    pieceWeightRow: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
    pieceWeightItem: { flex: 1, alignItems: "center", gap: 4 },
    pieceWeightDivider: { width: 1 },
    pieceWeightValue: { fontSize: 18, fontWeight: "700" },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginTop: 4,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700" },
    requiredBadge: {
        backgroundColor: "#2563EB",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    requiredText: { color: "#FFFFFF", fontWeight: "700", letterSpacing: 0.5 },
    conditionRow: { flexDirection: "row", gap: 12 },
    conditionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    conditionBtnInactive: { borderWidth: 1.5 },
    conditionBtnCleanActive: { backgroundColor: "#F0FDF4", borderColor: "#16A34A", borderWidth: 1.5 },
    conditionBtnClausedActive: { backgroundColor: "#FEF2F2", borderColor: "#DC2626", borderWidth: 1.5 },
    conditionBtnText: { fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
    podBox: {
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: "dashed",
        paddingVertical: 36,
        alignItems: "center",
        gap: 8,
    },
    podIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
    podTitle: { fontWeight: "700", fontSize: 16 },
    submitBtn: { borderRadius: 16, height: 56, marginTop: 4 },
    cameraModal: { flex: 1, backgroundColor: "#000" },
    cameraHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingTop: 8,
        paddingHorizontal: 16,
    },
    cameraTitle: {
        color: "#FFFFFF",
        backgroundColor: "rgba(0,0,0,0.5)",
        alignSelf: "center",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        fontWeight: "700",
        overflow: "hidden",
    },
    camera: { flex: 1 },
    podThumbnail: { width: "100%", height: 180, borderRadius: 12 },
    podCapturedOverlay: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
});
