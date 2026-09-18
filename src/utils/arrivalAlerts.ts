import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { presentLocalAlert } from "./localNotifications";
import {
  ARRIVAL_RADIUS_METERS,
  GEOFENCE_TASK_NAME,
  KEYS,
  MAX_GEOFENCE_REGIONS,
} from "./locationConfig";

/*
| Telling the driver they have arrived.
|
| A driver on a long haul cannot sit watching the trip screen, and until now
| the app only noticed an arrival while that screen was open and in front of
| them: the Arrive button unlocked inside 500m, and nothing said so unless the
| driver happened to be looking. In practice that meant pulling the phone out
| at every plausible moment to check, or rolling into a yard and only later
| realising the check-in had been sitting there waiting.
|
| The OS can do this properly. Geofences around each stop are monitored by the
| system, not by us, and the app is woken on a crossing whether it is open,
| backgrounded, or not running at all. The driver gets one notification as they
| reach the stop and can check in from it.
|
| This is deliberately separate from the position reporting in LocationTracker.
| That exists for the broker; this exists for the driver, and neither should
| start, stop, or fail because of the other.
*/

interface StopLabels {
  [stopId: string]: string;
}

/** Minimum shape needed to fence a stop; ShipmentStop satisfies it. */
export interface GeofenceableStop {
  id: number;
  stop_name: string;
  stop_type: string;
  latitude: string;
  longitude: string;
}

/*
| Every mutation runs through one chain.
|
| start is called from a screen effect and stop from its teardown, and a load
| changing fires both within a tick of each other. Interleaving them leaves the
| OS monitoring the previous load's stops, which is worse than monitoring none:
| the driver gets told they have arrived somewhere they are not going.
*/
let operationChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationChain.then(
    () => operation(),
    () => operation(),
  );
  operationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/* ------------------------------------------------------------------ */
/* Stop labels                                                         */
/* ------------------------------------------------------------------ */

async function readStopLabels(): Promise<StopLabels> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GEOFENCE_STOPS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // A corrupt map costs the driver the stop's name, not the notification.
    return {};
  }
}

