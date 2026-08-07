import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import type { Shipment, ShipmentStop } from "@/types/shipment";
import { Pressable, StyleSheet, View } from "react-native";

interface Props {
    shipment: Shipment;
    isActive?: boolean;
    onPress?: () => void;
}

function getStatusColor(
    status: string,
    primary: string,
    secondary: string,
    err: string,
) {
    switch (status) {
        case "Active":
            return primary;
        case "Upcoming":
            return primary;
        case "Past":
            return err;
        default:
            return primary;
    }
}

export default function ShipmentCard({ shipment, isActive = false, onPress }: Props) {
    const theme = useAppTheme();

    const pickup: ShipmentStop | undefined = shipment.stops.find(
        (s) => s.stop_type === "Pickup",
    );
    const delivery: ShipmentStop | undefined = shipment.stops.find(
        (s) => s.stop_type === "Delivery",
    );

    const statusColor = getStatusColor(
        shipment.status,
        theme.primaryButton,
        theme.secondaryButton,
        theme.err,
    );

    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [
                styles.card,
                { backgroundColor: theme.card },
                isActive && {
                    borderWidth: 1.5,
                    borderColor: statusColor + "33",
                },
                { opacity: pressed && !!onPress ? 0.85 : 1 },
            ]}>
            <View style={styles.header}>
                <AppText variant="body" style={{ color: theme.text }}>
                    {shipment.pro_number}
                </AppText>
                <View
                    style={[
                        styles.statusBadge,
                        { borderColor: statusColor },
                    ]}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: statusColor },
                        ]}
                    />
                    <AppText variant="tiny" style={{ color: statusColor }}>
                        {shipment.status}
                    </AppText>
                </View>
            </View>

            <View style={styles.routeRow}>
                <View style={styles.timelineCol}>
                    <View
                        style={[
                            styles.dotEmpty,
                            { borderColor: theme.secondaryText },
                        ]}
                    />
                    <View
                        style={[
                            styles.line,
                            { backgroundColor: statusColor },
                        ]}
                    />
                    <View
                        style={[
                            styles.dotFilled,
                            { backgroundColor: statusColor },
                        ]}
                    />
                </View>

                <View style={styles.routeTextCol}>

                    <View style={styles.routeStop}>
                        <AppText
                            variant="label1"
                            style={{ color: theme.text }}
                            numberOfLines={1}>
                             {pickup?.city ? `${pickup.city}, ${pickup.state}` : pickup?.stop_name ?? "—"}
                        </AppText>
                        {pickup && (
                            <AppText
                                variant="caption"
                                style={{ color: theme.secondaryText }}>
                                {pickup.start_date} · {pickup.start_time}
                            </AppText>
                        )}
                    </View>


                    <View style={styles.routeStop}>
                        <AppText
                            variant="label1"
                            style={{ color: theme.text }}
                            numberOfLines={1}>
                             {delivery?.city
                                ? `${delivery.city}, ${delivery.state}`
                                : delivery?.stop_name ?? "—"}
                        </AppText>
                        {delivery && (
                            <AppText
                                variant="caption"
                                style={{ color: statusColor }}>
                                {delivery.start_date} · {delivery.start_time}
                            </AppText>
                        )}
                    </View>
                </View>
            </View>

            <View
                style={[
                    styles.divider,
                    { backgroundColor: theme.cardSecondary },
                ]}
            />

            <View style={styles.infoRow}>
                <View
                    style={[
                        styles.infoBox,
                        { backgroundColor: theme.cardSecondary },
                    ]}>
                    <AppText
                        variant="tiny"
                        style={[styles.infoLabel, { color: theme.secondaryText }]}>
                        EQUIPMENT
                    </AppText>
                    <AppText
                        variant="label1"
                        style={{ color: theme.text, marginTop: 4 }}
                        numberOfLines={1}>
                        {shipment.truck_number || "—"}
                    </AppText>
                </View>

                <View
                    style={[
                        styles.infoBox,
                        { backgroundColor: theme.cardSecondary },
                    ]}>
                    <AppText
                        variant="tiny"
                        style={[styles.infoLabel, { color: theme.secondaryText }]}>
                        CARRIER
                    </AppText>
                    <AppText
                        variant="label1"
                        style={{ color: theme.text, marginTop: 4 }}
                        numberOfLines={1}>
                        {shipment.carrier_name || "—"}
                    </AppText>
                </View>
            </View>

            <View style={styles.footer}>
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}>
                    STATUS:{" "}
                    <AppText variant="caption" style={{ color: statusColor }}>
                        {shipment.status.toUpperCase()}
                    </AppText>
                </AppText>
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}>
                    0/{shipment.stops.length} STOPS
                </AppText>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    routeRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    timelineCol: {
        alignItems: "center",
        paddingTop: 4,
        width: 14,
    },
    dotEmpty: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    line: {
        width: 2,
        flex: 1,
        marginVertical: 4,
        minHeight: 28,
    },
    dotFilled: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    routeTextCol: {
        flex: 1,
        gap: 20,
    },
    routeStop: {
        gap: 2,
    },
    divider: {
        height: 1,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
    },
    infoBox: {
        flex: 1,
        borderRadius: 10,
        padding: 10,
    },
    infoLabel: {
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
});
