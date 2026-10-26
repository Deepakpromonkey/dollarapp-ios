import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import {
  authedPost,
  clampInterval,
  DEFAULT_INTERVAL_SECONDS,
  extractInterval,
  KEYS,
  LOCATION_PING_URL,
  LOCATION_TASK_NAME,
  MAX_QUEUED_PINGS,
  parseStoredInterval,
} from "./locationConfig";
import {
  clearLocationHealthAlerts,
  inspectLocationHealth,
  resetHealthReporting,
  syncLocationHealth,
} from "./locationHealth";
import { getPositionWithin } from "./currentPosition";

/*
| Background position reporting for an active load.
|
| Two rules shape everything below:
|
|   1. The broker owns the reporting rate. It arrives on the shipment and can be
|      changed mid-load, and a change has to reach the OS scheduler — not just a
|      software throttle, which can only ever make pings rarer than the rate the
|      OS is waking us at.
|
|   2. A ping that cannot be delivered is queued, never dropped. Drivers lose
|      signal for hours at a time and the trail has to survive it.
*/

export interface LocationPing {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  device_timestamp: number;
  is_mocked: boolean;
  bg_permission: boolean;
  services_enabled: boolean;
}

/*
| Every mutation of tracking state runs through one promise chain.
|
| start is called from a screen effect, from the AppState listener and from the
| background task when the broker changes the interval. Without serialising,
| two of those interleaving at their first await both see "not running yet" and
| both register location updates.
*/
let operationChain: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  // Both branches run the operation: a failed predecessor must not stop the
  // next one, and neither should its rejection reason be passed in as an argument.
  const result = operationChain.then(
    () => operation(),
    () => operation(),
  );
  // Keep the chain alive after a failure, but do not let it carry the rejection
  // into the next operation.
  operationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

async function readQueue(): Promise<LocationPing[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON would otherwise wedge the queue permanently, failing every
    // flush from here on. Losing the backlog beats never sending again.
    console.warn("[DollarTraq Tracker] Queue was unreadable; discarding it.");
    return [];
  }
}

async function writeQueue(queue: LocationPing[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
}

async function enqueuePing(ping: LocationPing): Promise<LocationPing[]> {
  const queue = await readQueue();
  queue.push(ping);

  // Drop from the front: the newest positions are the ones a broker is looking at.
  const trimmed =
    queue.length > MAX_QUEUED_PINGS ? queue.slice(queue.length - MAX_QUEUED_PINGS) : queue;

  if (trimmed.length < queue.length) {
    console.warn(
      `[DollarTraq Tracker] Queue full — dropped ${queue.length - trimmed.length} oldest ping(s).`,
    );
  }

  await writeQueue(trimmed);
  return trimmed;
}

interface FlushResult {
  /** True when the server has the pings and the queue has been cleared. */
  delivered: boolean;
  /** Parsed response body, which may carry a new interval. */
  body: unknown;
}

/**
 * Send everything queued for one shipment.
 *
 * The queue is cleared only on a definite answer. A transport failure leaves it
 * intact for the next attempt; a 403 clears it because the server is telling us
 * these pings will never be accepted and retrying forever is pointless.
 */
async function flushQueue(shipmentUuid: string): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { delivered: true, body: null };

  try {
    const result = await authedPost(LOCATION_PING_URL, {
      shipment_uuid: shipmentUuid,
      locations: queue,
    });

    if (result.ok) {
      // Re-read rather than remove: the background task may have appended a
      // ping while this request was in flight, and that one has not been sent.
      const current = await readQueue();
      await writeQueue(current.slice(queue.length));

      console.log(`[DollarTraq Tracker] Delivered ${queue.length} ping(s).`);
      return { delivered: true, body: result.body };
    }

    // 403: no longer this driver's load. 404: the load is gone. Neither will ever take them.
    if (result.status === 403 || result.status === 404) {
      console.warn(`[DollarTraq Tracker] ${result.status} for this load — discarding its queued pings.`);
      await AsyncStorage.removeItem(KEYS.QUEUE);
      return { delivered: false, body: result.body };
    }

    console.warn(`[DollarTraq Tracker] Server returned ${result.status}; keeping queue.`);
    return { delivered: false, body: result.body };
  } catch (err) {
    console.warn("[DollarTraq Tracker] Offline — keeping queue for the next attempt.", err);
    return { delivered: false, body: null };
  }
}

/* ------------------------------------------------------------------ */
/* Interval                                                            */
/* ------------------------------------------------------------------ */

export async function getAppliedInterval(): Promise<number | null> {
  return parseStoredInterval(await AsyncStorage.getItem(KEYS.APPLIED_INTERVAL));
}

