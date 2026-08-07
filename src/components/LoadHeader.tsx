import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface LoadHeaderProps {
    title: string;

    live?: boolean;

    liveLabel?: string;

    onMenuPress?: () => void;

    onNotificationPress?: () => void;

    notificationCount?: number;

    right?: ReactNode;
}

export default function LoadHeader({
    title,
    live = false,
    liveLabel = "LIVE",
    onMenuPress,
    onNotificationPress,
    notificationCount = 0,
    right,
}: LoadHeaderProps) {
    const theme = useAppTheme();
    const isDark = theme.background === "#0D0F14";

    const iconBg = isDark ? "#1E2128" : "#ECF0EE";
    const iconColor = isDark ? "#9CA3AF" : "#4B5563";
    const liveBg = isDark ? "#1A2E22" : "#D6EDE2";
    const liveDot = "#1A6640";
    const liveText = isDark ? "#4ADE80" : "#1A6640";

    return (
        <View style={[styles.container, { backgroundColor: theme.card }]}>
            <Pressable
                onPress={onMenuPress}
                hitSlop={10}
                style={[styles.iconBtn, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons
                    name="menu"
                    size={20}
                    color={iconColor}
                />
            </Pressable>

            <View style={styles.center}>
                <AppText
                    variant="label1"
                    style={[styles.title, { color: theme.text }]}
                    numberOfLines={1}>
                    {title.toUpperCase()}
                </AppText>

                {live && (
                    <View
                        style={[styles.liveBadge, { backgroundColor: liveBg }]}>
                        <View
                            style={[
                                styles.liveDot,
                                { backgroundColor: liveDot },
                            ]}
                        />
                        <AppText
                            style={[styles.liveLabel, { color: liveText }]}>
                            {liveLabel}
                        </AppText>
                    </View>
                )}
            </View>

            <View style={styles.rightSlot}>
                <Pressable
                    onPress={onNotificationPress}
                    hitSlop={10}
                    style={[styles.iconBtn, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons
                        name="bell-outline"
                        size={20}
                        color={iconColor}
                    />
                    {notificationCount > 0 && <View style={styles.badge} />}
                </Pressable>
                {right}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    iconBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    center: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    title: {
        fontWeight: "700",
        letterSpacing: 0.8,
        fontSize: 13,
    },
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    liveLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    rightSlot: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    badge: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#EF4444",
    },
});
