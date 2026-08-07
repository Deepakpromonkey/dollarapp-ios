import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import * as ImagePicker from "expo-image-picker";
// import * as MediaLibrary from "expo-media-library";
import { useCallback, useState } from "react";
import {
    Linking,
    Modal,
    PermissionsAndroid,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

export type MediaType = "Images" | "Videos" | "All";

export interface MediaAsset {
    uri: string;
    type: "image" | "video" | undefined;
    fileName: string | null | undefined;
    fileSize: number | undefined;
    width: number;
    height: number;
    duration: number | null | undefined;
}

export interface MediaPermissionPickerProps {
    mediaType?: MediaType;
    allowMultiple?: boolean;
    selectionLimit?: number;
    quality?: number;
    onSelect: (assets: MediaAsset[]) => void;
    onCancel?: () => void;
    trigger: (props: { open: () => void }) => React.ReactNode;
}

type SheetState = "denied" | "denied_permanent" | "limited" | null;


type PendingAction = "launchPicker" | "limitedPick" | "openSettings" | "reOpen" | null;

async function requestMediaPermission(): Promise<
    "granted" | "limited" | "denied" | "denied_permanent"
> {
    if (Platform.OS === "android") {
     
        const androidVersion = parseInt(String(Platform.Version), 10);

        const permission =
            androidVersion >= 33
                ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        const current = await PermissionsAndroid.check(permission);
        if (current) return "granted";

        const result = await PermissionsAndroid.request(permission);
        if (result === PermissionsAndroid.RESULTS.GRANTED) return "granted";
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
            return "denied_permanent";
        return "denied";
    }

  
    const { accessPrivileges } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (accessPrivileges === "all") return "granted";
    if (accessPrivileges === "limited") return "limited";
    return "denied_permanent";
}

export default function MediaPermissionPicker({
    mediaType = "Images",
    allowMultiple = false,
    selectionLimit = 10,
    quality = 0.85,
    onSelect,
    onCancel,
    trigger,
}: MediaPermissionPickerProps) {
    const theme = useAppTheme();
    const [sheetState, setSheetState] = useState<SheetState>(null);
 
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);

    const launchPicker = useCallback(
        async () => {
            const mediaTypeMap: Record<MediaType, ImagePicker.MediaType> = {
                Images: "images",
                Videos: "videos",
                All: "livePhotos",
            };

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: mediaTypeMap[mediaType],
                allowsMultipleSelection: allowMultiple,
                selectionLimit: allowMultiple ? selectionLimit : 1,
                quality,
            });

            if (result.canceled) {
                onCancel?.();
                return;
            }

            const assets: MediaAsset[] = result.assets.map((a) => ({
                uri: a.uri,
                type:
                    a.type === "livePhoto"
                        ? "image"
                        : a.type === "pairedVideo"
                          ? "video"
                          : (a.type ?? undefined),
                fileName: a.fileName,
                fileSize: a.fileSize,
                width: a.width,
                height: a.height,
                duration: a.duration,
            }));

            onSelect(assets);
        },
        [mediaType, allowMultiple, selectionLimit, quality, onSelect, onCancel],
    );

    const open = useCallback(async () => {
        const permStatus = await requestMediaPermission();
        if (permStatus === "granted") {
            await launchPicker();
            return;
        }
        setSheetState(permStatus); 
    }, [launchPicker]);

    const launchLimitedPicker = useCallback(async () => {
        if (Platform.OS === "ios") {
            try {
                // await MediaLibrary.presentPermissionsPicker();
            } catch {
               
            }
        }
        await launchPicker();
    }, [launchPicker]);

    const dismiss = () => {
        setSheetState(null);
        onCancel?.();
    };

  
    const handleModalDismissed = useCallback(() => {
        if (!pendingAction) return;
        const action = pendingAction;
        setPendingAction(null);

        if (action === "launchPicker") {
            launchPicker();
        } else if (action === "limitedPick") {
            launchLimitedPicker();
        } else if (action === "openSettings") {
            Linking.openSettings();
        } else if (action === "reOpen") {
            open();
        }
    }, [pendingAction, launchPicker, launchLimitedPicker, open]);


    const closeAndThen = useCallback(
        (action: PendingAction) => {
            setPendingAction(action);
            setSheetState(null);
         
            if (Platform.OS === "android") {
                setTimeout(() => {
                    setPendingAction((current) => {
                        if (current === action) {
                            if (action === "launchPicker") launchPicker();
                            else if (action === "limitedPick") launchLimitedPicker();
                            else if (action === "openSettings") Linking.openSettings();
                            else if (action === "reOpen") open();
                            return null;
                        }
                        return current;
                    });
                }, 50);
            }
        },
        [launchPicker, launchLimitedPicker, open],
    );

    return (
        <>
            {trigger({ open })}

            <Modal
                visible={sheetState !== null}
                transparent
                animationType="slide"
                onDismiss={handleModalDismissed}
                onRequestClose={() => {
                    setSheetState(null);
                    onCancel?.();
                }}>
   
                <Pressable style={styles.backdrop} onPress={dismiss} />

              
                <View
                    style={[
                        styles.sheet,
                        { backgroundColor: theme.card },
                    ]}>
      
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: theme.cardSecondary },
                        ]}
                    />

                    {sheetState === "limited" ? (
                
                        <>
                            <View
                                style={[
                                    styles.badge,
                                    { backgroundColor: "#FFF7ED" },
                                ]}>
                                <AppText
                                    variant="tiny"
                                    style={{
                                        color: "#F97316",
                                        fontWeight: "700",
                                        letterSpacing: 0.6,
                                    }}>
                                    🔓  LIMITED ACCESS
                                </AppText>
                            </View>

                            <AppText
                                variant="title"
                                style={[
                                    styles.title,
                                    { color: theme.text },
                                ]}>
                                Limited Photo Access
                            </AppText>

                            <AppText
                                variant="caption"
                                style={[
                                    styles.desc,
                                    { color: theme.secondaryText },
                                ]}>
                                You've allowed access to only selected photos.
                                Pick from those or grant full access in Settings.
                            </AppText>

                            <Pressable
                                onPress={() => {
                                    closeAndThen("limitedPick");
                                }}
                                style={({ pressed }) => [
                                    styles.btnPrimary,
                                    { backgroundColor: theme.primaryButton },
                                    pressed && { opacity: 0.85 },
                                ]}>
                                <AppText
                                    variant="label"
                                    style={{ color: "#fff", fontWeight: "600" }}>
                                    Pick from Selected Photos
                                </AppText>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    closeAndThen("openSettings");
                                }}
                                style={({ pressed }) => [
                                    styles.btnOutline,
                                    {
                                        borderColor: theme.cardSecondary,
                                        backgroundColor: theme.cardSecondary,
                                    },
                                    pressed && { opacity: 0.7 },
                                ]}>
                                <AppText
                                    variant="label"
                                    style={{ color: theme.text }}>
                                    Manage in Settings
                                </AppText>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setSheetState(null);
                                    onCancel?.();
                                }}
                                style={styles.btnDismiss}>
                                <AppText
                                    variant="caption"
                                    style={{ color: theme.secondaryText }}>
                                    Not now
                                </AppText>
                            </Pressable>
                        </>
                    ) : (
                
                        <>
                            <View
                                style={[
                                    styles.badge,
                                    { backgroundColor: "#FEF2F2" },
                                ]}>
                                <AppText
                                    variant="tiny"
                                    style={{
                                        color: "#EF4444",
                                        fontWeight: "700",
                                        letterSpacing: 0.6,
                                    }}>
                                    {sheetState === "denied_permanent"
                                        ? "⛔  ACCESS BLOCKED"
                                        : "🔒  PERMISSION NEEDED"}
                                </AppText>
                            </View>

                            <AppText
                                variant="title"
                                style={[styles.title, { color: theme.text }]}>
                                {sheetState === "denied_permanent"
                                    ? "Photos Access Blocked"
                                    : "Photos Access Required"}
                            </AppText>

                            <AppText
                                variant="caption"
                                style={[
                                    styles.desc,
                                    { color: theme.secondaryText },
                                ]}>
                                {sheetState === "denied_permanent"
                                    ? Platform.OS === "ios"
                                        ? "Go to Settings → Privacy & Security → Photos → DollarTraq and choose \"All Photos\" or \"Selected Photos\"."
                                        : "Go to Settings → Apps → DollarTraq → Permissions → Photos and allow access."
                                    : "DollarTraq needs access to your photos and videos to attach them to the verification form."}
                            </AppText>

                            <Pressable
                                onPress={() => {
                                    if (sheetState === "denied_permanent") {
                                        closeAndThen("openSettings");
                                    } else {
                                        closeAndThen("reOpen");
                                    }
                                }}
                                style={({ pressed }) => [
                                    styles.btnPrimary,
                                    { backgroundColor: theme.primaryButton },
                                    pressed && { opacity: 0.85 },
                                ]}>
                                <AppText
                                    variant="label"
                                    style={{ color: "#fff", fontWeight: "600" }}>
                                    {sheetState === "denied_permanent"
                                        ? "Open Settings"
                                        : "Grant Access"}
                                </AppText>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setSheetState(null);
                                    onCancel?.();
                                }}
                                style={styles.btnDismiss}>
                                <AppText
                                    variant="caption"
                                    style={{ color: theme.secondaryText }}>
                                    Cancel
                                </AppText>
                            </Pressable>
                        </>
                    )}
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        gap: 14,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 4,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    title: {
        fontWeight: "700",
        textAlign: "center",
    },
    desc: {
        textAlign: "center",
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    btnPrimary: {
        width: "100%",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 4,
    },
    btnOutline: {
        width: "100%",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        borderWidth: 1,
    },
    btnDismiss: {
        paddingVertical: 4,
    },
});
