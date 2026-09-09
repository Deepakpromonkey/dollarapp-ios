import { useCallback, useEffect, useState } from "react";
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
  const [snapshot, setSnapshot] = useState<LocationHealthSnapshot | null>(null);

  useEffect(() => {
    if (!activeShipmentUuid) return;

    /*
    | Notifications are deliberately NOT suppressed here even though this screen
    | shows its own banner. A driver with an active load and location switched
    | off gets alerted every five minutes until they fix it, and a banner they
    | have already scrolled past is not an alert. Suppressing while the app was
    | open meant the notification only ever fired on app launch, which is the
    | one moment the driver is already looking at the banner.
    */
    const stop = startLocationHealthMonitor({ onSnapshot: setSnapshot });

    return stop;
  }, [activeShipmentUuid]);

  /*
  | Derived rather than cleared in the effect: clearing there is a cascading
  | render, and leaving the last reading in place would keep a warning on screen
  | about a load that has already been delivered.
  */
  const current = activeShipmentUuid ? snapshot : null;

  const refresh = useCallback(async () => {
    const next = await syncLocationHealth(activeShipmentUuid ?? null, { silent: true });
    setSnapshot(next);
  }, [activeShipmentUuid]);

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
