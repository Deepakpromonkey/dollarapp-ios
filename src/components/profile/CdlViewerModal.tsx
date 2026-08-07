import AppText from "@/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

interface CdlViewerModalProps {
    visible: boolean;
    onClose: () => void;
    frontUri: string | null;
    backUri: string | null;
}

export default function CdlViewerModal({ visible, onClose, frontUri, backUri }: CdlViewerModalProps) {
    const [cdlSide, setCdlSide] = useState<"front" | "back">("front");
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 150,
                friction: 12,
                useNativeDriver: true,
            }).start();
        } else {
            scaleAnim.setValue(0);
            setCdlSide("front");
        }
    }, [visible, scaleAnim]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.viewerBackground}>
                <View style={styles.cdlHeader}>
                    <View style={styles.cdlTabs}>
                        <Pressable 
                            onPress={() => setCdlSide("front")} 
                            style={[
                                styles.cdlTab, 
                                cdlSide === "front" ? styles.cdlTabActive : {}
                            ]}
                        >
                            <AppText 
                                style={[
                                    styles.cdlTabText, 
                                    cdlSide === "front" ? styles.cdlTabTextActive : {}
                                ]}
                            >
                                Front
                            </AppText>
                        </Pressable>
                        <Pressable 
                            onPress={() => setCdlSide("back")} 
                            style={[
                                styles.cdlTab, 
                                cdlSide === "back" ? styles.cdlTabActive : {}
                            ]}
                        >
                            <AppText 
                                style={[
                                    styles.cdlTabText, 
                                    cdlSide === "back" ? styles.cdlTabTextActive : {}
                                ]}
                            >
                                Back
                            </AppText>
                        </Pressable>
                    </View>

                    <Pressable 
                        style={styles.cdlCloseBtn} 
                        onPress={onClose}
                    >
                        <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                    </Pressable>
                </View>

                <Animated.View style={[styles.cdlImageContainer, { transform: [{ scale: scaleAnim }] }]}>
                    {cdlSide === "front" && frontUri ? (
                        <Image source={{ uri: frontUri }} style={styles.cdlImage} resizeMode="contain" />
                    ) : cdlSide === "back" && backUri ? (
                        <Image source={{ uri: backUri }} style={styles.cdlImage} resizeMode="contain" />
                    ) : (
                        <View style={styles.cdlEmpty}>
                            <MaterialCommunityIcons name="file-document-outline" size={48} color="rgba(255,255,255,0.3)" />
                            <AppText style={styles.cdlEmptyText}>Document not available</AppText>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    viewerBackground: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        justifyContent: "center",
        alignItems: "center",
    },
    cdlHeader: {
        position: "absolute",
        top: Platform.OS === "ios" ? 60 : 40,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        paddingHorizontal: 20,
    },
    cdlTabs: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 24,
        padding: 4,
    },
    cdlTab: {
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 20,
    },
    cdlTabActive: {
        backgroundColor: "#FFFFFF",
    },
    cdlTabText: {
        color: "rgba(255,255,255,0.6)",
        fontWeight: "600",
        fontSize: 14,
    },
    cdlTabTextActive: {
        color: "#000000",
    },
    cdlCloseBtn: {
        position: "absolute",
        right: 20,
        padding: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 20,
    },
    cdlImageContainer: {
        width: "100%",
        height: "70%",
        justifyContent: "center",
        alignItems: "center",
    },
    cdlImage: {
        width: "90%",
        height: "100%",
        borderRadius: 12,
    },
    cdlEmpty: {
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    cdlEmptyText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 16,
    },
});