async function getDesiredInterval(): Promise<number> {
  return (
    parseStoredInterval(await AsyncStorage.getItem(KEYS.DESIRED_INTERVAL)) ??
    DEFAULT_INTERVAL_SECONDS
  );
}

/**
 * Register OS location updates at a given rate, replacing any existing
 * registration, and record the rate that is actually in force.
 */
async function registerUpdates(intervalSeconds: number): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
    () => false,
  );

  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: intervalSeconds * 1000,
    distanceInterval: 0,
    /*
    | iOS pauses location updates on its own when it decides the device has
    | stopped moving, and never resumes on a timer. For a truck parked at a
    | dock that means tracking silently ends for the rest of the load.
    */
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    // Lets iOS batch fixes and wake the app once per interval instead of
    // continuously, which is the difference between a normal and a ruinous
    // battery drain on a long haul.
    deferredUpdatesInterval: intervalSeconds * 1000,
    deferredUpdatesDistance: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Active Load Tracking",
      notificationBody: "DollarTraq is sharing your location with the broker.",
      notificationColor: "#1E3A8A",
    },
  });

  await AsyncStorage.setItem(KEYS.APPLIED_INTERVAL, intervalSeconds.toString());
  console.log(`[DollarTraq Tracker] Reporting every ${intervalSeconds}s.`);
}

/**
 * Adopt a reporting rate the broker chose.
 *
 * This is the step that used to be missing. The old code stored the new value
 * and then called the start function, whose "already running for this shipment"
 * guard returned immediately — so the OS kept waking the task at the original
 * rate forever. Shortening the interval had no effect at all, because the
 * software throttle it did update can only discard pings, never ask for more.
 */
export async function applyBrokerInterval(
  shipmentUuid: string,
  intervalSeconds: number,
): Promise<void> {
  const desired = clampInterval(intervalSeconds);

  return serialize(async () => {
    const active = await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT);
    if (active !== shipmentUuid) return;

    await AsyncStorage.setItem(KEYS.DESIRED_INTERVAL, desired.toString());

    const applied = await getAppliedInterval();
    if (applied === desired) return;

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
      () => false,
    );
    if (!running) return;

    console.log(`[DollarTraq Tracker] Broker changed interval ${applied ?? "?"}s -> ${desired}s.`);
    await registerUpdates(desired);
  });
}

/** Pull an interval out of a ping response and apply it if it differs. */
async function adoptIntervalFrom(body: unknown, shipmentUuid: string): Promise<void> {
  const next = extractInterval(body);
  if (!next) return;

  const applied = await getAppliedInterval();
  if (applied === next) return;

  await applyBrokerInterval(shipmentUuid, next);
}

/* ------------------------------------------------------------------ */
/* Background task                                                     */
/* ------------------------------------------------------------------ */

/*
| The OS can deliver several callbacks back to back after a wake. This drops the
| duplicates without touching storage, which the throttle below cannot do
| because it has to survive the process being restarted.
*/
let lastTaskFireTime = 0;
const TASK_DEBOUNCE_MS = 5000;

/*
| The last error code reported, so a persistent condition is logged once.
|
| iOS re-delivers the same failure on every scheduled wake. Denied
| authorisation is the common one and it lasts until the driver changes a
| setting, so logging per fire buried every other message in the console
| without telling anyone anything new.
*/
let lastReportedErrorCode: string | number | null = null;

