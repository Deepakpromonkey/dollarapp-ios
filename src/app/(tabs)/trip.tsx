import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import LoadDrawer from "@/components/LoadDrawer";
import LoadHeader from "@/components/LoadHeader";
import LocationAlertBanner from "@/components/LocationAlertBanner";
import TripMapView from "@/components/TripMapView";
import ActivateLoadCard from "@/components/tripsteps/ActivateLoadCard";
import ArrivedShipperStep from "@/components/tripsteps/ArrivedShipperStep";
import CurrentStopCard from "@/components/tripsteps/CurrentStopCard";
import StepTimeline from "@/components/tripsteps/StepTimeline";
import StopActionCard from "@/components/tripsteps/StopActionCard";
import TripCard from "@/components/tripsteps/TripCard";
import TripCompletedCard from "@/components/tripsteps/TripCompletedCard";
import { TripStep } from "@/components/tripsteps/types";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useJourney } from "@/hooks/useJourney";
import { useLocationHealth } from "@/hooks/useLocationHealth";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { useShipments } from "@/hooks/useShipments";
import { useStopProgress, type StopProgress } from "@/hooks/useStopProgress";
import { invalidate, onInvalidate } from "@/lib/invalidate";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import {
  ensureTrackingRunning,
  startLocationTracking,
  stopLocationTracking,
} from "@/utils/LocationTracker";
import { startArrivalAlerts, stopArrivalAlerts } from "@/utils/arrivalAlerts";
import { type Coord, haversineMeters, stopCoord } from "@/utils/geo";
import { destinationStop, orderedStops, originStop, stopAppointment } from "@/utils/stops";
import { parseInstant } from "@/utils/tripEta";
import { tripBadge } from "@/utils/tripStatus";
import type { Shipment } from "@/types/shipment";

import * as ExpoLocation from "expo-location";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

/*
| Where the timeline stands according to /progress, mapped the way the server
| maps stops onto current_step (StopJourneyService::syncJourney). /progress is
| updated the moment a stop action succeeds; the journey is a separate request
| that lands later, long enough on a slow connection to show "Trip Completed!"
| over a timeline still on "Delivered at Receiver".
*/
function progressStepIndex(stops: StopProgress[], complete: boolean): number {
  if (complete) return STEPS_CONFIG.length;

  const ordered = orderedStops(stops);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return 0;

  if (last.otp_verified_at) return 4;
  if (last.arrived_at) return 3;
  if (first.completed_at) return 2;
  if (first.arrived_at) return 1;
  return 0;
}

/** A finished load held on My Trip, and the loads that were already under way then. */
interface FinishedLoad {
  load: Shipment;
  startedBefore: string[];
}

/** What a load is called on screen: its shipment number, else its PRO number. */
const loadLabel = (load: Shipment): string | null => load.shipment_no || load.pro_number || null;

const startedUuids = (loads: Shipment[]): string[] =>
  loads.filter((s) => s.is_activated).map((s) => s.uuid);

/** The upcoming load with the earliest pickup; list order where a pickup has no usable time. */
function nextAssigned(loads: Shipment[]): Shipment | null {
  let next: Shipment | null = null;
  let nextAt = Infinity;
  for (const load of loads) {
    const pickup = stopAppointment(originStop(orderedStops(load.stops)));
    const at =
      pickup.at?.getTime() ??
      (pickup.date ? Date.parse(`${pickup.date}T${pickup.time || "00:00"}`) : NaN);
    const key = Number.isFinite(at) ? at : Infinity;
    if (next === null || key < nextAt) {
      next = load;
      nextAt = key;
    }
  }
  return next;
}

/** Same radius the API and the arrival alerts use. */
const ARRIVAL_RADIUS_METERS = 500;

/* Room around the route in the full-screen map, for its close button and notice. */
const FULLSCREEN_FIT_PADDING = { top: 110, right: 60, bottom: 90, left: 60 };

/* The least LoadHeader's bar can be: a 42 button with 12 above and below. */
const HEADER_BAR_MIN_HEIGHT = 66;

