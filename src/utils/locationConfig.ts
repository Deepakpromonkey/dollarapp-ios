import { BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/secureStore";

/*
| Shared vocabulary for the two halves of location tracking: the background task
| that reports position (LocationTracker) and the watchdog that notices when the
| driver has switched location off (locationHealth). They live in separate files
| but must agree on storage keys and on the ping URL, so both read them here
| rather than each declaring its own copy.
*/

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

export const KEYS = {
  /** Pings that could not be delivered yet, oldest first. */
  QUEUE: "@offline_location_queue",
  /** uuid of the load currently being tracked, or absent when idle. */
  ACTIVE_SHIPMENT: "@active_shipment_uuid",
  /** Last time the OS woke the task — used only for diagnostics. */
  WAKE_STAMP: "@last_task_wake",
  /** Last time we *attempted* delivery, which is what throttling is based on. */
  LAST_PING_ATTEMPT: "@last_ping_sent_timestamp",
  /** Interval the broker asked for, in seconds. */
  DESIRED_INTERVAL: "trackingInterval",
  /*
  | The interval the OS location updates were actually registered with. Kept
  | apart from DESIRED_INTERVAL because the whole point is to detect the moment
  | the two disagree and re-register — storing only the desired value is how a
  | broker's interval change used to be recorded and then quietly ignored.
  */
  APPLIED_INTERVAL: "@applied_tracking_interval",
  /** Last health state reported to the server, so we only report transitions. */
  LAST_HEALTH_STATE: "@last_location_health_state",
  /** When that state was last sent to the server. */
  LAST_HEALTH_REPORT_AT: "@last_location_health_report_at",
  /*
  | When the driver was last notified. Deliberately a separate clock from the
  | one above: sharing a single timestamp let a silent call suppress the next
  | notification for a whole cycle.
  */
  LAST_HEALTH_NOTIFIED_AT: "@last_location_health_notified_at",
  /** "1" while an OS-scheduled repeating warning is armed. */
  HEALTH_REPEAT_ARMED: "@location_health_repeat_armed",
} as const;

export const LOCATION_PING_URL = `${BASE_URL}/driver/location-ping`;

/*
| Mirrors the bounds the broker API validates `tracking_interval_seconds`
| against (min:60, max:21600). Anything outside that range is a bad value
| rather than an instruction — a broker sending 1 would flatten the phone's
| battery inside an hour and buy no useful precision.
*/
export const MIN_INTERVAL_SECONDS = 60;
export const MAX_INTERVAL_SECONDS = 21600;
export const DEFAULT_INTERVAL_SECONDS = 300;

/** Requests are given a hard ceiling: a background task that hangs gets killed. */
export const REQUEST_TIMEOUT_MS = 20000;

/*
| Offline pings accumulate in AsyncStorage. A driver through a long dead zone at
| a 60s interval produces 60 an hour, so the queue needs a ceiling or it grows
| without bound. When full the oldest are dropped: the recent shape of the route
| is worth more to a broker than where the truck was nine hours ago.
*/
export const MAX_QUEUED_PINGS = 500;

export function clampInterval(seconds: number): number {
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(seconds)));
}

/**
 * Read an interval out of a server response, whatever key it chose to use.
 *
 * Returns null when the response carries no usable interval, which is different
 * from carrying a bad one — callers keep their current interval in that case
 * rather than snapping back to the default.
 */
export function extractInterval(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;

  const root = result as Record<string, any>;
  const data = (root.data ?? {}) as Record<string, any>;

  const candidates = [
    data.tracking_interval_seconds,
    data.interval_seconds,
    data.ping_interval,
    data.tracking_interval,
    data.interval,
    root.tracking_interval_seconds,
    root.interval_seconds,
    root.ping_interval,
    root.tracking_interval,
    root.interval,
  ];

  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === "") continue;

    // Number() rather than parseInt: parseInt("abc12") is NaN but parseInt("12abc")
    // is 12, and a server sending "12abc" is sending something we should ignore.
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;

    return clampInterval(value);
  }

  return null;
}

/** Parse an interval previously written to AsyncStorage, tolerating corruption. */
export function parseStoredInterval(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return clampInterval(value);
}

export interface AuthedPostResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * POST to the driver API with the stored bearer token and a hard timeout.
 *
 * Throws only for transport failures (offline, DNS, timeout); an HTTP error
 * status comes back as `ok: false` so callers can tell "the server said no"
 * apart from "the server was never reached" and treat the queue accordingly.
 */
export async function authedPost(url: string, payload: unknown): Promise<AuthedPostResult> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // A 200 with an unparseable body is still a delivered ping, so a JSON
    // failure here must not be mistaken for a transport failure by the caller.
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}
