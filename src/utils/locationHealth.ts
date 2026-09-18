import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";

import {
  authedPost,
  DEFAULT_INTERVAL_SECONDS,
  KEYS,
  LOCATION_PING_URL,
  parseStoredInterval,
} from "./locationConfig";
import { cancelAlert, presentLocalAlert } from "./localNotifications";

/*
| Noticing when the driver stops being trackable.
|
| The background location task cannot do this job on its own: if the driver
| switches location services off, or revokes the permission, the task simply
| stops being woken. There is no error and no final callback — tracking just
| goes quiet, and neither the driver nor the broker is told why. Everything here
| exists to turn that silence into something both of them can see.
*/

export type LocationHealthState =
  /** Tracking can run in the background as intended. */
  | "ok"
  /** The device's location master switch is off. Nothing can get a fix. */
  | "services_off"
  /** The app has no location permission at all. */
  | "foreground_denied"
  /** "While Using the App" only — no fixes once the driver leaves the app. */
  | "background_denied"
  /** The check itself failed; treated as "do not alarm anyone". */
  | "unknown";

export interface LocationHealthSnapshot {
  state: LocationHealthState;
  servicesEnabled: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  /** False once the OS will no longer show a prompt — Settings is the only route. */
  canAskAgain: boolean;
  checkedAt: number;
}

/*
| How long a problem may persist before the driver is reminded about it again.
|
| Five minutes is a nag, and intentionally so: a load that is not reporting is
| a load the broker is about to phone about. The health check itself runs every
| POLL_INTERVAL_MS, so this is what actually decides the notification rate — the
| checks in between find nothing new and do nothing.
*/
const NOTIFY_INTERVAL_MS = 5 * 60 * 1000;

/** How often an unchanged problem is re-sent to the server. */
const REPORT_INTERVAL_MS = 5 * 60 * 1000;

/** Replaced in place on each new alert, so the tray holds one line, not a stack. */
const ALERT_ID = "dt-location-health";

/** The OS-scheduled repeat that keeps nagging once the app is gone. */
const REPEAT_ALERT_ID = "dt-location-health-repeat";

/*
| Only one health sync may be in flight at a time.
|
| The dedupe below is a read-modify-write across AsyncStorage, and on app open
| four separate callers reach it at once: startLocationTracking's denied-
| permission path, ensureTrackingRunning from the AppState effect, the monitor's
| first pass and the monitor's own foreground listener. Unserialised they all
| read the same stale timestamp, all conclude the driver is due an alert, and
| all fire — which is why opening the app produced a burst of identical
| notifications instead of one.
*/
let healthChain: Promise<unknown> = Promise.resolve();

function serializeHealth<T>(operation: () => Promise<T>): Promise<T> {
  const result = healthChain.then(
    () => operation(),
    () => operation(),
  );
  healthChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Tear down every warning. Called on recovery and when a load ends. */
export async function clearLocationHealthAlerts(): Promise<void> {
  await cancelAlert(REPEAT_ALERT_ID);
  await cancelAlert(ALERT_ID);
  await AsyncStorage.removeItem(KEYS.HEALTH_REPEAT_ARMED);
}

export function isDegraded(state: LocationHealthState): boolean {
  return state === "services_off" || state === "foreground_denied" || state === "background_denied";
}

/**
 * True when no position can be obtained at all, as opposed to merely losing
 * background fixes. Callers use this to decide how loudly to complain.
 */
export function isBlocking(state: LocationHealthState): boolean {
  return state === "services_off" || state === "foreground_denied";
}

export function describeHealth(state: LocationHealthState): { title: string; body: string } {
  switch (state) {
    case "services_off":
      return {
        title: "Location is turned off",
        body:
          "DollarTraq can't report your position to the broker while your device's " +
          "location is off. Turn it back on to keep this load tracked.",
      };
    case "foreground_denied":
      return {
        title: "Location permission removed",
        body:
          "DollarTraq no longer has permission to use your location, so this load " +
          "has stopped reporting. Re-enable it in Settings.",
      };
    case "background_denied":
      return {
        title: "Set location to “Always”",
        body:
          "DollarTraq can only see your position while the app is open. Set location " +
          "access to “Always” so tracking continues while you drive.",
      };
    default:
      return { title: "Location tracking", body: "Tracking is active." };
  }
}

/**
 * Read the current state of everything tracking depends on.
 *
 * Ordered worst-first: with services off the permission answers are not
 * meaningful, and telling a driver to change a permission when the problem is
 * the master switch sends them to the wrong screen.
 */
export async function inspectLocationHealth(): Promise<LocationHealthSnapshot> {
  const checkedAt = Date.now();

  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();

    const foregroundGranted = foreground.status === Location.PermissionStatus.GRANTED;
    const backgroundGranted = background.status === Location.PermissionStatus.GRANTED;

    let state: LocationHealthState = "ok";
    if (!servicesEnabled) state = "services_off";
    else if (!foregroundGranted) state = "foreground_denied";
    else if (!backgroundGranted) state = "background_denied";

    return {
      state,
      servicesEnabled,
      foregroundGranted,
      backgroundGranted,
      canAskAgain: foreground.canAskAgain && background.canAskAgain,
      checkedAt,
    };
  } catch (err) {
    console.warn("[LocationHealth] Inspection failed:", err);
    return {
      state: "unknown",
      servicesEnabled: false,
      foregroundGranted: false,
      backgroundGranted: false,
      canAskAgain: true,
      checkedAt,
    };
  }
}