/** kCLErrorDenied — location is off, or the app was refused access. */
const CL_ERROR_DENIED = 1;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (error.code !== lastReportedErrorCode) {
      lastReportedErrorCode = error.code;

      /*
      | Denied is a device state, not a fault: the driver turned location off
      | or granted only "While Using". The health monitor already raises a
      | banner and a notification for exactly this, so an error here is
      | duplicate noise — a warning keeps it visible without implying the app
      | is broken.
      */
      if (error.code === CL_ERROR_DENIED) {
        console.warn(
          "[DollarTraq Tracker] Location access denied — background fixes will " +
            "not arrive until the driver grants Always access.",
        );
      } else {
        console.error("[DollarTraq Tracker] Background location error:", error);
      }
    }
    return;
  }

  // A fix arrived, so whatever was wrong has cleared; let the next failure
  // report itself rather than being swallowed as a repeat.
  lastReportedErrorCode = null;

  const now = Date.now();
  if (now - lastTaskFireTime < TASK_DEBOUNCE_MS) return;
  lastTaskFireTime = now;

  try {
    await AsyncStorage.setItem(KEYS.WAKE_STAMP, now.toString());

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations || locations.length === 0) return;

    // Batched deliveries are oldest-first, so the freshest fix is the last one.
    // Reading index 0 reported a position that could be a full interval stale.
    const location = locations[locations.length - 1];

    const shipmentUuid = await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT);
    if (!shipmentUuid) {
      console.warn("[DollarTraq Tracker] Woke with no active load; ignoring fix.");
      return;
    }

    const interval = (await getAppliedInterval()) ?? (await getDesiredInterval());

    const lastAttempt = Number(await AsyncStorage.getItem(KEYS.LAST_PING_ATTEMPT)) || 0;
    const elapsed = (now - lastAttempt) / 1000;

    // A 5s grace stops a wake that lands fractionally early from being thrown
    // away and pushing the real report out by a whole further interval.
    if (lastAttempt > 0 && elapsed < interval - 5) return;

    await AsyncStorage.setItem(KEYS.LAST_PING_ATTEMPT, now.toString());

    const health = await inspectLocationHealth();

    const ping: LocationPing = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      device_timestamp: location.timestamp || now,
      is_mocked: location.mocked ?? false,
      bg_permission: health.backgroundGranted,
      services_enabled: health.servicesEnabled,
    };

    /*
    | Queue first, then flush the whole queue. The old code built a payload,
    | posted it, and only wrote to storage on some of the failure branches — so
    | a response that arrived with an unreadable body cleared the queue and then
    | re-added the same ping from the catch, sending it twice.
    */
    await enqueuePing(ping);

    const { delivered, body } = await flushQueue(shipmentUuid);
    if (delivered) await adoptIntervalFrom(body, shipmentUuid);

    /*
    | This task running at all proves location works again, so stand the
    | warnings down from here. It is the only path that can: the OS repeat keeps
    | firing with the app closed, and a driver who switches location back on
    | without opening the app would otherwise go on being told it is off until
    | they did.
    */
    if (health.state === "ok") await clearLocationHealthAlerts();
  } catch (err) {
    // The ping is already queued by this point, so there is nothing to salvage
    // here beyond not letting the task reject.
    console.warn("[DollarTraq Tracker] Task failed:", err);
  }
});

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Begin (or reconfigure) tracking for a load.
 *
 * @param shipmentUuid    the load to attribute pings to
 * @param intervalSeconds the broker's reporting rate, when the caller knows it
 * @returns true when location updates are registered for the load
 */
export const startLocationTracking = async (
  shipmentUuid: string,
  intervalSeconds?: number,
): Promise<boolean> =>
  serialize(async () => {
    if (!shipmentUuid) return false;

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
      () => false,
    );
    const activeUuid = await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT);
    const applied = await getAppliedInterval();
    const stored = await getDesiredInterval();

    /*
    | The caller's hint comes from a cached shipment row; the stored value comes
    | from the last thing the server said on a ping for this load. Once we have
    | that, it is the fresher of the two — preferring the hint would let a
    | remount reset the rate to the stale one, which the next ping would then
    | correct, and so on.
    */
    const serverHasSpoken = activeUuid === shipmentUuid && applied !== null;
    const interval = clampInterval(serverHasSpoken ? stored : (intervalSeconds ?? stored));

    // Nothing to do only when the load *and* the rate both already match. The
    // old guard checked the load alone, which is why interval changes stuck.
    if (running && activeUuid === shipmentUuid && applied === interval) return true;

    /*
    | Switching loads: drain what is still queued while the old uuid is the one
    | on record. Otherwise the leftovers get flushed under the new load and the
    | broker sees the previous trip's positions on this shipment's map.
    */
    if (activeUuid && activeUuid !== shipmentUuid) {
      await flushQueue(activeUuid);
      await AsyncStorage.removeItem(KEYS.QUEUE);
      await AsyncStorage.removeItem(KEYS.LAST_PING_ATTEMPT);
      await resetHealthReporting();
    }

    await AsyncStorage.setItem(KEYS.ACTIVE_SHIPMENT, shipmentUuid);
    await AsyncStorage.setItem(KEYS.DESIRED_INTERVAL, interval.toString());

    console.log(`[DollarTraq Tracker] Starting ${shipmentUuid} at ${interval}s.`);

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      console.error("[DollarTraq Tracker] Foreground permission denied.");
      await syncLocationHealth(shipmentUuid, { force: true });
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== Location.PermissionStatus.GRANTED) {
      console.error("[DollarTraq Tracker] Background permission denied.");

      /*
      | Background updates cannot be registered, but foreground permission is
      | granted, so one position can still be taken right now. The broker gets
      | the truck's location at load start plus an explicit flag saying why
      | nothing will follow it. Not awaited: a fix and a round trip must not
      | hold up the chain.
      */
      sendImmediatePing(shipmentUuid, { flare: true }).catch(() => {});
      await syncLocationHealth(shipmentUuid, { force: true });
      return false;
    }

    /*
    | Registered before the first ping, never after it. The ping can wait 10 s
    | for a fix and 20 s for the server, and a driver who left the app in that
    | time was left with that one ping and no updates behind it, so the server
    | soon reported "GPS Signal Lost" for a load that was fine.
    */
    try {
      await registerUpdates(interval);
    } catch (err) {
      console.warn("[DollarTraq Tracker] Could not register location updates:", err);
      return false;
    }
    await syncLocationHealth(shipmentUuid, { force: true, silent: true });

    /*
    | An immediate ping means the broker sees the load move the moment it is
    | accepted, rather than after one whole interval of silence. It is also the
    | first chance to learn the rate this broker wants, which comes back
    | through applyBrokerInterval. Sent beside the chain, never awaited inside
    | it: applyBrokerInterval queues behind this operation, so the two would
    | wait on each other for good.
    */
    sendFirstPing(shipmentUuid).catch(() => {});
    return true;
  });

