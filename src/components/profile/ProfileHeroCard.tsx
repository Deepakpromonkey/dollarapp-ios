import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { livenessBadge, type LivenessState } from "@/utils/liveness";
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
    /** The identity check, from utils/liveness resolveLiveness. Null shows no badge. */
    liveness?: LivenessState | null;
    /** Start or re-check the identity check. The verified badge ignores taps. */
    onLivenessPress?: () => void;
    /** An identity check is starting or being re-checked. */
    livenessBusy?: boolean;
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
    liveness = null,
    onLivenessPress,
    livenessBusy = false,
    isUploading = false,
    onEditAvatar,
    onAvatarPress,
}: ProfileHeroCardProps) {
    const theme = useAppTheme();
    const badge = liveness ? livenessBadge(liveness, theme.primaryButton) : null;
    const badgeTappable = !!badge?.actionable && !!onLivenessPress && !livenessBusy;

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

                {badge && (
                    <Pressable
                        onPress={onLivenessPress}
                        disabled={!badgeTappable}
                        accessibilityRole={badge.actionable ? "button" : "text"}
                        accessibilityState={{ busy: livenessBusy }}
                        hitSlop={6}
                        style={({ pressed }) => [
                            styles.livenessBadge,
                            {
                                backgroundColor: badge.bg,
                                borderColor: badge.border,
                                opacity: pressed && badgeTappable ? 0.7 : 1,
                            },
                        ]}>
                        {livenessBusy ? (
                            <ActivityIndicator size={12} color={badge.color} />
                        ) : (
                            <MaterialCommunityIcons
                                name={badge.icon}
                                size={12}
                                color={badge.color}
                            />
                        )}
                        <AppText
                            variant="tiny"
                            style={{
                                color: badge.color,
                                fontWeight: "700",
                                letterSpacing: 0.4,
                            }}>
                            {badge.label}
                        </AppText>
                        {badge.actionable && !livenessBusy && (
                            <MaterialCommunityIcons
                                name="chevron-right"
                                size={12}
                                color={badge.color}
                            />
                        )}
                    </Pressable>
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
    livenessBadge: {
        marginTop: 8,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
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