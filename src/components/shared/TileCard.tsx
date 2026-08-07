import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export interface TileCardBadge {
    label: string;
    color: string;
    bg: string;
}

interface TileCardProps {
    icon: ReactNode;
    title: string;
    badge?: TileCardBadge;

    showChevron?: boolean;
    onPress?: () => void;
}

export default function TileCard({
    icon,
    title,
    badge,
    showChevron = true,
    onPress,
}: TileCardProps) {
    const theme = useAppTheme();

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [
                styles.tile,
                {
                    backgroundColor: theme.card,
                    borderColor: theme.cardSecondary,
                    opacity: pressed ? 0.7 : 1,
                },
            ]}>
            <View
                style={[
                    styles.iconBox,
                    { backgroundColor: theme.cardSecondary },
                ]}>
                {icon}
            </View>

            <AppText
                variant="label1"
                style={{ color: theme.text }}
                numberOfLines={2}>
                {title}
            </AppText>

            <View style={styles.bottom}>
                {badge ? (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <AppText
                            variant="tiny"
                            style={{
                                color: badge.color,
                                fontWeight: "700",
                                letterSpacing: 0.4,
                            }}>
                            {badge.label}
                        </AppText>
                    </View>
                ) : (
                    <View />
                )}
            
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        gap: 10,
        alignItems: "flex-start",
        minHeight: 130,
        justifyContent: "space-between",
        backgroundColor: "blue",
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    bottom: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
});