export default function TripScreen() {
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const sheetScrollRef = useRef<BottomSheetScrollViewMethods>(null);

  const snapPoints = useMemo(() => ["30%", "40%", "92%"], []);

  /*
  | The sheet stays below the header, never under it. The header is drawn on
  | top of it (zIndex 10), and the sheet used to add a snap point of its own,
  | sized to its content, which on any real load reached the top of the
  | screen: the top of the sheet and its handle then sat hidden under the
  | header. It now snaps only to the points above, as shares of the space
  | below the header. The header is measured rather than assumed, since its
  | bar belongs to LoadHeader, but never taken as less than it can be: that
  | covers the first frame, and a layout pass made before the status bar
  | padding is in.
  */
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    // Rounded up: part of a point under the header is still under it.
    const height = Math.ceil(event.nativeEvent.layout.height);
    setHeaderHeight((prev) => (prev === height ? prev : height));
  }, []);
  const sheetTopInset = Math.max(headerHeight, Math.ceil(insets.top + HEADER_BAR_MIN_HEIGHT));

  const {
    active,
    upcoming,
    past,
    loading: shipmentsLoading,
    refreshing: shipmentsRefreshing,
    error: shipmentsError,
    refresh: refreshShipments,
  } = useShipments();

  /*
  | The load the driver actually started comes first. A load can also be
  | Active only because today falls inside its dates; the newest of those used
  | to win, with every action on it refused until it was activated.
  */
  /*
  | A load just finished stays on screen until the driver taps Done. The server
  | moves a delivered load to Past at once, and the list refresh that follows
  | swapped this screen for "No active load" a moment after the last stop,
  | before the driver had seen that the trip was complete. Starting another
  | load still takes over straight away. A load the driver dismissed stays off
  | the screen even while the list still calls it active.
  */
  const [finished, setFinished] = useState<FinishedLoad | null>(null);
  const [dismissedUuid, setDismissedUuid] = useState<string | null>(null);
  /*
  | The started load last on screen, to catch it finishing when the list says
  | so first, with the other loads under way at that moment: a load started
  | after it finished must take over, not hide behind its result.
  */
  const [lastShown, setLastShown] = useState<FinishedLoad | null>(null);

  const listed = dismissedUuid ? active.filter((s) => s.uuid !== dismissedUuid) : active;
  const started = listed.find((s) => s.is_activated) ?? null;

  /*
  | The load on screen left the Active list and is now in Past: it was
  | delivered, but the list said so before /progress or /journey did (the
  | last upload timed out after the server saved it, or the load was finished
  | on another phone). Held like a load finished here, so the result is
  | still shown rather than "No active load".
  */
  const shownLoad = lastShown?.load ?? null;
  const deliveredElsewhere =
    !finished &&
    shownLoad &&
    shownLoad.uuid !== dismissedUuid &&
    !listed.some((s) => s.uuid === shownLoad.uuid)
      ? past.find((s) => s.uuid === shownLoad.uuid && s.is_activated) ?? null
      : null;
  const pinned: FinishedLoad | null =
    finished ??
    (deliveredElsewhere && lastShown
      ? { load: deliveredElsewhere, startedBefore: lastShown.startedBefore }
      : null);

  // A load started after this one finished takes over; one already under way (two
  // started at once, from before one-at-a-time) does not.
  const keepPinned =
    pinned !== null &&
    (started === null ||
      started.uuid === pinned.load.uuid ||
      pinned.startedBefore.includes(started.uuid));
  /*
  | With nothing running, the load assigned next is shown too, not "No active
  | load": its location is reported from now on, activated or not, so the
  | broker sees the truck heading to the shipper, and the driver is offered
  | Activate.
  */
  const shipment = keepPinned
    ? listed.find((s) => s.uuid === pinned.load.uuid) ?? pinned.load
    : started ?? listed[0] ?? nextAssigned(upcoming) ?? null;

  const {
    activeIndex,
    currentStep: journeyStep,
    journey,
    equipmentVerified: serverEquipmentVerified,
    loading: journeyLoading,
    refresh: refreshJourney,
  } = useJourney(shipment?.uuid);

  const {
    stops: progressStops,
    currentStop,
    isActivated: progressActivated,
    isComplete: progressComplete,
    loading: progressLoading,
    refresh: refreshProgress,
    apply: applyProgress,
  } = useStopProgress(shipment?.uuid);

  const equipmentVerified =
    serverEquipmentVerified ||
    !!journey?.shipper_arrived_at ||
    isEquipmentVerifiedLocally(shipment?.uuid);

  // Per load, so a step taken on one load is never shown on the next.
  const [localStep, setLocalStep] = useState<{ uuid: string; index: number } | null>(null);
  const progressIndex = progressStepIndex(progressStops, progressComplete);
  const currentIndex = Math.max(
    activeIndex,
    progressIndex,
    localStep && localStep.uuid === shipment?.uuid ? localStep.index : 0,
  );

  const stops = useMemo(() => orderedStops(shipment?.stops), [shipment?.stops]);
  const pickupStop = originStop(stops);
  const deliveryStop = destinationStop(stops);

  // Either source may notice first; both come from the same per-stop records.
  const isJourneyCompleted = activeIndex >= 5 || progressComplete;
  const isActivated = !!shipment?.is_activated || progressActivated;

  const badge = tripBadge({
    isActivated,
    progress: progressStops,
    journeyStep,
    complete: isJourneyCompleted,
  });

  // ------------------------------------------------------------------
  // 0. FRESH DATA (focus, return to the app, Refresh, completion)
  // ------------------------------------------------------------------
  const refreshAll = useCallback(() => {
    refreshShipments();
    refreshJourney();
    refreshProgress();
  }, [refreshShipments, refreshJourney, refreshProgress]);

  useRefreshOnFocusAndForeground(refreshAll);

  /*
  | The driver's own refresh: the Refresh buttons, and pulling down on the
  | no-load screen. The bottom sheet has no pull-to-refresh on purpose. With
  | one, the sheet ignores every swipe on its content while fully open
  | (@gorhom/bottom-sheet leaves those to the refresh control), so a driver
  | who opened it to work a stop could not swipe it back down over the map.
  */
  const [refreshingNow, setRefreshingNow] = useState(false);
  const refreshNow = useCallback(async () => {
    setRefreshingNow(true);
    try {
      await Promise.all([refreshShipments(), refreshJourney(), refreshProgress()]);
    } finally {
      setRefreshingNow(false);
    }
  }, [refreshShipments, refreshJourney, refreshProgress]);

  /*
  | The finished-load bookkeeping below is worked out while rendering, not in
  | effects. Each update is guarded by the state it sets, so a render applies
  | it at most once and the screen settles in the same pass.
  */
  const shipmentUuid = shipment?.uuid ?? null;

  /*
  | A delivered load leaves the Active list on the server. Asking for the list
  | again is what brings the driver's next load onto this screen (and moves
  | this one to Past on the Loads tab) without a restart.
  */
  const [completedUuid, setCompletedUuid] = useState<string | null>(null);
  const [lastDelivered, setLastDelivered] = useState<string | null>(null);

  if (shipment && isJourneyCompleted && completedUuid !== shipment.uuid) {
    setCompletedUuid(shipment.uuid);
    setLastDelivered(loadLabel(shipment));
    // The other loads already under way are read now, before the list refresh lands.
    setFinished((prev) =>
      prev && prev.load.uuid === shipment.uuid
        ? prev
        : {
            load: shipment,
            startedBefore: startedUuids(active).filter((uuid) => uuid !== shipment.uuid),
          },
    );
  }

  useEffect(() => {
    if (!completedUuid) return;
    invalidate("shipments");
    /*
    | Open the sheet on the result. The driver finished from the bottom of the
    | sheet, under the stop fields that are now gone, and the card is at the
    | top: scrolled first, without animation, since the sheet only lets its
    | content scroll once it is fully open.
    */
    setTimeout(() => {
      sheetScrollRef.current?.scrollTo({ y: 0, animated: false });
      bottomSheetRef.current?.snapToIndex(2);
    }, 300);
    // Once more after the sheet has opened: a drag started on a half-open sheet
    // can pin the content's position until the sheet is fully open.
    setTimeout(() => sheetScrollRef.current?.scrollTo({ y: 0, animated: true }), 900);
  }, [completedUuid]);

  // Remember the started load on screen, to notice it finishing elsewhere.
  if (shipment && isActivated && !isJourneyCompleted && shipment.uuid !== lastShown?.load.uuid) {
    setLastShown({
      load: shipment,
      startedBefore: startedUuids(active).filter((uuid) => uuid !== shipment.uuid),
    });
  }

  // Held from the list alone: keep holding it once the list moves on.
  if (deliveredElsewhere && lastShown && !finished) {
    setFinished({ load: deliveredElsewhere, startedBefore: lastShown.startedBefore });
  }

  // A load started after the finished one (from the Loads tab, say) replaces it.
  if (
    finished &&
    started &&
    started.uuid !== finished.load.uuid &&
    !finished.startedBefore.includes(started.uuid)
  ) {
    setFinished(null);
  }

  const finishTrip = useCallback(() => {
    if (!shipmentUuid) return;
    setDismissedUuid(shipmentUuid);
    setFinished(null);
    invalidate("shipments");
  }, [shipmentUuid]);

  // ------------------------------------------------------------------
  // 1. LOCATION HEALTH (the tracker asks; this screen never does)
  // ------------------------------------------------------------------
  /*
  | The load whose location is reported: the one on screen until it is done.
  | Behind a finished trip's card, which stays until Done, a load already
  | under way keeps reporting; it only comes on screen after Done.
  */
  const trackedLoad: Shipment | null =
    shipment && !isJourneyCompleted
      ? shipment
      : started && started.uuid !== shipment?.uuid
        ? started
        : null;
  const trackedUuid = trackedLoad?.uuid ?? null;

  /** Watches for location being switched off or the permission being taken away. */
  const locationHealth = useLocationHealth(trackedUuid);
  const health = locationHealth.snapshot;
  const canSeePosition = !!health?.servicesEnabled && !!health?.foregroundGranted;
  const canTrackInBackground = !!health?.foregroundGranted && !!health?.backgroundGranted;

  /*
  | No explanation screen before the system prompt, and nothing that asks
  | again after a refusal (App Review 5.1.1(iv)). The tracker requests location
  | in context when it starts for a load; after that the banner says what is
  | wrong, and its button acts only when the driver taps it. Tracking waits for
  | the first health reading, so it starts once, with the permission known.
  */
  const healthKnown = !!health;
  const bannerVisible = !!trackedUuid && locationHealth.degraded;

  // ------------------------------------------------------------------
  // 2. THE DRIVER'S POSITION (map dot, ETA, 500 m gate)
  // ------------------------------------------------------------------
  const [userLocation, setUserLocation] = useState<Coord | null>(null);

  /*
  | Keyed on the permission rather than run once on mount, so it starts the
  | moment access is granted, including in Settings, without a restart. Only
  | while this tab is showing: nothing else on screen uses it. It never asks.
  */
  const watchPosition = canSeePosition && isFocused;

  useEffect(() => {
    if (!watchPosition) return;

    let sub: ExpoLocation.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        // A recent fix the phone already holds, so the ETA does not wait for the first update.
        const last = await ExpoLocation.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
        if (cancelled) return;
        if (last) {
          setUserLocation({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          });
        }

        const watch = await ExpoLocation.watchPositionAsync(
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

        /*
        | Two awaits stand between the start and this line, so the screen can
        | have moved on by now. Cleanup ran against a still-null `sub`, and the
        | watcher it never saw would keep firing for the life of the process.
        */
        if (cancelled) {
          watch.remove();
          return;
        }

        sub = watch;
      } catch (err) {
        // Throws when location is off entirely; the banner is what tells the driver.
        console.warn("[TripScreen] Could not watch position:", err);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [watchPosition]);

  // A position from before access was lost would only make the ETA lie.
  const visibleLocation = canSeePosition ? userLocation : null;

  const originCoord = stopCoord(pickupStop);
  const distToOrigin =
    originCoord && visibleLocation ? haversineMeters(visibleLocation, originCoord) : Infinity;
  const canArriveAtShipper = !visibleLocation || distToOrigin <= ARRIVAL_RADIUS_METERS;

  // ------------------------------------------------------------------
  // 3. STANDARD TRACKING TRIGGER (load, permission)
  // ------------------------------------------------------------------
  /*
  | undefined until the first run, so a tracker left running by an earlier
  | session is stopped even when there is no load now. Set to the load only
  | once startLocationTracking reports success: it used to be set before, so a
  | start refused for want of permission was never tried again.
  */
  const trackingLockRef = useRef<string | null | undefined>(undefined);
  /*
  | The last start tried, per load, permission and rate. A refused start is
  | not repeated until one of those changes, so a driver who kept "While
  | Using" is not re-sent the permission flare on every refresh.
  */
  const trackingAttemptRef = useRef<string | null>(null);

  /*
  | The broker's reporting rate rides on the load. Handed to the tracker from
  | the start: left to find it in the first ping's answer, tracking began at the
  | 5-minute default, and a load the server expects every 60 s was reported
  | "GPS signal lost" while the tracker did exactly as it was told.
  */
  const rawInterval = Number(trackedLoad?.tracking_interval_seconds);
  const trackingInterval =
    Number.isFinite(rawInterval) && rawInterval > 0 ? Math.round(rawInterval) : undefined;

  /*
  | Keyed on the background permission as well as the load and rate, so
  | granting "Always" later (in Settings, or from the banner) starts tracking
  | straight away, and a broker changing the rate mid-load is picked up.
  */
  const trackingKey = trackedUuid
    ? `${trackedUuid}|${canTrackInBackground ? "always" : "limited"}|${trackingInterval ?? "default"}`
    : null;

  useEffect(() => {
    if (shipmentsLoading || journeyLoading) return;

    if (!trackingKey || !trackedUuid) {
      trackingAttemptRef.current = null;

      /*
      | No load because the list could not be fetched is not "no load": a
      | network blip at app start must not end tracking for the rest of the
      | drive, with nothing to restart it until the next good refresh.
      */
      if (!shipmentUuid && shipmentsError) return;

      if (trackingLockRef.current !== null) {
        trackingLockRef.current = null;
        stopLocationTracking().catch((err) =>
          console.warn("[TripScreen] Could not stop tracking:", err),
        );
      }
      return;
    }

    if (!healthKnown) return;
    if (trackingAttemptRef.current === trackingKey) return;
    trackingAttemptRef.current = trackingKey;

    const uuid = trackedUuid;
    startLocationTracking(uuid, trackingInterval)
      .then((started) => {
        if (started) trackingLockRef.current = uuid;
      })
      .catch((err) => console.warn("[TripScreen] Could not start tracking:", err));
  }, [
    trackingKey,
    trackedUuid,
    shipmentUuid,
    shipmentsLoading,
    journeyLoading,
    shipmentsError,
    healthKnown,
    trackingInterval,
  ]);

  // ------------------------------------------------------------------
  // 3b. ARRIVAL ALERTS (geofences around this load's stops)
  // ------------------------------------------------------------------
  /*
   * Kept off the tracker's start and stop on purpose: tracking is for the
   * broker, these are for the driver, and a load whose stops have no
   * coordinates must lose the alerts without losing the tracking. Keyed on the
   * stops' coordinates as well as the load, so a stop whose coordinates are
   * filled in mid-load gets its fence on the next refresh.
   */
  const arrivalFenceKey = trackedLoad
    ? `${trackedLoad.uuid}|${(trackedLoad.stops ?? [])
        .map((s) => `${s.id}:${s.latitude},${s.longitude}`)
        .join(";")}`
    : null;

  // undefined until the first run, so a stale fence left by an earlier session
  // is cleared even when there is no load now.
  const arrivalLockRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (shipmentsLoading || journeyLoading) return;

    // As for tracking: a list that failed to load says nothing about the fences.
    if (!shipmentUuid && shipmentsError) return;

    /*
     * Only when the load or its stops change (the key, not every new copy of
     * the load the list hands over). A journey refresh happens on every focus
     * and every step, and is no reason to re-register; returning to the app
     * (below) is what re-registers after the OS drops the fences.
     */
    if (arrivalLockRef.current === arrivalFenceKey) return;
    arrivalLockRef.current = arrivalFenceKey;

    if (arrivalFenceKey && trackedLoad) {
      startArrivalAlerts(trackedLoad.uuid, trackedLoad.stops ?? []).catch((err) =>
        console.warn("[TripScreen] Could not start arrival alerts:", err),
      );
    } else {
      stopArrivalAlerts().catch((err) =>
        console.warn("[TripScreen] Could not stop arrival alerts:", err),
      );
    }
  }, [arrivalFenceKey, trackedLoad, shipmentUuid, shipmentsLoading, journeyLoading, shipmentsError]);

  // ------------------------------------------------------------------
  // 4. THE SILENT RESTARTER (runs on every return to the app)
  // ------------------------------------------------------------------
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const returningToForeground =
        !!appState.current.match(/inactive|background/) && nextAppState === "active";

      /*
      | Recorded before anything else. The old handler was async and returned
      | early while loading, so this assignment was skipped and the ref kept
      | saying "background": no later return to the app was recognised as one.
      */
      appState.current = nextAppState;

      if (!returningToForeground) return;
      // Only the tracking work waits for loading; the ref above is always kept current.
      if (shipmentsLoading || journeyLoading) return;
      if (!trackedLoad) return;

      const uuid = trackedLoad.uuid;
      const loadStops = trackedLoad.stops ?? [];

      (async () => {
        /*
         * Re-register the stop geofences on every return to the app, once
         * "Always" is allowed: the OS can drop them, and this is also the
         * first chance to start them after the driver allows "Always" in
         * Settings.
         */
        const background = await ExpoLocation.getBackgroundPermissionsAsync().catch(() => null);
        if (background?.status === ExpoLocation.PermissionStatus.GRANTED) {
          startArrivalAlerts(uuid, loadStops).catch((err) =>
            console.warn("[TripScreen] Could not resume arrival alerts:", err),
          );
        }

        /*
        | The process may have been killed while backgrounded, leaving the load
        | with no task behind it. Permission and location-services problems are
        | not handled here: the health banner shows them and offers the fix.
        */
        if (await ensureTrackingRunning(uuid, trackingInterval)) trackingLockRef.current = uuid;
      })().catch((err) => console.warn("[TripScreen] Could not resume tracking:", err));
    });

    return () => {
      subscription.remove();
    };
    // Re-subscribed with each new copy of the load, so a return to the app never
    // re-registers stale coordinates.
  }, [trackedLoad, trackingInterval, shipmentsLoading, journeyLoading]);

  // Signed out: nothing of this driver's may keep running for whoever signs in next.
  useEffect(
    () =>
      onInvalidate("session", () => {
        trackingAttemptRef.current = null;
        trackingLockRef.current = null;
        arrivalLockRef.current = undefined;
        // Nothing of the previous driver's last trip carries over to the next one.
        setCompletedUuid(null);
        setFinished(null);
        setDismissedUuid(null);
        setLastShown(null);
        setLastDelivered(null);
        stopLocationTracking().catch((err) =>
          console.warn("[TripScreen] Could not stop tracking on sign-out:", err),
        );
      }),
    [],
  );

  // ------------------------------------------------------------------
  // 5. JOURNEY UI
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

  const advance = () => {
    if (!shipment) return;
    setLocalStep({
      uuid: shipment.uuid,
      index: Math.min(currentIndex + 1, STEPS_CONFIG.length - 1),
    });
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(2);
    }, 300);
  };

  /*
  | The stop the driver is heading to, from /progress. While progress is
  | loading (or failed) the card falls back to the destination; once every
  | stop is done it shows the last one as delivered.
  */
  const progressOrdered = useMemo(() => orderedStops(progressStops), [progressStops]);
  const focusProgress =
    currentStop ??
    (progressComplete ? progressOrdered[progressOrdered.length - 1] ?? null : null);
  const focusStop = focusProgress
    ? stops.find((s) => s.id === focusProgress.stop_id) ?? null
    : progressOrdered.length === 0
      ? deliveryStop ?? null
      : null;
  const focusPosition = focusStop
    ? stops.indexOf(focusStop) + 1
    : focusProgress
      ? progressOrdered.indexOf(focusProgress) + 1
      : undefined;

  const inlineFitPadding = useMemo(
    () => ({
      // Under the header and banner on top, the bottom sheet's middle snap below.
      top: bannerVisible ? 300 : 170,
      right: 50,
      bottom: windowHeight * 0.42,
      left: 50,
    }),
    [bannerVisible, windowHeight],
  );

  const mapNotice = !health
    ? null
    : !health.servicesEnabled
      ? "Location is off, so your position isn't on the map."
      : !health.foregroundGranted
        ? "Location access is off, so your position isn't on the map."
        : null;

  // Full-screen spinner only for the very first answer; refreshes keep the screen.
  if (shipmentsLoading && !shipment) {
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

  if (!shipment) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <SafeAreaView
          edges={["top"]}
          style={[styles.headerWrap, { backgroundColor: theme.card }]}
        >
          <StatusBar backgroundColor={theme.card} barStyle="dark-content" />
          <LoadHeader title="No Active Load" onMenuPress={() => setDrawerOpen(true)} />
        </SafeAreaView>

        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl
              refreshing={refreshingNow}
              onRefresh={refreshNow}
              colors={[theme.primaryButton]}
              tintColor={theme.primaryButton}
            />
          }
        >
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primaryButton + "18" }]}>
              <MaterialCommunityIcons
                name={shipmentsError ? "cloud-alert" : "truck-outline"}
                size={30}
                color={theme.primaryButton}
              />
            </View>

            <AppText variant="title" style={[styles.emptyTitle, { color: theme.text }]}>
              No active load
            </AppText>

            <AppText variant="caption" style={[styles.emptyBody, { color: theme.secondaryText }]}>
              {lastDelivered ? `Load ${lastDelivered} is delivered. ` : ""}
              When a load is active, it shows up here with your route and stops.
            </AppText>

            {shipmentsError ? (
              <AppText variant="caption" style={[styles.emptyBody, { color: theme.err }]}>
                {shipmentsError}
              </AppText>
            ) : null}

            <AppButton
              title="Refresh"
              onPress={refreshNow}
              loading={refreshingNow || shipmentsRefreshing}
              style={styles.emptyButton}
            />

            <Pressable
              onPress={() => router.navigate("/(tabs)/loads")}
              style={({ pressed }) => [
                styles.emptyLink,
                { borderColor: theme.primaryButton, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AppText variant="label" style={{ color: theme.primaryButton, fontWeight: "600" }}>
                Go to Loads
              </AppText>
            </Pressable>
          </View>
        </ScrollView>

        <LoadDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[styles.headerWrap, { backgroundColor: theme.card }]}
        onLayout={onHeaderLayout}
      >
        <StatusBar backgroundColor={theme.card} barStyle="dark-content" />
        <LoadHeader
          title={loadLabel(shipment) ?? "Active Load"}
          live={isActivated && !isJourneyCompleted}
          onMenuPress={() => setDrawerOpen(true)}
        />
      </SafeAreaView>

      <View style={styles.mapContainer}>
        <TripMapView
          stops={shipment.stops}
          userLocation={visibleLocation}
          locationEnabled={canSeePosition}
          fitPadding={inlineFitPadding}
          style={StyleSheet.absoluteFill}
          fitToRoute
        />
      </View>

      {/* After the map so it draws on top; before the sheet so the sheet covers it. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <LocationAlertBanner
          visible={bannerVisible}
          blocking={locationHealth.blocking}
          title={locationHealth.title}
          body={locationHealth.body}
          actionLabel={locationHealth.actionLabel}
          onPressAction={locationHealth.resolve}
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
            stops={shipment.stops}
            userLocation={visibleLocation}
            locationEnabled={canSeePosition}
            notice={mapNotice}
            fitPadding={FULLSCREEN_FIT_PADDING}
            style={StyleSheet.absoluteFill}
            fitToRoute
          />
          {/* Below the status bar and the notch, which the full-screen map runs under. */}
          <Pressable
            style={[styles.screenBtn1, { top: insets.top + 8, backgroundColor: theme.card }]}
            onPress={() => setMapFullscreen(false)}
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>
      </Modal>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        topInset={sheetTopInset}
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
          ref={sheetScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
        >
          <TripCard
            origin={pickupStop}
            destination={deliveryStop}
            stopCount={stops.length}
            badge={badge}
            shipment={shipment}
          />
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
              {isJourneyCompleted ? (
                <TripCompletedCard
                  loadName={loadLabel(shipment)}
                  deliveredAt={parseInstant(progressOrdered[progressOrdered.length - 1]?.completed_at)}
                  onDone={finishTrip}
                />
              ) : null}
              <CurrentStopCard
                stop={focusStop}
                progress={focusProgress}
                position={focusPosition}
                total={stops.length}
                delivered={isJourneyCompleted}
                userLocation={visibleLocation}
              />
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

                  <Pressable
                    onPress={refreshNow}
                    disabled={refreshingNow}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh this load"
                    accessibilityState={{ busy: refreshingNow }}
                    style={({ pressed }) => [
                      styles.refreshButton,
                      {
                        backgroundColor: theme.primaryButton + "18",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    {refreshingNow ? (
                      <ActivityIndicator size={16} color={theme.primaryButton} />
                    ) : (
                      <MaterialCommunityIcons
                        name="refresh"
                        size={16}
                        color={theme.primaryButton}
                      />
                    )}
                    <AppText
                      variant="caption"
                      style={{ color: theme.primaryButton, fontWeight: "600" }}
                    >
                      Refresh
                    </AppText>
                  </Pressable>
                </View>
              </View>
              <StepTimeline steps={steps} activeIndex={currentIndex} />

              {isJourneyCompleted ? null : !journeyStep && journeyLoading ? (
                // Until this load's journey answers, "verified" is unknown; don't flash the verify button.
                <ActivityIndicator color={theme.primaryButton} style={styles.actionsLoading} />
              ) : !isActivated ? (
                <ActivateLoadCard
                  shipment={shipment}
                  // A list from before the Done tap still names the load just delivered.
                  blockedBy={
                    shipment.activation_blocked_by?.uuid === dismissedUuid
                      ? null
                      : shipment.activation_blocked_by ?? null
                  }
                />
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
                      shipmentUuid={shipment.uuid}
                    />
                  ) : (
                    <>
                      {progressLoading && progressStops.length === 0 && (
                        <ActivityIndicator color={theme.primaryButton} />
                      )}

                      {progressStops.map((s) => (
                        <StopActionCard
                          key={s.stop_id}
                          shipmentUuid={shipment.uuid}
                          stop={s}
                          equipmentVerified={equipmentVerified}
                          onAdvance={(next) => {
                            // The card also marks the journey stale, which refetches the rest.
                            if (next.length) applyProgress(next);
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
  // In the flow right under the header; the map behind it is absolutely positioned.
  overlay: {
    alignItems: "stretch",
  },
  screenBtn: {
    alignSelf: "flex-end",
    marginTop: 12,
    marginRight: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  screenBtn1: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenMap: { flex: 1 },
  sheetContent: { gap: 0 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  // Same pill as the stop card's Navigate button.
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
  },
  actionsLoading: { marginVertical: 16 },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
    paddingBottom: 120,
  },
  emptyCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  emptyLink: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
});
