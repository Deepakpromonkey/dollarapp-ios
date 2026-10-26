import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import SectionHeader from "@/components/SectionHeader";
import RetryNotice from "@/components/loads/RetryNotice";
import { appointmentLine } from "@/components/loads/ShipmentCard";
import StopEventsCard from "@/components/loads/StopEventsCard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { useShipments } from "@/hooks/useShipments";
import { ApiError } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { friendlyError, loadApi } from "@/lib/loadApi";
import type { Shipment, ShipmentStop } from "@/types/shipment";
import { estimatedRouteMiles, formatMiles } from "@/utils/geo";
import { markLoadNotificationsRead } from "@/utils/notificationRouting";
import {
    destinationStop,
    orderedStops,
    originStop,
    stopSubtitle,
    stopTitle,
} from "@/utils/stops";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
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

function InfoTile({
    label,
    value,
    caption,
}: {
    label: string;
    value: string | null | undefined;
    caption?: string;
}) {
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
            {caption ? (
                <AppText
                    variant="tiny"
                    style={{ color: theme.secondaryText, marginTop: 2 }}>
                    {caption}
                </AppText>
            ) : null}
        </View>
    );
}

type StopKind = "pickup" | "delivery" | "other";

function stopKind(stop: ShipmentStop): StopKind {
    const type = (stop.stop_type ?? "").trim().toLowerCase();
    return type === "pickup" || type === "delivery" ? type : "other";
}

/* Short place name for the chat header: the city when there is one. */
function placeName(stop?: ShipmentStop): string {
    return stop ? stop.city?.trim() || stopTitle(stop) : "";
}

/*
| Distance is worked out from the stops' coordinates (straight lines between
| them, stretched by a road factor), so it is labelled as an estimate. With a
| stop the broker never located there is nothing honest to show.
*/
function distanceTile(stops: ShipmentStop[]): { value: string; caption?: string } {
    if (stops.length < 2) return { value: "—" };

    const miles = estimatedRouteMiles(stops);
    return miles === null
        ? { value: "—", caption: "Stop location pending" }
        : { value: `≈ ${formatMiles(miles)}`, caption: "Estimated road distance" };
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
                        <RouteStopText stop={pickup} />
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
                        <RouteStopText stop={delivery} />
                    </View>
                </View>
            </View>
        </View>
    );
}