/**
 * Tell the server that this driver's tracking is degraded (or recovered).
 *
 * Sent to the ping endpoint with an empty `locations` array. The previous
 * implementation reported a denied permission as a ping at lat 0 / lng 0, which
 * writes a real coordinate in the Gulf of Guinea into the load's breadcrumb
 * trail — the status belongs at the top level, not disguised as a position.
 */
export async function reportLocationHealth(
  snapshot: LocationHealthSnapshot,
  shipmentUuid: string,
): Promise<boolean> {
  try {
    const result = await authedPost(LOCATION_PING_URL, {
      shipment_uuid: shipmentUuid,
      locations: [],
      location_status: snapshot.state,
      services_enabled: snapshot.servicesEnabled,
      fg_permission: snapshot.foregroundGranted,
      bg_permission: snapshot.backgroundGranted,
      device_timestamp: snapshot.checkedAt,
    });

    if (!result.ok) {
      console.warn(
        `[LocationHealth] Server rejected status report (${result.status}). ` +
          "The endpoint may not accept status-only pings yet.",
      );
      return false;
    }

    return true;
  } catch (err) {
    // Offline is the common case here and is not worth escalating: the next
    // successful ping carries the current permission flags anyway.
    console.warn("[LocationHealth] Could not deliver status report:", err);
    return false;
  }
}

interface LastReport {
  state: string | null;
  reportedAt: number;
  notifiedAt: number;
}

async function readLastReport(): Promise<LastReport> {
  const [state, reportedRaw, notifiedRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.LAST_HEALTH_STATE),
    AsyncStorage.getItem(KEYS.LAST_HEALTH_REPORT_AT),
    AsyncStorage.getItem(KEYS.LAST_HEALTH_NOTIFIED_AT),
  ]);

  const toStamp = (raw: string | null) => {
    const value = Number(raw);
    // 0 makes the first check look overdue, which is what we want.
    return Number.isFinite(value) ? value : 0;
  };

  return { state, reportedAt: toStamp(reportedRaw), notifiedAt: toStamp(notifiedRaw) };
}

/** Forget the recorded state so the next check reports and notifies from scratch. */
export async function resetHealthReporting(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.LAST_HEALTH_STATE,
    KEYS.LAST_HEALTH_REPORT_AT,
    KEYS.LAST_HEALTH_NOTIFIED_AT,
  ]);
  await clearLocationHealthAlerts();
}

export interface SyncHealthOptions {
  /** Report and notify even if nothing changed since last time. */
  force?: boolean;
  /** Skip the driver-facing notification; the caller is showing its own UI. */
  silent?: boolean;
}

/**
 * Check tracking health and, when it has changed for the worse, tell both the
 * server and the driver.
 *
 * Deduplicated so a check running every minute does not produce a notification
 * every minute: the driver is alerted on the transition and then every
 * NOTIFY_INTERVAL_MS for as long as it lasts. A driver who dismissed the first
 * alert five minutes ago is still not being tracked.
 */
