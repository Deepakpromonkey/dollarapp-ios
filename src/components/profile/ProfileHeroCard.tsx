import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View, ActivityIndicator } from "react-native";

interface ProfileHeroCardProps {
    name: string;
    role: string;
    company: string;
    email?: string;
    phone?: string;
    designation?: string | null;
    avatarUri?: string;
    verified?: boolean;
    isUploading?: boolean;
    onEditAvatar?: () => void;
    onAvatarPress?: () => void;
}

export default function ProfileHeroCard({
    name,
    role,
    company,
    email,
    phone,
    designation,
    avatarUri,
    verified = false,
    isUploading = false,
    onEditAvatar,
    onAvatarPress,
}: ProfileHeroCardProps) {
    const theme = useAppTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.avatarWrapper}>
                <Pressable onPress={onAvatarPress} disabled={isUploading}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View
                            style={[
                                styles.avatar,
                                styles.avatarPlaceholder,
                                { backgroundColor: theme.cardSecondary },
                            ]}>
                            <AppText
                                style={{
                                    fontSize: 26,
                                    color: theme.secondaryText,
                                }}>
                                {name.charAt(0).toUpperCase()}
                            </AppText>
                        </View>
                    )}
                </Pressable>

                {isUploading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    </View>
                )}

                <Pressable
                    onPress={onEditAvatar}
                    disabled={isUploading}
                    style={({ pressed }) => [
                        styles.cameraBtn,
                        {
                            backgroundColor: theme.primaryButton,
                            opacity: pressed || isUploading ? 0.7 : 1,
                        },
                    ]}>
                    <MaterialCommunityIcons
                        name="camera"
                        size={12}
                        color={theme.card}
                    />
                </Pressable>
            </View>

            <View style={styles.info}>
                <AppText variant="body" style={{ color: theme.text }}>
                    {name}
                </AppText>
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText, marginTop: 2 }}>
                    {role}
                    {designation ? ` · ${designation}` : company ? ` · ${company}` : ""}
                </AppText>

                {(email || phone) && (
                    <View style={styles.contactInfo}>
                        {email && (
                            <View style={styles.contactRow}>
                                <MaterialCommunityIcons
                                    name="email-outline"
                                    size={14}
                                    color={theme.secondaryText}
                                />
                                <AppText
                                    variant="tiny"
                                    style={{ color: theme.secondaryText }}>
                                    {email}
                                </AppText>
                            </View>
                        )}
                        {phone && (
                            <View style={styles.contactRow}>
                                <MaterialCommunityIcons
                                    name="phone-outline"
                                    size={14}
                                    color={theme.secondaryText}
                                />
                                <AppText
                                    variant="tiny"
                                    style={{ color: theme.secondaryText }}>
                                    {phone}
                                </AppText>
                            </View>
                        )}
                    </View>
                )}

                {verified && (
                    <View style={styles.verifiedBadge}>
                        <AppText
                            variant="tiny"
                            style={{
                                color: "#22C55E",
                                fontWeight: "700",
                                letterSpacing: 0.4,
                            }}>
                            DID VERIFIED
                        </AppText>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        padding: 16,
        gap: 14,
    },
    avatarWrapper: {
        position: "relative",
    },
    avatar: {
        width: 68,
        height: 68,
        borderRadius: 16,
    },
    avatarPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0,0,0,0.4)",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    cameraBtn: {
        position: "absolute",
        bottom: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 11,
    },
    info: {
        flex: 1,
        gap: 0,
    },
    verifiedBadge: {
        marginTop: 8,
        alignSelf: "flex-start",
        backgroundColor: "#22C55E18",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#22C55E30",
    },
    contactInfo: {
        marginTop: 6,
        gap: 3,
    },
    contactRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
});