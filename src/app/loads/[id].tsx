import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import SectionHeader from "@/components/SectionHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment, ShipmentStop } from "@/types/shipment";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


function getStatusColor(status: string, primary: string, err: string): string {
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

function InfoTile({ label, value }: { label: string; value: string }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.infoTile, { backgroundColor: theme.cardSecondary }]}>
            <AppText
                variant="tiny"
                style={[styles.infoTileLabel, { color: theme.secondaryText }]}>
                {label}
            </AppText>
            <AppText variant="label1" style={{ color: theme.text, marginTop: 4 }}>
                {value || "—"}
            </AppText>
        </View>
    );
}

function RouteTimeline({
    pickup,
    delivery,
    statusColor,
}: {
    pickup?: ShipmentStop;
    delivery?: ShipmentStop;
    statusColor: string;
}) {
    const theme = useAppTheme();
    return (
        <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.routeRow}>
                <View style={styles.timelineCol}>
                    <View
                        style={[styles.dotEmpty, { borderColor: theme.secondaryText }]}
                    />
                    <View style={[styles.line, { backgroundColor: statusColor }]} />
                    <View style={[styles.dotFilled, { backgroundColor: statusColor }]} />
                </View>

                <View style={styles.routeTextCol}>
                    {/* Pickup */}
                    <View style={styles.routeStop}>
                        <AppText
                            variant="label"
                            style={{ color: theme.text, fontWeight: "600" }}>
                            {pickup?.city ? `${pickup.city}, ${pickup.state}` : pickup?.stop_name ?? "—"}
                        </AppText>
                        {pickup && (
                            <AppText variant="caption" style={{ color: theme.secondaryText }}>
                                {pickup.start_date}
                                {pickup.start_time ? ` · ${pickup.start_time} - ${pickup.end_time ?? ""} ${pickup.start_timezone ?? ""}` : ""}
                            </AppText>
                        )}
                        {pickup && (
                            <View style={styles.readyBadge}>
                                <View
                                    style={[styles.readyDot, { backgroundColor: statusColor }]}
                                />
                                <AppText
                                    variant="tiny"
                                    style={{ color: statusColor, fontWeight: "600" }}>
                                    Pickup Ready
                                </AppText>
                            </View>
                        )}
                    </View>

                    <View style={styles.routeStop}>
                        <AppText
                            variant="label"
                            style={{ color: theme.text, fontWeight: "600" }}>
                            {delivery?.city
                                ? `${delivery.city}, ${delivery.state}`
                                : delivery?.stop_name ?? "—"}
                        </AppText>
                        {delivery && (
                            <AppText variant="caption" style={{ color: theme.secondaryText }}>
                                {delivery.start_date}
                                {delivery.start_time ? ` · ${delivery.start_time}` : ""}
                            </AppText>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

function CarrierDetails({ shipment }: { shipment: Shipment }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.section, { backgroundColor: theme.card }]}>
            <AppText
                variant="label"
                style={{ color: theme.text, fontWeight: "700", marginBottom: 14 }}>
                Carrier Details
            </AppText>
            <View style={styles.infoGrid}>
                <InfoTile label="Carrier Name" value={shipment.carrier_name} />
                <InfoTile label="Carrier MC" value={shipment.carrier_mc} />
            </View>
            <View style={[styles.infoGrid, { marginTop: 10 }]}>
                <InfoTile label="Carrier DOT" value={shipment.carrier_dot} />
                <InfoTile label="Carrier Phone" value={shipment.carrier_phone} />
            </View>
        </View>
    );
}

function TruckDetails({ shipment }: { shipment: Shipment }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.section, { backgroundColor: theme.card }]}>
            <AppText
                variant="label"
                style={{ color: theme.text, fontWeight: "700", marginBottom: 14 }}>
                Truck & Driver
            </AppText>
            <View style={styles.infoGrid}>
                <InfoTile label="Truck #" value={shipment.truck_number} />
                <InfoTile label="Trailer #" value={shipment.trailer_number} />
            </View>
            {(shipment.driver_phone_1 || shipment.driver_type) && (
                <View style={[styles.infoGrid, { marginTop: 10 }]}>
                    <InfoTile label="Driver Phone" value={shipment.driver_phone_1} />
                    <InfoTile label="Driver Type" value={shipment.driver_type} />
                </View>
            )}
        </View>
    );
}

