import AppText from "@/components/AppText";
import LiveCamera, { CaptureResult } from "@/components/LiveCamera";
import { useAppTheme } from "@/hooks/useAppTheme";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";

export interface AvatarPickerSheetProps {
    visible: boolean;
    onClose: () => void;
    onPhotoSelected: (uri: string) => void;
}

export default function AvatarPickerSheet({
    visible,
    onClose,
    onPhotoSelected, 
}: AvatarPickerSheetProps) {
    const theme = useAppTheme();
    const [cameraOpen, setCameraOpen] = useState(false);

    const handleGalleryPress = useCallback(() => {
        onClose();

        setTimeout(
            async () => {
                try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: "images",
                        allowsMultipleSelection: false,
                        quality: 0.4,
                    });

                    if (!result.canceled && result.assets.length > 0) {
                        onPhotoSelected(result.assets[0].uri);
                    }
                } catch (e) {
                    console.warn("[AvatarPickerSheet] gallery error:", e);
                }
            },
            Platform.OS === "ios" ? 400 : 200,
        );
    }, [onClose, onPhotoSelected]);

    const handleCameraPress = useCallback(() => {
        onClose();
        setTimeout(
            () => setCameraOpen(true),
            Platform.OS === "ios" ? 400 : 200,
        );
    }, [onClose]);

    const handleCameraCapture = useCallback(
        (result: CaptureResult) => {
            setCameraOpen(false);
            onPhotoSelected(result.uri);
        },
        [onPhotoSelected],
    );

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={onClose}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[styles.sheet, { backgroundColor: theme.card }]}>
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: theme.cardSecondary },
                        ]}
                    />

                    <AppText
                        variant="title"
                        style={[styles.heading, { color: theme.text }]}>
                        Update Profile Photo 
                    </AppText>

                    <Pressable
                        onPress={handleCameraPress}
                        style={({ pressed }) => [
                            styles.option,
                            { backgroundColor: theme.cardSecondary },
                            pressed && { opacity: 0.75 },
                        ]}>
                        <View
                            style={[
                                styles.iconCircle,
                                { backgroundColor: theme.primaryButton + "1A" },
                            ]}>
                            <MaterialCommunityIcons
                                name="camera"
                                size={20}
                                color={theme.primaryButton}
                            />
                        </View>
                        <View style={styles.optionText}>
                            <AppText
                                variant="label1"
                                style={{
                                    color: theme.text,
                                    fontWeight: "600",
                                }}>
                                Take a Photo
                            </AppText>
                        </View>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color={theme.secondaryText}
                        />
                    </Pressable>

                    <Pressable
                        onPress={handleGalleryPress}
                        style={({ pressed }) => [
                            styles.option,
                            { backgroundColor: theme.cardSecondary },
                            pressed && { opacity: 0.75 },
                        ]}>
                        <View
                            style={[
                                styles.iconCircle,
                                { backgroundColor: theme.primaryButton + "1A" },
                            ]}>
                            <MaterialCommunityIcons
                                name="image-multiple"
                                size={20}
                                color={theme.primaryButton}
                            />
                        </View>
                        <View style={styles.optionText}>
                            <AppText
                                variant="label1"
                                style={{
                                    color: theme.text,
                                    fontWeight: "600",
                                }}>
                                Upload from Gallery
                            </AppText>
                        </View>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color={theme.secondaryText}
                        />
                    </Pressable>

                    <Pressable onPress={onClose} style={styles.cancelBtn}>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            Cancel
                        </AppText>
                    </Pressable>
                </View>
            </Modal>

            <Modal
                visible={cameraOpen}
                animationType="slide"
                onRequestClose={() => setCameraOpen(false)}>
                <LiveCamera
                    accessLevel="limited"
                    showFlip
                    onCapture={handleCameraCapture}
                    onClose={() => setCameraOpen(false)}
                />
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0)",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
        gap: 12,
        alignItems: "center",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 4,
    },
    heading: {
        fontWeight: "700",
        textAlign: "center",
    },
    sub: {
        textAlign: "center",
        marginBottom: 4,
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        borderRadius: 16,
        padding: 10,
        gap: 14,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
    },
    optionText: {
        flex: 1,
        gap: 2,
    },
    cancelBtn: {
        paddingVertical: 6,
        marginTop: 2,
    },
});
