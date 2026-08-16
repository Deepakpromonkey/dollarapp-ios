import AppText from "@/components/AppText";
import LoadDrawer from "@/components/LoadDrawer";
import LoadHeader from "@/components/LoadHeader";
import TripMapView, { TripWaypoint } from "@/components/TripMapView";
import ArrivedReceiverStep from "@/components/tripsteps/ArrivedReceiverStep";
import ArrivedShipperStep from "@/components/tripsteps/ArrivedShipperStep";
import DeliveredReceiverStep from "@/components/tripsteps/DeliveredReceiverStep";
import DestinationArrivalStep from "@/components/tripsteps/DestinationArrivalStep";
import LoadedShipperStep from "@/components/tripsteps/LoadedShipperStep";
import StepTimeline from "@/components/tripsteps/StepTimeline";
import StopActionCard from "@/components/tripsteps/StopActionCard";
import TripCard from "@/components/tripsteps/TripCard";
import { TripStep, TripStepId } from "@/components/tripsteps/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useJourney } from "@/hooks/useJourney";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useShipments } from "@/hooks/useShipments";
import { useStopProgress } from "@/hooks/useStopProgress";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  startLocationTracking,
  stopLocationTracking,
} from "@/utils/LocationTracker";

import * as ExpoLocation from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  AppState,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isEquipmentVerifiedLocally } from "../trip/equipment-verification";

const STEPS_CONFIG: Omit<TripStep, "status">[] = [
  {
    id: "arrived_shipper",
    label: "Arrived at Shipper",
    sublabel: "Mark arrival at pickup location",
  },
  {
    id: "loaded_shipper",
    label: "Loaded at Shipper",
    sublabel: "Confirm cargo loading with OTP",
  },
  {
    id: "arrived_receiver",
    label: "Arrived at Receiver",
    sublabel: "Mark arrival at delivery location",
  },
  {
    id: "delivered_receiver",
    label: "Delivered at Receiver",
    sublabel: "Confirm delivery with OTP",
  },
  {
    id: "destination_arrival",
    label: "Destination Arrival",
    sublabel: "Trip completed",
  },
];

