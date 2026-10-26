import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";

import {
  describeHealth,
  isBlocking,
  isDegraded,
  startLocationHealthMonitor,
  syncLocationHealth,
  type LocationHealthSnapshot,
  type LocationHealthState,
} from "@/utils/locationHealth";

export interface UseLocationHealth {
  snapshot: LocationHealthSnapshot | null;
  state: LocationHealthState;
  /** Tracking is not working as the broker expects. */
  degraded: boolean;
  /** No position can be obtained at all, not merely no background fixes. */
  blocking: boolean;
  title: string;
  body: string;
  /** Label for the action button, matched to what will actually happen. */
  actionLabel: string;
  /** Prompt for the missing permission, or open the right settings screen. */
  resolve: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Watch whether this device can still report its position for the active load.
 *
 * Only runs while there is a load to track — a driver between loads is not
 * expected to have background location on, and warning them about it would
 * train them to dismiss the warning that matters.
 */
export function useLocationHealth(activeShipmentUuid?: string | null): UseLocationHealth {
  const key = activeShipmentUuid || null;

  // Each reading remembers the load it was taken for; a new load starts with none.
  const [reading, setReading] = useState<{
    key: string;
    snapshot: LocationHealthSnapshot;
  } | null>(null);

  /*
  | The monitor, its foreground listener and a button press can all be
  | checking at once. A reading older than the one on screen is dropped (by
  | when the check started), so a check that finishes late cannot put a fixed
  | problem back on screen.
  */
  const lastCheckedAt = useRef(0);

  const accept = useCallback((forKey: string, next: LocationHealthSnapshot) => {
    if (next.checkedAt < lastCheckedAt.current) return;
    lastCheckedAt.current = next.checkedAt;
    setReading({ key: forKey, snapshot: next });
  }, []);

  useEffect(() => {
    if (!key) return;

    /*
    | Notifications are deliberately NOT suppressed here even though this screen
    | shows its own banner: the driver is told once when tracking stops working,
    | and a banner they have already scrolled past is not that. Suppressing while
    | the app was open meant the notification only ever fired on app launch,
    | which is the one moment the driver is already looking at the banner.
    */
    return startLocationHealthMonitor({ onSnapshot: (next) => accept(key, next) });
  }, [key, accept]);

  /*
  | Derived rather than cleared in the effect: clearing there is a cascading
  | render, leaving the last reading in place would keep a warning on screen
  | about a load that has already been delivered, and a reading taken for the
  | previous load is not trusted for the next one.
  */
  const current = reading && reading.key === key ? reading.snapshot : null;

  const refresh = useCallback(async () => {
    if (!key) return;
    const next = await syncLocationHealth(key, { silent: true });
    accept(key, next);
  }, [key, accept]);

  const state = current?.state ?? "unknown";

  const resolve = useCallback(async () => {
    try {
      if (state === "services_off") {
        // A permission prompt cannot fix the device-wide switch, so send the
        // driver straight to the screen that has it.
        if (Platform.OS === "android") {
          await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
        } else {
          await Linking.openSettings();
        }
        return;
      }

      // Once the OS has stopped offering prompts, requesting again returns
      // "denied" without showing anything — Settings is the only way back.
      if (current && !current.canAskAgain) {
        await Linking.openSettings();
        return;
      }

      if (state === "foreground_denied") {
        await Location.requestForegroundPermissionsAsync();
      } else if (state === "background_denied") {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch (err) {
      console.warn("[useLocationHealth] Could not open settings:", err);
    } finally {
      await refresh();
    }
  }, [state, current, refresh]);

  const { title, body } = describeHealth(state);

  const actionLabel =
    state === "services_off"
      ? "Open location settings"
      : current && !current.canAskAgain
        ? "Open settings"
        : "Grant access";

  return {
    snapshot: current,
    state,
    degraded: isDegraded(state),
    blocking: isBlocking(state),
    title,
    body,
    actionLabel,
    resolve,
    refresh,
  };
}
