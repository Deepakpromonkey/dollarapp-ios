import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

export type TripStatus = "clean" | "issue" | "pending";

export interface ProfileActivityItem {
    id: string;
    date: string;
    tripId: string;
    status: TripStatus;
    origin: string;
    originTime: string;
    destination: string;
    destinationTime: string;
}

interface ProfileActivityCardProps {
    item: ProfileActivityItem;
    onViewDetails?: () => void;
}

const STATUS_CONFIG: Record<
    TripStatus,
    { label: string; color: string; bg: string }
> = {
    clean: { label: "CLEAN", color: "#22C55E", bg: "#22C55E" },
    issue: { label: "ISSUE", color: "#FFFFFF", bg: "#EF4444" },
    pending: { label: "PENDING", color: "#FFFFFF", bg: "#F59E0B" },
};

export default function ProfileActivityCard({
    item,
    onViewDetails,
}: ProfileActivityCardProps) {
    const theme = useAppTheme();
    const cfg = STATUS_CONFIG[item.status];

    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          

            <AppText variant="caption" style={{ color: theme.secondaryText }}>
                ID: {item.tripId}
            </AppText>

            <View
                style={[
                    styles.divider,
                    { backgroundColor: theme.cardSecondary },
                ]}
            />

            <View style={styles.routeRow}>
                <View style={styles.routeCol}>
                    <AppText
                        variant="caption"
                        style={{ color: theme.text }}>
                        {item.origin}
                    </AppText>
                    <AppText
                        variant="caption"
                        style={{ color: theme.secondaryText }}>
                        {item.originTime}
                    </AppText>
                </View>

                <MaterialCommunityIcons
                    name="arrow-right"
                    size={22}
                    color={theme.secondaryText}
                />

                <View style={[styles.routeCol, { alignItems: "flex-end" }]}>
                    <AppText
                        variant="caption"
                        style={{ color: theme.text }}>
                        {item.destination}
                    </AppText>
                    <AppText
                        variant="caption"
                        style={{ color: theme.secondaryText }}>
                        {item.destinationTime}
                    </AppText>
                </View>
            </View>

            <Pressable
                onPress={onViewDetails}
                style={({ pressed }) => ({
                    opacity: pressed ? 0.6 : 1,
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                })}>
                <AppText
                    variant="caption"
                    style={{ color: theme.primaryButton, fontWeight: "600" }}>
                    View Details
                </AppText>
                <MaterialCommunityIcons
                    name="arrow-right"
                    size={10}
                    color={theme.primaryButton}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        gap: 10,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    solidBadge: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    divider: {
        height: 1,
    },
    routeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    routeCol: {
        flex: 1,
        gap: 2,
    },
});
