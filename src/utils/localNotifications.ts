import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/*
| Local notifications, wrapped so a missing native module can never take the app
| down with it.
|
| expo-notifications is a native module: a dev client built before it was added
| resolves the JS but has nothing behind it, and every call throws. Tracking
| alerts are the least important thing this app does, so each entry point here
| swallows its own failure and reports whether it worked. Callers fall back to
| the server-side push and the in-app banner, both of which need no native code.
*/

/*
| Version suffix, and it has to stay. An Android channel is immutable once
| created: setNotificationChannelAsync cannot change the sound or importance of
| one that already exists, and deleting a channel and recreating it under the
| same id restores the original settings rather than the new ones — Android does
| that deliberately, so an app cannot make itself louder behind the user's back.
|
| v1 was created asking for a custom sound file named "default", which does not
| exist, leaving devices that ran that build with a channel whose sound is a
| dangling resource. The only way to correct it is a new id.
|
| So: bump this whenever the channel's own settings change. Editing the object
| below without bumping is a change no existing install will ever see.
*/
const ANDROID_CHANNEL_ID = "location-alerts-v2";

/** Channel ids this app has used before, deleted so they stop cluttering Settings. */
const RETIRED_ANDROID_CHANNEL_IDS = ["location-alerts"];

let handlerConfigured = false;
let channelReady = false;
/** Null until the first call tells us; avoids retrying a module that is absent. */
let moduleUsable: boolean | null = null;

function markUnusable(err: unknown): false {
  if (moduleUsable !== false) {
    console.warn(
      "[LocalNotifications] expo-notifications is unavailable — falling back to " +
        "server push and the in-app banner. Rebuild the dev client to enable " +
        "local alerts.",
      err,
    );
  }
  moduleUsable = false;
  return false;
}

/**
 * Make sure notifications posted while the app is foregrounded are still shown.
 *
 * Without a handler expo-notifications silently drops foreground notifications,
 * which is exactly the case that matters here: the driver is often looking at
 * the trip screen when they revoke the permission.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured || moduleUsable === false) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  } catch (err) {
    markUnusable(err);
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (channelReady || Platform.OS !== "android") return;

  // Best-effort: leaving these behind shows the driver two identically-named
  // channels in system settings, one of which does nothing.
  for (const retired of RETIRED_ANDROID_CHANNEL_IDS) {
    await Notifications.deleteNotificationChannelAsync(retired).catch(() => {});
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Load tracking alerts",
    // MAX rather than DEFAULT: this fires when a load has stopped reporting,
    // which the driver needs to see before the broker calls to ask why.
    importance: Notifications.AndroidImportance.MAX,
    /*
    | `sound` is deliberately absent. On an Android channel the field holds a
    | custom sound *filename*, which has to be shipped in the expo-notifications
    | config plugin's `sounds` array — passing "default" asks for a file by that
    | name, which does not exist, and passing null means silent. Leaving the key
    | off is what selects the system notification sound.
    */
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1E3A8A",
  });
  channelReady = true;
}

/**
 * Ask for notification permission. Safe to call repeatedly.
 *
 * @returns true when we may post notifications.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (moduleUsable === false) return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      moduleUsable = true;
      return true;
    }

    // canAskAgain false means the user has hard-denied; asking again just
    // returns denied immediately, so there is nothing to gain by trying.
    if (!current.canAskAgain) return false;

    const requested = await Notifications.requestPermissionsAsync();
    moduleUsable = true;
    return requested.granted;
  } catch (err) {
    return markUnusable(err);
  }
}

export interface LocalAlert {
  title: string;
  body: string;
  /** Merged into the notification payload so a tap can be routed. */
  data?: Record<string, unknown>;
  /*
  | Stable id. Re-posting with the same one replaces the previous notification
  | rather than adding to it, so a recurring warning stays a single line in the
  | tray instead of a stack of identical copies.
  */
  identifier?: string;
}

/**
 * Post a notification immediately.
 *
 * @returns true if it was handed to the OS, false if it could not be shown for
 *          any reason — no native module, no permission, or a failed schedule.
 */
export async function presentLocalAlert(alert: LocalAlert): Promise<boolean> {
  if (moduleUsable === false) return false;

  try {
    const permitted = await ensureNotificationPermission();
    if (!permitted) return false;

    configureNotificationHandler();
    await ensureAndroidChannel();

    await Notifications.scheduleNotificationAsync({
      ...(alert.identifier ? { identifier: alert.identifier } : null),
      content: {
        title: alert.title,
        body: alert.body,
        // Boolean, not "default": a string is read as a custom sound filename.
        sound: true,
        data: alert.data ?? {},
        ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
      },
      // null trigger means "now" rather than "on a schedule".
      trigger: null,
    });

    return true;
  } catch (err) {
    console.warn("[LocalNotifications] Failed to present alert:", err);
    return false;
  }
}

/**
 * Hand the OS a notification that repeats on its own until cancelled.
 *
 * This is the only mechanism that keeps warning a driver whose app is closed.
 * Anything driven from JavaScript stops the moment the process is suspended or
 * killed, and the background location task is no help either — it cannot fire
 * precisely because location is off. A trigger registered here lives in the
 * system's notification scheduler, so it keeps firing with the app shut.
 *
 * @returns true if the OS accepted the schedule.
 */
export async function scheduleRepeatingAlert(
  alert: LocalAlert & { identifier: string; seconds: number },
): Promise<boolean> {
  if (moduleUsable === false) return false;

  try {
    const permitted = await ensureNotificationPermission();
    if (!permitted) return false;

    configureNotificationHandler();
    await ensureAndroidChannel();

    /*
    | Cancel first. Re-scheduling the same identifier is meant to replace, but
    | making the removal explicit means a caller can never end up with two
    | timers nagging out of step.
    */
    await Notifications.cancelScheduledNotificationAsync(alert.identifier).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: alert.identifier,
      content: {
        title: alert.title,
        body: alert.body,
        sound: true,
        data: alert.data ?? {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        // iOS refuses a repeating interval under 60 seconds.
        seconds: Math.max(60, Math.round(alert.seconds)),
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null),
      },
    });

    return true;
  } catch (err) {
    console.warn("[LocalNotifications] Failed to schedule repeating alert:", err);
    return false;
  }
}

/** Stop a scheduled alert. Safe to call when nothing is scheduled. */
export async function cancelAlert(identifier: string): Promise<void> {
  if (moduleUsable === false) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    console.warn("[LocalNotifications] Failed to cancel alert:", err);
  }
}