/* Name, the place it is in when the name does not say, and the appointment. */
function RouteStopText({ stop }: { stop?: ShipmentStop }) {
    const theme = useAppTheme();
    const subtitle = stopSubtitle(stop);
    const when = stop ? appointmentLine(stop) : "";

    return (
        <>
            <AppText
                variant="label"
                style={{ color: theme.text, fontWeight: "600" }}>
                {stopTitle(stop)}
            </AppText>
            {subtitle ? (
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}
                    numberOfLines={2}>
                    {subtitle}
                </AppText>
            ) : null}
            {when ? (
                <AppText variant="caption" style={{ color: theme.secondaryText }}>
                    {when}
                </AppText>
            ) : null}
        </>
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
                const kind = stopKind(stop);
                const dotColor =
                    kind === "pickup"
                        ? theme.primaryButton
                        : kind === "delivery"
                          ? "#EF4444"
                          : theme.secondaryText;
                const isLast = idx === stops.length - 1;
                const when = appointmentLine(stop);
                return (
                    <View key={stop.id} style={styles.stopRow}>
                        <View style={styles.stopTimeline}>
                            <View style={[styles.stopDot, { backgroundColor: dotColor }]}>
                                <MaterialCommunityIcons
                                    name={
                                        kind === "pickup"
                                            ? "package-up"
                                            : kind === "delivery"
                                              ? "package-down"
                                              : "map-marker"
                                    }
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
                                    {stopTitle(stop)}
                                </AppText>
                                <View
                                    style={[
                                        styles.stopTypeBadge,
                                        { backgroundColor: dotColor + "18" },
                                    ]}>
                                    <AppText
                                        variant="tiny"
                                        style={{ color: dotColor, fontWeight: "700" }}>
                                        {(stop.stop_type || "Stop").toUpperCase()}
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
                            {when ? (
                                <AppText
                                    variant="tiny"
                                    style={{ color: theme.secondaryText, marginTop: 3 }}>
                                    {when}
                                </AppText>
                            ) : null}
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
    const { active, upcoming, past, loading, error, refresh } = useShipments();
    const [activating, setActivating] = useState(false);
    const [pulling, setPulling] = useState(false);
    const [lookedUp, setLookedUp] = useState(false);

    const onPull = useCallback(async () => {
        setPulling(true);
        try {
            await refresh();
        } finally {
            setPulling(false);
        }
    }, [refresh]);

    // The list is keyed by id, but every journey endpoint is keyed by uuid, so
    // match on either — a link built from one should not dead-end on the other.
    const shipment = useMemo(
        () =>
            [...active, ...upcoming, ...past].find(
                (s) => String(s.id) === id || s.uuid === id,
            ),
        [active, upcoming, past, id],
    );

    /*
    | Seeing the load is what "New load assigned" asked for, so its inbox row
    | is done with. The broker's push carries no inbox uuid, and the sync files
    | the row up to a minute after it, so this runs on every return to the
    | screen as well as when it opens: a later look clears a row that landed
    | after the first one. By uuid, which the route may not carry (the profile
    | links by id), hence the load the store found.
    */
    const shipmentUuid = shipment?.uuid ?? null;

    useEffect(() => {
        void markLoadNotificationsRead("load_assigned", shipmentUuid);
    }, [shipmentUuid]);

    const refreshOnReturn = useCallback(() => {
        void refresh();
        void markLoadNotificationsRead("load_assigned", shipmentUuid);
    }, [refresh, shipmentUuid]);

    useRefreshOnFocusAndForeground(refreshOnReturn);

    /*
    | A link from a push or the notification list can name a load assigned
    | after the list was last fetched. Ask the server once more before telling
    | the driver it does not exist.
    */
    useEffect(() => {
        if (shipment || lookedUp) return;

        let current = true;
        refresh().finally(() => {
            if (current) setLookedUp(true);
        });
        return () => {
            current = false;
        };
    }, [shipment, lookedUp, refresh]);

    const statusColor = shipment
        ? getStatusColor(shipment.status, theme.primaryButton, theme.err)
        : theme.primaryButton;

    if (!shipment && (loading || !lookedUp)) {
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
                <ScrollView
                    contentContainerStyle={styles.centerScroll}
                    refreshControl={
                        <RefreshControl
                            refreshing={pulling}
                            onRefresh={onPull}
                            tintColor={theme.primaryButton}
                        />
                    }>
                    <MaterialCommunityIcons
                        name="truck-alert-outline"
                        size={48}
                        color={theme.secondaryText}
                    />
                    <AppText
                        variant="label"
                        style={{ color: theme.text, marginTop: 12, textAlign: "center" }}>
                        {error ? "Couldn't open this load" : "Load not found"}
                    </AppText>
                    <AppText
                        variant="caption"
                        style={{ color: theme.secondaryText, textAlign: "center" }}>
                        {error ?? "It may have been removed or given to another driver."}
                    </AppText>
                    <AppButton
                        title="Try again"
                        variant="secondary"
                        onPress={onPull}
                        loading={pulling}
                        style={styles.retryButton}
                    />
                </ScrollView>
            </SafeAreaView>
        );
    }

    const stops = orderedStops(shipment.stops);
    const pickup = originStop(stops);
    const delivery = destinationStop(stops);
    const distance = distanceTile(stops);
    const loadName = shipment.shipment_no || shipment.pro_number;

    const hasEvents = (stop?: ShipmentStop): stop is ShipmentStop =>
        (stop?.events?.length ?? 0) > 0;

    /**
     * Start the load. The API refuses a second activation, so a driver who
     * double-taps gets told it is already running rather than a silent no-op.
     */
    const activate = async () => {
        setActivating(true);
        try {
            await loadApi.activate(shipment.uuid);
            // My Trip, the Loads tab and this screen all show the load's state.
            invalidate("shipments", "trip");
            Alert.alert(
                "Load activated",
                "This load is now active. You can start your trip.",
                [{ text: "Go to trip", onPress: () => router.dismissTo("/(tabs)/trip") },
                 { text: "Stay here", style: "cancel" }],
            );
        } catch (err: unknown) {
            // Another load is under way (one at a time): say which, and offer the way to it.
            if (err instanceof ApiError && err.status === 409) {
                invalidate("shipments");
                Alert.alert("Finish your active load first", err.message, [
                    { text: "Not now", style: "cancel" },
                    { text: "Go to My Trip", onPress: () => router.dismissTo("/(tabs)/trip") },
                ]);
                return;
            }
            Alert.alert(
                "Could not activate",
                friendlyError(err, "Please try again."),
            );
        } finally {
            setActivating(false);
        }
    };

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title={loadName} />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={pulling}
                        onRefresh={onPull}
                        tintColor={theme.primaryButton}
                    />
                }>

                <View style={styles.heroRow}>
                    <AppText variant="h2" style={{ color: theme.text, fontWeight: "700" }}>
                        {loadName}
                    </AppText>
                    <View
                        style={[styles.statusBadge, { borderColor: statusColor + "55" }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <AppText variant="tiny" style={{ color: statusColor, fontWeight: "700" }}>
                            {shipment.status.toUpperCase()}
                        </AppText>
                    </View>
                </View>

                {error ? (
                    <RetryNotice
                        title="Couldn't update this load"
                        message={error}
                        onRetry={onPull}
                        busy={pulling}
                        style={styles.notice}
                    />
                ) : null}

                {/* Nothing else on this load can happen until it is started,
                    so the button sits above the detail rather than below it. */}
                {shipment.can_activate && (
                    <View style={[styles.activateCard, { backgroundColor: theme.card }]}>
                        <AppText
                            variant="label"
                            style={{ color: theme.text, fontWeight: "700" }}>
                            Ready to start?
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText, marginTop: 4, marginBottom: 14 }}>
                            Activating this load unlocks equipment verification and the trip steps.
                        </AppText>
                        <AppButton
                            title={activating ? "Activating..." : "Activate Load"}
                            onPress={activate}
                            loading={activating}
                        />
                    </View>
                )}

                {/* One load at a time: instead of an Activate button that would be refused, name the load in the way. */}
                {!shipment.can_activate && !shipment.is_activated && shipment.activation_blocked_by && (
                    <View style={[styles.activateCard, { backgroundColor: theme.card }]}>
                        <AppText
                            variant="label"
                            style={{ color: theme.text, fontWeight: "700" }}>
                            Finish your active load first
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText, marginTop: 4, marginBottom: 14 }}>
                            You are on {shipment.activation_blocked_by.shipment_no}. Complete it before
                            starting this load.
                        </AppText>
                        <AppButton
                            title="Go to My Trip"
                            onPress={() => router.dismissTo("/(tabs)/trip")}
                        />
                    </View>
                )}

                {/* A delivered load is still "activated" (it has a journey), but it is Past. */}
                {shipment.is_activated && shipment.status === "Past" && (
                    <View style={[styles.activateCard, { backgroundColor: theme.card }]}>
                        <View style={styles.activeRow}>
                            <MaterialCommunityIcons name="truck-check" size={18} color="#16A34A" />
                            <AppText
                                variant="label1"
                                style={{ color: theme.text, flex: 1 }}>
                                This load is delivered
                            </AppText>
                        </View>
                    </View>
                )}

                {shipment.is_activated && shipment.status !== "Past" && (
                    <View style={[styles.activateCard, { backgroundColor: theme.card }]}>
                        <View style={styles.activeRow}>
                            <MaterialCommunityIcons
                                name="check-decagram"
                                size={18}
                                color={theme.secondaryButton}
                            />
                            <AppText
                                variant="label1"
                                style={{ color: theme.text, flex: 1 }}>
                                This load is active
                            </AppText>
                        </View>
                        {/* dismissTo, not push: pushing the tabs from here stacks a
                            second copy of them over the first. */}
                        <AppButton
                            title="Open trip"
                            variant="secondary"
                            onPress={() => router.dismissTo("/(tabs)/trip")}
                            style={{ marginTop: 12 }}
                        />
                    </View>
                )}

                {/* Talking to dispatch about this load. The badge is the count
                    of broker messages the driver has not opened. */}
                <View style={[styles.activateCard, { backgroundColor: theme.card }]}>
                    <View style={styles.activeRow}>
                        <MaterialCommunityIcons
                            name="message-text-outline"
                            size={18}
                            color={theme.primaryButton}
                        />
                        <AppText variant="label1" style={{ color: theme.text, flex: 1 }}>
                            Message dispatch
                        </AppText>
                        {shipment.unread_messages > 0 && (
                            <View
                                style={[
                                    styles.badge,
                                    { backgroundColor: theme.err },
                                ]}>
                                <AppText variant="tiny" style={{ color: "#FFFFFF" }}>
                                    {shipment.unread_messages}
                                </AppText>
                            </View>
                        )}
                    </View>
                    <AppButton
                        title={
                            shipment.unread_messages > 0
                                ? `Open chat (${shipment.unread_messages} new)`
                                : "Open chat"
                        }
                        variant="secondary"
                        onPress={() =>
                            router.push({
                                pathname: "/chat",
                                params: {
                                    uuid: shipment.uuid,
                                    title: [
                                        loadName,
                                        pickup && delivery
                                            ? `${placeName(pickup)} → ${placeName(delivery)}`
                                            : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" · "),
                                },
                            })
                        }
                        style={{ marginTop: 12 }}
                    />
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
                        <InfoTile
                            label="Distance"
                            value={distance.value}
                            caption={distance.caption}
                        />
                        <InfoTile label="Stops" value={String(stops.length)} />
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

                {stops.length > 0 && (
                    <>
                        <SectionHeader label="Stops" />
                        <StopsList stops={stops} />
                    </>
                )}

                {/* The broker's questions. Only worth showing once the load is
                    running — before that there is nothing to answer them about,
                    and the API will not accept them anyway. */}
                {shipment.is_activated && hasEvents(pickup) && (
                    <>
                        <SectionHeader label="Pickup Questions" />
                        <StopEventsCard
                            shipmentUuid={shipment.uuid}
                            stopId={pickup.id}
                            title={`Pickup · ${stopTitle(pickup)}`}
                        />
                    </>
                )}

                {/* A one-stop load has the same stop at both ends: ask once. */}
                {shipment.is_activated && hasEvents(delivery) && delivery.id !== pickup?.id && (
                    <>
                        <SectionHeader label="Delivery Questions" />
                        <StopEventsCard
                            shipmentUuid={shipment.uuid}
                            stopId={delivery.id}
                            title={`Delivery · ${stopTitle(delivery)}`}
                        />
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
                        {stops.length} {stops.length === 1 ? "STOP" : "STOPS"}
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

    centerScroll: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        padding: 24,
    },

    retryButton: {
        marginTop: 12,
        alignSelf: "stretch",
    },

    notice: {
        marginBottom: 20,
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

    activateCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },

    activeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
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