function StopsList({ stops }: { stops: ShipmentStop[] }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.section, { backgroundColor: theme.card }]}>
            <AppText
                variant="label"
                style={{ color: theme.text, fontWeight: "700", marginBottom: 14 }}>
                Stops ({stops.length})
            </AppText>
            {stops.map((stop, idx) => {
                const isPickup = stop.stop_type === "Pickup";
                const dotColor = isPickup ? theme.primaryButton : "#EF4444";
                const isLast = idx === stops.length - 1;
                return (
                    <View key={stop.id} style={styles.stopRow}>
                        <View style={styles.stopTimeline}>
                            <View style={[styles.stopDot, { backgroundColor: dotColor }]}>
                                <MaterialCommunityIcons
                                    name={isPickup ? "package-up" : "package-down"}
                                    size={10}
                                    color="#fff"
                                />
                            </View>
                            {!isLast && (
                                <View
                                    style={[styles.stopLine, { backgroundColor: theme.cardSecondary }]}
                                />
                            )}
                        </View>

                        <View style={[styles.stopInfo, !isLast && { paddingBottom: 20 }]}>
                            <View style={styles.stopHeader}>
                                <AppText
                                    variant="label1"
                                    style={{ color: theme.text, fontWeight: "600", flex: 1 }}>
                                    {stop.stop_name}
                                </AppText>
                                <View
                                    style={[
                                        styles.stopTypeBadge,
                                        {
                                            backgroundColor: isPickup
                                                ? theme.primaryButton + "18"
                                                : "#EF444418",
                                        },
                                    ]}>
                                    <AppText
                                        variant="tiny"
                                        style={{
                                            color: isPickup ? theme.primaryButton : "#EF4444",
                                            fontWeight: "700",
                                        }}>
                                        {stop.stop_type.toUpperCase()}
                                    </AppText>
                                </View>
                            </View>
                            <AppText
                                variant="caption"
                                style={{ color: theme.secondaryText, marginTop: 2 }}>
                                {[stop.address, stop.city, stop.state, stop.zipcode]
                                    .filter(Boolean)
                                    .join(", ")}
                            </AppText>
                            <AppText
                                variant="tiny"
                                style={{ color: theme.secondaryText, marginTop: 3 }}>
                                {stop.start_date}
                                {stop.start_time ? ` · ${stop.start_time}` : ""}
                                {stop.start_timezone ? ` ${stop.start_timezone}` : ""}
                            </AppText>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}


export default function LoadDetailScreen() {
    const theme = useAppTheme();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { active, upcoming, past, loading } = useShipments();

    const allShipments: Shipment[] = [...active, ...upcoming, ...past];
    const shipment = allShipments.find((s) => String(s.id) === id);

    const statusColor = shipment
        ? getStatusColor(shipment.status, theme.primaryButton, theme.err)
        : theme.primaryButton;

    const pickup = shipment?.stops.find((s) => s.stop_type === "Pickup");
    const delivery = shipment?.stops.find((s) => s.stop_type === "Delivery");

    if (loading && !shipment) {
        return (
            <SafeAreaView
                style={[styles.screen, { backgroundColor: theme.background }]}>
                <NavHeader title="Load Detail" />
                <View style={styles.center}>
                    <ActivityIndicator color={theme.primaryButton} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    if (!shipment) {
        return (
            <SafeAreaView
                style={[styles.screen, { backgroundColor: theme.background }]}>
                <NavHeader title="Load Detail" />
                <View style={styles.center}>
                    <MaterialCommunityIcons
                        name="truck-alert-outline"
                        size={48}
                        color={theme.secondaryText}
                    />
                    <AppText
                        variant="label"
                        style={{ color: theme.secondaryText, marginTop: 12, textAlign: "center" }}>
                        Load not found
                    </AppText>
                </View>
            </SafeAreaView>
        );
    }

    const scheduledCount = shipment.stops.length;

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader
                title={shipment.shipment_no || shipment.pro_number}
                
            />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>

                <View style={styles.heroRow}>
                    <AppText variant="h2" style={{ color: theme.text, fontWeight: "700" }}>
                        {shipment.shipment_no || shipment.pro_number}
                    </AppText>
                    <View
                        style={[styles.statusBadge, { borderColor: statusColor + "55" }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <AppText variant="tiny" style={{ color: statusColor, fontWeight: "700" }}>
                            {shipment.status.toUpperCase()}
                        </AppText>
                    </View>
                </View>

                <SectionHeader label="Route" />
                <RouteTimeline
                    pickup={pickup}
                    delivery={delivery}
                    statusColor={statusColor}
                />

                <SectionHeader label="Shipment Details" />
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                    <View style={styles.infoGrid}>
                        <InfoTile label="Equipment" value={shipment.truck_number} />
                        <InfoTile
                            label="Distance"
                            value={
                                pickup && delivery
                                    ? "—"
                                    : "—"
                            }
                        />
                    </View>
                    <View style={[styles.infoGrid, { marginTop: 10 }]}>
                        <InfoTile label="Shipment No" value={shipment.shipment_no} />
                        <InfoTile label="PRO Number" value={shipment.pro_number} />
                    </View>
                    {shipment.trailer_number ? (
                        <View style={[styles.infoGrid, { marginTop: 10 }]}>
                            <InfoTile label="Trailer #" value={shipment.trailer_number} />
                            <InfoTile label="Tracking" value={shipment.tracking_number} />
                        </View>
                    ) : null}
                </View>

                <SectionHeader label="Carrier" />
                <CarrierDetails shipment={shipment} />

                {(shipment.truck_number || shipment.driver_phone_1) && (
                    <>
                        <SectionHeader label="Equipment" />
                        <TruckDetails shipment={shipment} />
                    </>
                )}

                {shipment.stops.length > 0 && (
                    <>
                        <SectionHeader label="Stops" />
                        <StopsList stops={shipment.stops} />
                    </>
                )}

                <View
                    style={[
                        styles.statusFooter,
                        { backgroundColor: theme.card },
                    ]}>
                    <AppText variant="caption" style={{ color: theme.secondaryText }}>
                        STATUS:{" "}
                        <AppText variant="caption" style={{ color: statusColor, fontWeight: "700" }}>
                            {shipment.status.toUpperCase()}
                        </AppText>
                    </AppText>
                    <AppText variant="caption" style={{ color: theme.secondaryText }}>
                        0/{shipment.stops.length} STOPS
                    </AppText>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    screen: { flex: 1 },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },

    content: {
        paddingHorizontal: 20,
        paddingVertical:20,
        paddingBottom: 48,
        gap: 0,
    },

    heroRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        marginTop: 4,
    },

    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },

    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },

    scheduledBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },

    section: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },

    infoGrid: {
        flexDirection: "row",
        gap: 10,
    },

    infoTile: {
        flex: 1,
        borderRadius: 10,
        padding: 10,
    },

    infoTileLabel: {
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },

    routeRow: {
        flexDirection: "row",
        gap: 14,
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
        minHeight: 40,
    },

    dotFilled: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },

    routeTextCol: {
        flex: 1,
        gap: 24,
    },

    routeStop: {
        gap: 3,
    },

    readyBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
    },

    readyDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },

    stopRow: {
        flexDirection: "row",
        gap: 12,
    },

    stopTimeline: {
        alignItems: "center",
        width: 22,
    },

    stopDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: "center",
        alignItems: "center",
    },

    stopLine: {
        width: 2,
        flex: 1,
        minHeight: 16,
        marginVertical: 3,
    },

    stopInfo: {
        flex: 1,
        paddingBottom: 4,
    },

    stopHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    stopTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },

    statusFooter: {
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
});