function getDistance(a: TripWaypoint, b: TripWaypoint): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function TripScreen() {
  const theme = useAppTheme();
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ["30%", "40%", "92%"], []);

  const { active, loading } = useShipments();
  const shipment = active[0] ?? null;

  const {
    activeIndex,
    journey,
    equipmentVerified: serverEquipmentVerified,
    loading: journeyLoading,
    refresh: refreshJourney,
  } = useJourney(shipment?.uuid);

  const {
    stops: progressStops,
    loading: progressLoading,
    refresh: refreshProgress,
    apply: applyProgress,
  } = useStopProgress(shipment?.uuid);

  const equipmentVerified =
    serverEquipmentVerified ||
    !!journey?.shipper_arrived_at ||
    isEquipmentVerifiedLocally(shipment?.uuid);

  const [localIndex, setLocalIndex] = useState<number | null>(null);
  const currentIndex =
    localIndex !== null ? Math.max(localIndex, activeIndex) : activeIndex;

  const pickupStop = shipment?.stops.find((s) => s.stop_type === "Pickup");
  const deliveryStop = shipment?.stops.find((s) => s.stop_type === "Delivery");

  const ORIGIN: TripWaypoint | undefined = pickupStop
    ? {
        latitude: parseFloat(pickupStop.latitude),
        longitude: parseFloat(pickupStop.longitude),
        title: `${pickupStop.city}, ${pickupStop.state}`,
      }
    : undefined;

  const DESTINATION: TripWaypoint | undefined = deliveryStop
    ? {
        latitude: parseFloat(deliveryStop.latitude),
        longitude: parseFloat(deliveryStop.longitude),
        title: `${deliveryStop.city}, ${deliveryStop.state}`,
      }
    : undefined;

  const ROUTE: TripWaypoint[] = (shipment?.stops ?? [])
    .slice()
    .sort((a, b) => a.stop_number - b.stop_number)
    .filter((s) => s.latitude && s.longitude)
    .map((s) => ({
      latitude: parseFloat(s.latitude),
      longitude: parseFloat(s.longitude),
      title: `${s.city ?? ""}, ${s.state ?? ""}`,
    }));

  const isJourneyCompleted = activeIndex >= 5;

  // ------------------------------------------------------------------
  // 1. STANDARD TRACKING TRIGGER (Runs on load changes)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (shipment && !isJourneyCompleted) {
      startLocationTracking(shipment.uuid);
    } else if (!shipment || isJourneyCompleted) {
      stopLocationTracking();
    }
  }, [shipment?.uuid, isJourneyCompleted]);

  // ------------------------------------------------------------------
  // 2. THE SILENT RESTARTER & PERMISSION ENFORCER (Runs on app open)
  // ------------------------------------------------------------------
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        
        // Only care if there is an active shipment and trip is not completed
        if (shipment?.uuid && !isJourneyCompleted) {
          const bgPerm = await ExpoLocation.getBackgroundPermissionsAsync();
          const isRunning = await ExpoLocation.hasStartedLocationUpdatesAsync("BACKGROUND_LOCATION_TASK").catch(() => false);

          if (bgPerm.status !== "granted") {
            // THE WALL: Driver changed permission in settings. Block them.
            Alert.alert(
              "Tracking Disabled",
              "You must set location to 'Always Allow' to continue driving this active load.",
              [
                { text: "Open Settings", onPress: () => Linking.openSettings() }
              ]
            );
          } else if (!isRunning) {
            // QUIET REBOOT: App was swiped up, but permissions are still good. Turn it back on silently.
            console.log("[TripScreen] 🤫 App restarted. Quietly rebooting tracker...");
            startLocationTracking(shipment.uuid);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [shipment?.uuid, isJourneyCompleted]);
  // ------------------------------------------------------------------

  const steps: TripStep[] = STEPS_CONFIG.map((s, i) => ({
    ...s,
    status: isJourneyCompleted
      ? "completed"
      : i < currentIndex
        ? "completed"
        : i === currentIndex
          ? "active"
          : "pending",
  }));

  const activeStepId: TripStepId =
    STEPS_CONFIG[Math.min(currentIndex, STEPS_CONFIG.length - 1)]?.id ??
    "destination_arrival";

  const advance = () => {
    const next = Math.min(currentIndex + 1, STEPS_CONFIG.length - 1);
    setLocalIndex(next);
    refreshJourney();
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(2);
    }, 300);
  };

  useFocusEffect(
    useCallback(() => {
      refreshJourney();
    }, [refreshJourney]),
  );

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    let sub: ExpoLocation.LocationSubscription | null = null;

    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== ExpoLocation.PermissionStatus.GRANTED) return;

      const initial = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });

      sub = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc: ExpoLocation.LocationObject) =>
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }),
      );
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  const distToOrigin =
    ORIGIN && userLocation ? getDistance(userLocation, ORIGIN) : Infinity;
  const distToDest =
    DESTINATION && userLocation
      ? getDistance(userLocation, DESTINATION)
      : Infinity;

  const canArriveAtShipper = !userLocation || distToOrigin <= 500;
  const canArriveAtReceiver = !userLocation || distToDest <= 500;

  if ((loading || journeyLoading) && !shipment) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primaryButton} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.headerWrap, { backgroundColor: theme.card }]}
      >
        <StatusBar backgroundColor={theme.card} barStyle="dark-content" />
        <LoadHeader
          title={shipment?.shipment_no ?? "No Active Load"}
          live={!!shipment}
          onMenuPress={() => setDrawerOpen(true)}
          onNotificationPress={() => {}}
        />
      </SafeAreaView>

      <View style={styles.mapContainer}>
        <TripMapView
          route={ROUTE}
          origin={ORIGIN}
          destination={DESTINATION}
          style={StyleSheet.absoluteFill}
          fitToRoute
        />

        <Pressable
          style={[styles.screenBtn, { backgroundColor: theme.card }]}
          onPress={() => setMapFullscreen(true)}
        >
          <MaterialCommunityIcons
            name="fullscreen"
            size={20}
            color={theme.text}
          />
        </Pressable>
      </View>

      <Modal
        visible={mapFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMapFullscreen(false)}
      >
        <StatusBar translucent backgroundColor="transparent" />
        <View style={styles.fullscreenMap}>
          <TripMapView
            route={ROUTE}
            origin={ORIGIN}
            destination={DESTINATION}
            style={StyleSheet.absoluteFill}
            fitToRoute
          />
          <Pressable
            style={[styles.screenBtn1, { backgroundColor: theme.card }]}
            onPress={() => setMapFullscreen(false)}
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
      </Modal>

      {shipment && (
        <BottomSheet
          ref={bottomSheetRef}
          index={1}
          snapPoints={snapPoints}
          enableContentPanningGesture
          enableHandlePanningGesture
          enablePanDownToClose={false}
          backgroundStyle={{
            backgroundColor: "transparent",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {ORIGIN && DESTINATION && (
              <TripCard origin={ORIGIN} destination={DESTINATION} />
            )}
            <View
              style={{
                backgroundColor: theme.background,
                paddingBottom: 120,
                marginTop: 20,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
            >
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 20,
                  margin: 16,
                  paddingBottom: 10,
                }}
              >
                <View
                  style={{
                    padding: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <AppText
                    variant="h3"
                    style={{
                      color: theme.text,
                    }}
                  >
                    {deliveryStop
                      ? `${deliveryStop.city}, ${deliveryStop.state}`
                      : "—"}
                  </AppText>
                  <AppText
                    variant="tiny"
                    style={{
                      color: theme.secondaryText,
                    }}
                  >
                    {deliveryStop?.stop_name ?? ""}
                  </AppText>
                </View>
                <View
                  style={{
                    flexDirection: "row",

                    justifyContent: "space-around",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText
                      variant="tiny"
                      style={{
                        color: theme.text,
                      }}
                    >
                      REMAINING
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{
                        color: theme.secondaryText,
                      }}
                    >
                      412 min.
                    </AppText>
                  </View>
                  <View
                    style={{
                      width: 1,
                      height: 40,
                      backgroundColor: theme.secondaryText,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText
                      variant="tiny"
                      style={{
                        color: theme.text,
                      }}
                    >
                      ARRIVAL ETA
                    </AppText>

                    <AppText
                      variant="caption"
                      style={{
                        color: theme.secondaryText,
                      }}
                    >
                      09:40 AM
                    </AppText>
                  </View>
                  <View
                    style={{
                      width: 1,
                      height: 40,
                      backgroundColor: theme.secondaryText,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor: "#4CAF50",
                      borderRadius: 20,
                      paddingHorizontal: 5,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="check-decagram-outline"
                      size={16}
                      color="#4CAF50"
                    />
                    <AppText
                      variant="tiny"
                      style={{
                        color: "#4CAF50",
                      }}
                    >
                      ON TIME
                    </AppText>
                  </View>
                </View>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionLabelRow}>
                    <AppText
                      variant="label"
                      style={{
                        color: theme.secondaryText,
                      }}
                    >
                      SHIPMENT JOURNEY
                    </AppText>
                  </View>
                </View>
                <StepTimeline steps={steps} activeIndex={currentIndex} />

                {isJourneyCompleted ? (
                  <View
                    style={{
                      margin: 16,
                      borderRadius: 16,
                      backgroundColor: "#F0FDF4",
                      borderWidth: 1.5,
                      borderColor: "#16A34A",
                      padding: 20,
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: "#16A34A",
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="check-bold"
                        size={32}
                        color="#fff"
                      />
                    </View>
                    <AppText
                      variant="h3"
                      style={{
                        color: "#15803D",
                        fontWeight: "800",
                        textAlign: "center",
                      }}
                    >
                      Trip Completed!
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{
                        color: "#166534",
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      All steps have been successfully completed. This load has
                      been delivered.
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 16,
                        marginTop: 4,
                        width: "100%",
                        justifyContent: "space-around",
                      }}
                    >
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={18}
                          color="#16A34A"
                        />
                        <AppText
                          variant="tiny"
                          style={{ color: "#15803D", fontWeight: "600" }}
                        >
                          Verified
                        </AppText>
                      </View>
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <MaterialCommunityIcons
                          name="file-document-check"
                          size={18}
                          color="#16A34A"
                        />
                        <AppText
                          variant="tiny"
                          style={{ color: "#15803D", fontWeight: "600" }}
                        >
                          POD Saved
                        </AppText>
                      </View>
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <MaterialCommunityIcons
                          name="truck-check"
                          size={18}
                          color="#16A34A"
                        />
                        <AppText
                          variant="tiny"
                          style={{ color: "#15803D", fontWeight: "600" }}
                        >
                          Delivered
                        </AppText>
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    {!equipmentVerified ? (
                      <ArrivedShipperStep
                        onArrive={advance}
                        distanceToOrigin={
                          distToOrigin === Infinity ? 0 : distToOrigin
                        }
                        canArrive={canArriveAtShipper}
                        equipmentVerified={equipmentVerified}
                        shipmentUuid={shipment?.uuid}
                      />
                    ) : (
                      <>
                        {progressLoading && progressStops.length === 0 && (
                          <ActivityIndicator color={theme.primaryButton} />
                        )}

                        {progressStops.map((s) => (
                          <StopActionCard
                            key={s.stop_id}
                            shipmentUuid={shipment!.uuid}
                            stop={s}
                            equipmentVerified={equipmentVerified}
                            onAdvance={(next) => {
                              if (next.length) applyProgress(next);
                              else refreshProgress();
                              refreshJourney();
                            }}
                            onRefresh={() => {
                              refreshProgress();
                              refreshJourney();
                            }}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheet>
      )}

      <LoadDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: {
    zIndex: 10,
  },
  mapContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  screenBtn: {
    position: "absolute",
    right: 20,
    top: 140,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  screenBtn1: {
    position: "absolute",
    right: 20,
    top: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenMap: { flex: 1 },
  sheetContent: { gap: 0 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2 },
  actionArea: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
});