async function readNotified(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GEOFENCE_NOTIFIED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Regions                                                             */
/* ------------------------------------------------------------------ */

/**
 * Turn stops into regions the OS can monitor, dropping any that cannot be
 * placed on the map.
 *
 * Coordinates arrive from the API as strings and are not always populated —
 * a stop entered without geocoding has empty ones. Number("") is 0, which is a
 * real position off the coast of Africa, so blank and unparseable values are
 * rejected explicitly rather than allowed to become a fence in the Atlantic.
 */
export function buildRegions(stops: GeofenceableStop[]): {
  regions: Location.LocationRegion[];
  labels: StopLabels;
} {
  const regions: Location.LocationRegion[] = [];
  const labels: StopLabels = {};

  for (const stop of stops) {
    if (regions.length >= MAX_GEOFENCE_REGIONS) break;

    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);

    const usable =
      stop.latitude?.trim() &&
      stop.longitude?.trim() &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180 &&
      !(latitude === 0 && longitude === 0);

    if (!usable) continue;

    const identifier = String(stop.id);

    regions.push({
      identifier,
      latitude,
      longitude,
      radius: ARRIVAL_RADIUS_METERS,
      notifyOnEnter: true,
      /*
      | Departures are the broker's concern and reach them through the position
      | pings. Waking the app for them here would double the notifications a
      | driver sees while manoeuvring around a yard boundary.
      */
      notifyOnExit: false,
    });

    labels[identifier] =
      stop.stop_name?.trim() || `${stop.stop_type || "Stop"} ${stop.id}`;
  }

  return { regions, labels };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/**
 * Monitor the stops on a load, replacing whatever was being monitored before.
 *
 * Safe to call repeatedly: registering the same load's stops twice is a no-op
 * from the driver's point of view, because an arrival is only announced once.
 */
export const startArrivalAlerts = async (
  shipmentUuid: string,
  stops: GeofenceableStop[],
): Promise<void> =>
  serialize(async () => {
    const { regions, labels } = buildRegions(stops);

    if (regions.length === 0) {
      // A load whose stops have no coordinates cannot be fenced. Position
      // reporting is unaffected, so this is a missing nicety, not a failure.
      await teardown();
      return;
    }

    /*
    | Geofencing needs the same Always authorisation the tracker does. Asking
    | here would put a second permission prompt in front of the driver for a
    | permission the tracker has already requested, so this only ever checks.
    */
    const { status } = await Location.getBackgroundPermissionsAsync().catch(() => ({
      status: Location.PermissionStatus.UNDETERMINED,
    }));

    if (status !== Location.PermissionStatus.GRANTED) {
      console.log("[DollarTraq Arrivals] No background permission; not monitoring.");
      await teardown();
      return;
    }

    /*
    | Forget previous announcements only when the load itself has changed.
    | Restarting the app mid-load must not re-announce a stop the driver has
    | already been told about and checked into.
    |
    | Placed after the guards above, both of which tear down: doing it earlier
    | wrote the load marker only for teardown to delete it again.
    */
    const previousUuid = await AsyncStorage.getItem(KEYS.GEOFENCE_SHIPMENT);
    if (previousUuid !== shipmentUuid) {
      await AsyncStorage.multiSet([
        [KEYS.GEOFENCE_SHIPMENT, shipmentUuid],
        [KEYS.GEOFENCE_NOTIFIED, "[]"],
      ]);
    }

    // Labels must be readable before the first crossing can fire.
    await AsyncStorage.setItem(KEYS.GEOFENCE_STOPS, JSON.stringify(labels));

    try {
      const running = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME).catch(
        () => false,
      );
      if (running) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => {});
      }

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
      console.log(`[DollarTraq Arrivals] Monitoring ${regions.length} stop(s).`);
    } catch (err) {
      console.warn("[DollarTraq Arrivals] Could not start monitoring:", err);
    }
  });

/** Stop monitoring and forget this load's stops. */
export const stopArrivalAlerts = async (): Promise<void> => serialize(teardown);

async function teardown(): Promise<void> {
  const running = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME).catch(
    () => false,
  );

  if (running) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME).catch((err) =>
      console.warn("[DollarTraq Arrivals] Could not stop monitoring:", err),
    );
  }

  await AsyncStorage.multiRemove([
    KEYS.GEOFENCE_STOPS,
    KEYS.GEOFENCE_NOTIFIED,
    KEYS.GEOFENCE_SHIPMENT,
  ]);
}

/* ------------------------------------------------------------------ */
/* The task                                                            */
/* ------------------------------------------------------------------ */

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("[DollarTraq Arrivals] Geofence error:", error);
    return;
  }

  const { eventType, region } =
    (data as {
      eventType?: Location.GeofencingEventType;
      region?: Location.LocationRegion;
    }) ?? {};

  if (eventType !== Location.GeofencingEventType.Enter) return;
  if (!region?.identifier) return;

  const identifier = region.identifier;

  /*
  | Announce an arrival once per load.
  |
  | iOS re-delivers an enter event whenever the driver crosses the boundary,
  | and manoeuvring a truck around a yard edge crosses it repeatedly. Without
  | this the driver is notified every time they reposition at a dock.
  */
  const notified = await readNotified();
  if (notified.includes(identifier)) return;

  await AsyncStorage.setItem(
    KEYS.GEOFENCE_NOTIFIED,
    JSON.stringify([...notified, identifier]),
  );

  const labels = await readStopLabels();
  const name = labels[identifier];

  await presentLocalAlert({
    identifier: `arrival-${identifier}`,
    title: name ? `Arrived at ${name}` : "Arrived at your stop",
    body: "Open DollarTraq to check in and complete this stop.",
    data: { type: "stop_arrival", stop_id: identifier },
  });

  console.log(`[DollarTraq Arrivals] Announced arrival at stop ${identifier}.`);
});