export async function syncLocationHealth(
  shipmentUuid?: string | null,
  options: SyncHealthOptions = {},
): Promise<LocationHealthSnapshot> {
  return serializeHealth(async () => {
    const snapshot = await inspectLocationHealth();

    // "unknown" means the check itself failed. Reporting it would look like a
    // permission problem to the broker and would nag the driver over nothing.
    if (snapshot.state === "unknown") return snapshot;

    const uuid = shipmentUuid ?? (await AsyncStorage.getItem(KEYS.ACTIVE_SHIPMENT));

    // Off-duty drivers are not expected to be trackable, so nothing to report.
    if (!uuid) return snapshot;

    const now = Date.now();
    const degraded = isDegraded(snapshot.state);
    const { state: lastState, reportedAt } = await readLastReport();
    const changed = lastState !== snapshot.state;

    /*
    | No repeating alert is ever armed.
    |
    | This used to schedule an OS repeat that re-fired every NOTIFY_INTERVAL_MS
    | for as long as location stayed off, so a driver who denied the permission
    | was prompted about it every five minutes indefinitely. App Review
    | rejected that under guideline 5.1.1(iv): asking a user to reconsider a
    | permission they have already declined does not respect their decision.
    |
    | The driver is now told once, on the transition into a degraded state, and
    | then left alone. The banner on the trip screen remains for anyone who
    | wants to act on it, and the server still hears about the state on its own
    | cadence — that reporting is not driver-facing and is unaffected.
    |
    | The disarm is kept: an install upgrading from a build that armed the
    | repeat still has one scheduled with the OS, and it has to be cancelled or
    | it would outlive the code that created it.
    */
    const legacyRepeatArmed = (await AsyncStorage.getItem(KEYS.HEALTH_REPEAT_ARMED)) === "1";

    if (legacyRepeatArmed) {
      await clearLocationHealthAlerts();
      await AsyncStorage.removeItem(KEYS.HEALTH_REPEAT_ARMED);
    } else if (!degraded) {
      await clearLocationHealthAlerts();
    }

    const shouldReport =
      !!options.force || changed || (degraded && now - reportedAt >= REPORT_INTERVAL_MS);

    /*
    | Once the OS repeat is armed it owns the ongoing nagging, so JavaScript
    | only announces the transition. Firing on the timer as well would give a
    | driver with the app open two notifications per cycle. The time-based arm
    | is kept purely as a fallback for when scheduling failed.
    */
    /*
    | Only on the transition into a degraded state: one notification per
    | problem, never a reminder. See the note above on guideline 5.1.1(iv).
    */
    const shouldNotify = !options.silent && degraded && changed;

    if (!shouldReport && !shouldNotify) return snapshot;

    if (shouldReport) {
      await AsyncStorage.multiSet([
        [KEYS.LAST_HEALTH_STATE, snapshot.state],
        [KEYS.LAST_HEALTH_REPORT_AT, now.toString()],
      ]);

      await reportLocationHealth(snapshot, uuid);
    }

    if (shouldNotify) {
      /*
      | Stamped whether or not the alert actually appeared. If notifications are
      | themselves denied, presentLocalAlert returns false every time, and
      | retrying it once a minute would burn battery to no effect.
      */
      await AsyncStorage.setItem(KEYS.LAST_HEALTH_NOTIFIED_AT, now.toString());

      const { title, body } = describeHealth(snapshot.state);
      await presentLocalAlert({
        identifier: ALERT_ID,
        title,
        body,
        data: { type: "location_health", state: snapshot.state, shipment_uuid: uuid },
      });
    }

    return snapshot;
  });
}

/*
| Foreground watchdog.
|
| The background task is the wrong place to detect these problems, because the
| conditions we are looking for are exactly the ones that stop it from running.
| This polls while the app is open and re-checks the moment it is foregrounded,
| which is when a driver who just changed the setting comes back.
*/

/*
| The health check does not get its own fixed rate. It follows the broker's
| reporting interval, capped so it can still deliver on the notify cadence.
|
| Two different jobs are easy to conflate here. The broker's interval governs
| how often a *position* is reported — a GPS fix plus an HTTP round trip, which
| is the expensive part, and which already follows it exactly. This check is
| three local permission/service lookups: no fix, no network. So the argument
| for pinning it to the broker's rate is tidiness, not battery.
|
| What genuinely bounds it is NOTIFY_INTERVAL_MS. A driver cannot be alerted
| every five minutes by a check that only runs every six hours, so following a
| long broker interval literally would break the thing the check exists for.
| Halved rather than matched: a check landing a fraction of a second early
| fails the "is the nag due" test and pushes the alert out by a whole further
| cycle, turning a five-minute nag into a ten-minute one.
*/
const MAX_POLL_INTERVAL_MS = NOTIFY_INTERVAL_MS / 2;

async function nextPollDelay(): Promise<number> {
  const brokerSeconds =
    parseStoredInterval(await AsyncStorage.getItem(KEYS.DESIRED_INTERVAL)) ??
    DEFAULT_INTERVAL_SECONDS;

  return Math.min(brokerSeconds * 1000, MAX_POLL_INTERVAL_MS);
}

export interface HealthMonitorOptions {
  /** Called after every check, whether or not anything changed. */
  onSnapshot?: (snapshot: LocationHealthSnapshot) => void;
  /** Suppress notifications — for screens that render their own warning. */
  silent?: boolean;
}

/**
 * Start watching tracking health. Returns a function that stops it.
 *
 * The active shipment is read from storage on each pass rather than captured,
 * so the monitor keeps working across a change of load without being restarted.
 */
export function startLocationHealthMonitor(options: HealthMonitorOptions = {}): () => void {
  let stopped = false;

  const check = async (force = false) => {
    if (stopped) return;
    try {
      const snapshot = await syncLocationHealth(null, { force, silent: options.silent });
      if (!stopped) options.onSnapshot?.(snapshot);
    } catch (err) {
      console.warn("[LocationHealth] Monitor pass failed:", err);
    }
  };

  /*
  | A self-rescheduling timeout rather than setInterval, so the delay is
  | recomputed every pass. The broker can change the interval mid-load, and a
  | setInterval would hold whatever rate was in force when the screen mounted.
  */
  let timer: ReturnType<typeof setTimeout> | null = null;

  const loop = async () => {
    await check();
    if (stopped) return;
    timer = setTimeout(loop, await nextPollDelay());
  };

  loop();

  // Foregrounding is the moment a driver who just changed the setting comes
  // back, so check immediately instead of waiting out the current delay.
  const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") check();
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    subscription.remove();
  };
}
