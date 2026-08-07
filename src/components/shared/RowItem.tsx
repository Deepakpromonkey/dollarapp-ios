import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export type RowItemStatus = "verified" | "pending" | "required";

const STATUS_CFG: Record<
    RowItemStatus,
    { label: string; color: string; bg: string }
> = {
    verified: { label: "VERIFIED", color: "#22C55E", bg: "#22C55E18" },
    pending: { label: "VERIFY", color: "#2563EB", bg: "#2563EB18" },
    required: { label: "REQUIRED", color: "#9CA3AF", bg: "#9CA3AF18" },
};

interface RowItemProps {
    icon: ReactNode;
    title: string;
    subtitle?: string;

    status?: RowItemStatus;

    matchScore?: string;

    variant?: "normal" | "destructive";

    showChevron?: boolean;

    statusIcon?: boolean;
    onPress?: () => void;
}

export default function RowItem({
    icon,
    title,
    subtitle,
    status,
    matchScore,
    variant = "normal",
    showChevron = true,
    statusIcon = false,
    onPress,
}: RowItemProps) {
    const theme = useAppTheme();
    const cfg = status ? STATUS_CFG[status] : null;

    const iconCircleBg =
        statusIcon && status === "verified" ? "#22C55E18" : theme.cardSecondary;

    const iconCircleBorder =
        statusIcon && status === "verified" ? "#22C55E40" : "transparent";

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.card },
                { opacity: pressed ? 0.7 : 1 },
            ]}>
            <View
                style={[
                    styles.iconCircle,
                    {
                        backgroundColor: iconCircleBg,
                        borderColor: iconCircleBorder,
                        borderWidth: statusIcon ? 1 : 0,
                    },
                ]}>
                {icon}
            </View>

            <View style={styles.info}>
                <AppText
                    variant="label1"
                    style={{
                        color:
                            variant === "destructive" ? theme.err : theme.text,
                        fontWeight: "600",
                    }}>
                    {title}
                </AppText>
                {subtitle ? (
                    <AppText
                        variant="tiny"
                        style={{ color: theme.secondaryText, marginTop: 1 }}>
                        {subtitle}
                    </AppText>
                ) : null}
            </View>

            <View style={styles.right}>
                {cfg && (
                    <View style={styles.badgeCol}>
                        {matchScore ? (
                            <AppText
                                variant="tiny"
                                style={{
                                    color: theme.secondaryText,
                                    marginBottom: 2,
                                }}>
                                {matchScore}
                            </AppText>
                        ) : null}
                        <View
                            style={[styles.badge, { backgroundColor: cfg.bg }]}>
                            <AppText
                                variant="tiny"
                                style={{
                                    color: cfg.color,
                                    fontWeight: "700",
                                    letterSpacing: 0.4,
                                }}>
                                {cfg.label}
                            </AppText>
                        </View>
                    </View>
                )}
                {showChevron && !cfg && (
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={22}
                        color={theme.secondaryText}
                    />
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
        borderRadius: 10,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    info: {
        flex: 1,
        gap: 2,
    },
    right: {
        alignItems: "flex-end",
    },
    badgeCol: {
        alignItems: "flex-end",
        gap: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
});