async function sendFirstPing(shipmentUuid: string): Promise<void> {
  const body = await sendImmediatePing(shipmentUuid);
  if (body) await adoptIntervalFrom(body, shipmentUuid);
}

/**
 * Take a fix now and deliver it along with anything queued.
 *
 * With `flare`, the ping exists to tell the server the permission state now
 * (bg_permission false), so it is dated now: its fix may be one the phone
 * already held, older than the load's start, which the server discards.
 *
 * @returns the response body, so the caller can read a broker interval from it.
 */
async function sendImmediatePing(
  shipmentUuid: string,
  { flare = false }: { flare?: boolean } = {},
): Promise<unknown> {
  const location = await getPositionWithin(Location.Accuracy.Balanced);

  // Never a made-up position: without a fix there is nothing to send.
  if (!location) {
    console.warn("[DollarTraq Tracker] No fix for the immediate ping; the first interval will send one.");
    return null;
  }

  // A stop, or a different load, can land while the fix is being taken.
  if ((await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT)) !== shipmentUuid) return null;

  const health = await inspectLocationHealth();

  await enqueuePing({
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
    device_timestamp: flare ? Date.now() : location.timestamp || Date.now(),
    is_mocked: location.mocked ?? false,
    bg_permission: health.backgroundGranted,
    services_enabled: health.servicesEnabled,
  });

  if ((await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT)) === shipmentUuid) {
    await AsyncStorage.setItem(KEYS.LAST_PING_ATTEMPT, Date.now().toString());
  }

  const { delivered, body } = await flushQueue(shipmentUuid);
  return delivered ? body : null;
}

/**
 * Stop tracking and clean up.
 *
 * Queued pings are flushed first and kept if that fails, so finishing a load
 * inside a dead zone does not throw away the last stretch of the trail.
 */
export const stopLocationTracking = async (): Promise<void> =>
  serialize(async () => {
    console.log("[DollarTraq Tracker] Stopping.");

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
      () => false,
    );
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch((err) =>
        console.warn("[DollarTraq Tracker] Could not stop updates:", err),
      );
    }

    const shipmentUuid = await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT);
    const flushed = shipmentUuid ? (await flushQueue(shipmentUuid)).delivered : true;

    await AsyncStorage.multiRemove([
      KEYS.ACTIVE_SHIPMENT,
      KEYS.DESIRED_INTERVAL,
      KEYS.APPLIED_INTERVAL,
      KEYS.WAKE_STAMP,
      KEYS.LAST_PING_ATTEMPT,
    ]);
    await resetHealthReporting();

    console.log(
      `[DollarTraq Tracker] Stopped. Queue ${flushed ? "flushed" : "retained for retry"}.`,
    );
  });

/**
 * Re-register updates if the OS has stopped delivering them.
 *
 * Called when the app is foregrounded: the process may have been killed and
 * restarted, or the driver may have revoked and restored the permission, either
 * of which leaves the stored active load in place with no task behind it.
 */
export const ensureTrackingRunning = async (
  shipmentUuid: string,
  intervalSeconds?: number,
): Promise<boolean> => {
  const health = await inspectLocationHealth();
  if (health.state !== "ok") {
    await syncLocationHealth(shipmentUuid);
    return false;
  }

  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
    () => false,
  );
  const applied = await getAppliedInterval();
  const desired = clampInterval(intervalSeconds ?? (await getDesiredInterval()));
  const activeUuid = await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT);

  if (running && applied === desired && activeUuid === shipmentUuid) return true;

  return startLocationTracking(shipmentUuid, desired);
};
