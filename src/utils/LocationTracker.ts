import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking } from "react-native";
import { BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/secureStore";

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";
const LOCATION_QUEUE_KEY = "@offline_location_queue";
const ACTIVE_SHIPMENT_KEY = "@active_shipment_uuid";
const WAKE_STAMP_KEY = "@last_task_wake";
const LAST_PING_SENT_KEY = "@last_ping_sent_timestamp";

/*
| Pings go to the same API as everything else. This used to be a hardcoded
| ngrok tunnel, which meant background tracking stopped working the moment that
| tunnel was recycled — silently, because the task swallows its own errors.
*/
const LOCATION_PING_URL = `${BASE_URL}/driver/location-ping`;

// Helper to extract interval from any response structure
const extractInterval = (result: any): number | null => {
  if (!result) return null;

  const val =
    result.data?.interval_seconds ??
    result.data?.ping_interval ??
    result.data?.tracking_interval ??
    result.data?.interval ??
    result.interval_seconds ??
    result.ping_interval ??
    result.tracking_interval ??
    result.interval;

  return val ? parseInt(val, 10) : null;
};

let lastTaskFireTime = 0;
let instantMemoryLock = 0;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[DollarTraq Tracker] ❌ Background Location Error:", error);
    return;
  }

  const now = Date.now();

  if (now - lastTaskFireTime < 5000) {
      return; 
  }
  lastTaskFireTime = now;

  try {
    await AsyncStorage.setItem(WAKE_STAMP_KEY, now.toString());

    if (data) {
      const { locations } = data as any;
      const location = locations?.[0];

      if (location) {
        const currentIntervalStr = await AsyncStorage.getItem("trackingInterval");
        const activeInterval = currentIntervalStr ? parseInt(currentIntervalStr, 10) : 300;

        const lastSentStr = await AsyncStorage.getItem(LAST_PING_SENT_KEY);
        const dbLastSent = lastSentStr ? parseInt(lastSentStr, 10) : 0;
        
        const effectiveLastSent = Math.max(instantMemoryLock, dbLastSent);
        const secondsSinceLastSent = (now - effectiveLastSent) / 1000;

        if (effectiveLastSent > 0 && secondsSinceLastSent < activeInterval - 5) {
          console.log(`[DollarTraq Tracker] ⏳ Throttled: ${secondsSinceLastSent.toFixed(1)}s elapsed.`);
          return; 
        }

        instantMemoryLock = now;
        await AsyncStorage.setItem(LAST_PING_SENT_KEY, now.toString());

        const bgPerm = await Location.getBackgroundPermissionsAsync();

        const newPing = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          device_timestamp: now,
          is_mocked: location.mocked ?? false,
          bg_permission: bgPerm.status === "granted",
        };

        console.log(`\n======================================================`);
        console.log(`[DollarTraq Tracker] ⏱️ TARGET INTERVAL HIT (${secondsSinceLastSent.toFixed(1)}s). Initiating location transmission.`);
        console.log(`[DollarTraq Tracker] 📍 Lat ${newPing.lat}, Lng ${newPing.lng} | Mocked: ${newPing.is_mocked} | BG Perm: ${newPing.bg_permission}`);

        const token = await getAccessToken();
        const shipmentUuid = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);

        if (!token || !shipmentUuid) {
          console.warn(`[DollarTraq Tracker] ⏸️ Skipped ping: Token missing or Shipment UUID missing`);
          return;
        }

        const storedQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
        let locationQueue = storedQueue ? JSON.parse(storedQueue) : [];
        locationQueue.push(newPing);

        console.log(`[DollarTraq Tracker] 🚀 Sending ${locationQueue.length} location(s) to server...`);

        const response = await fetch(LOCATION_PING_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            shipment_uuid: shipmentUuid,
            locations: locationQueue,
          }),
        });

        if (response.ok) {
          console.log(`[DollarTraq Tracker] ✅ SUCCESS! Server accepted ${locationQueue.length} location(s).`);
          await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);

          const result = await response.json();
          const newInterval = extractInterval(result);

          if (newInterval && newInterval !== activeInterval) {
            console.log(`[DollarTraq Tracker] 🔄 Broker updated interval from ${activeInterval}s to ${newInterval}s! Re-configuring...`);
            await AsyncStorage.setItem("trackingInterval", newInterval.toString());
            startLocationTracking(shipmentUuid, newInterval);
          }
        } else if (response.status === 403) {
          console.warn(`[DollarTraq Tracker] 🛑 403 Forbidden. Wiping local queue.`);
          await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
        } else {
          console.warn(`[DollarTraq Tracker] ⚠️ Server Error Status ${response.status}`);
          await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(locationQueue));
        }
      }
    }
  } catch (err) {
    console.warn(`[DollarTraq Tracker] 📶 NETWORK ERROR/OFFLINE: Storing ping locally.`, err);
    const storedQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
    let locationQueue = storedQueue ? JSON.parse(storedQueue) : [];
    
    if (data) { 
        const { locations } = data as any;
        if (locations?.[0]) {
             locationQueue.push({
                 lat: locations[0].coords.latitude,
                 lng: locations[0].coords.longitude,
                 accuracy: locations[0].coords.accuracy,
                 device_timestamp: Date.now(),
                 is_mocked: locations[0].mocked ?? false,
                 bg_permission: true 
             });
        }
    }

    await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(locationQueue));
  }
});

export const startLocationTracking = async (
  shipmentUuid: string,
  intervalSeconds?: number
) => {

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  const currentActive = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);

  if (hasStarted && currentActive === shipmentUuid) {
    console.log(`[DollarTraq Tracker] 🛡️ Shield activated: Tracker is already running for ${shipmentUuid}. Ignoring duplicate start request.`);
    return; 
  }


  const savedIntervalStr = await AsyncStorage.getItem("trackingInterval");
  let activeInterval = intervalSeconds ?? (savedIntervalStr ? parseInt(savedIntervalStr, 10) : 300);

  console.log(`\n[DollarTraq Tracker] 🟢 INITIATING TRACKING for Shipment: ${shipmentUuid} at ${activeInterval}s intervals`);
  await AsyncStorage.setItem(ACTIVE_SHIPMENT_KEY, shipmentUuid);

  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    console.error("[DollarTraq Tracker] ❌ Foreground permission denied.");
    return;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    console.error("[DollarTraq Tracker] ❌ Background permission denied.");

    // 🚨 FIRE THE FLARE TO THE SERVER BEFORE ABORTING
    const token = await getAccessToken();
    const activeShipment = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);

    if (token && activeShipment) {
      console.log("[DollarTraq Tracker] 🚀 Firing alert flare to server...");
      fetch(LOCATION_PING_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shipment_uuid: activeShipment,
          locations: [{ lat: 0, lng: 0, device_timestamp: Date.now(), bg_permission: false }],
        }),
      })
        .then(async (res) => console.log("[DollarTraq Tracker] 🎯 Flare Response:", await res.text()))
        .catch((err) => console.error("[DollarTraq Tracker] ⚠️ Flare Error:", err));
    }
    return;
  }

  // FORCE INITIAL PING
  try {
    console.log("[DollarTraq Tracker] ⚡ Forcing immediate initial ping...");
    const initialLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const token = await getAccessToken();

    if (!token) {
      console.error("[DollarTraq Tracker] ❌ Auth token not found via getAccessToken!");
    } else {
      console.log("[DollarTraq Tracker] 🔑 Auth token found successfully.");

      const bgPerm = await Location.getBackgroundPermissionsAsync();

      const response = await fetch(LOCATION_PING_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          shipment_uuid: shipmentUuid,
          locations: [
            {
              lat: initialLoc.coords.latitude,
              lng: initialLoc.coords.longitude,
              accuracy: initialLoc.coords.accuracy,
              device_timestamp: Date.now(),
              is_mocked: initialLoc.mocked ?? false,
              bg_permission: bgPerm.status === "granted",
            },
          ],
        }),
      });

      if (response.ok) {
        // Mark Initial Sent Time
        await AsyncStorage.setItem(LAST_PING_SENT_KEY, Date.now().toString());

        const result = await response.json();
        console.log("[DollarTraq Tracker] ✅ Initial ping successful!");
        console.log("[DollarTraq Tracker] 📦 Server Response Payload:", JSON.stringify(result));

        const newInterval = extractInterval(result);

        if (newInterval && newInterval !== activeInterval) {
          console.log(`[DollarTraq Tracker] 🔄 Broker configured new interval: ${newInterval}s`);
          await AsyncStorage.setItem("trackingInterval", newInterval.toString());
          activeInterval = newInterval;
        } else if (!newInterval) {
          console.warn(
            "[DollarTraq Tracker] ⚠️ No interval key returned by server in ping response. Defaulting to active interval:",
            activeInterval
          );
        }
      } else {
        const resText = await response.text();
        console.warn(`[DollarTraq Tracker] ⚠️ Initial ping rejected. Status: ${response.status} - ${resText}`);
      }
    }
  } catch (err) {
    console.warn("[DollarTraq Tracker] ⚠️ Initial ping network error:", err);
  }

  // REGISTER BACKGROUND TASK
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: activeInterval * 1000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Active Load Tracking",
      notificationBody: "DollarTraq is sharing your location with the broker.",
      notificationColor: "#1E3A8A",
    },
  });

  console.log(`[DollarTraq Tracker] 🏃‍♂️ Background Task Registered running at ${activeInterval}s intervals.`);
};

const flushPendingLocations = async (): Promise<boolean> => {
  const storedQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
  const locationQueue = storedQueue ? JSON.parse(storedQueue) : [];

  if (locationQueue.length === 0) return true;

  const token = await getAccessToken();
  const shipmentUuid = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);

  if (!token || !shipmentUuid) return false;

  try {
    console.log(`[DollarTraq Tracker] 📤 Flushing ${locationQueue.length} queued location(s) before stopping...`);

    const response = await fetch(LOCATION_PING_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shipment_uuid: shipmentUuid,
        locations: locationQueue,
      }),
    });

    if (response.ok || response.status === 403) {
      await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
      return true;
    }

    console.warn(`[DollarTraq Tracker] ⚠️ Flush rejected (${response.status}); keeping queue for next attempt.`);
    return false;
  } catch (err) {
    console.warn("[DollarTraq Tracker] 📶 Flush failed, keeping queue.", err);
    return false;
  }
};

export const stopLocationTracking = async () => {
  console.log(`\n[DollarTraq Tracker] 🔴 STOPPING TRACKING. Cleaning up active tasks...`);
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("[DollarTraq Tracker] ✅ Background task terminated.");
  }

  const flushed = await flushPendingLocations();

  await AsyncStorage.removeItem(ACTIVE_SHIPMENT_KEY);
  await AsyncStorage.removeItem("trackingInterval");
  await AsyncStorage.removeItem(WAKE_STAMP_KEY);
  await AsyncStorage.removeItem(LAST_PING_SENT_KEY);

  if (flushed) {
    await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
  }

  console.log(
    `[DollarTraq Tracker] 🧹 Cleared active shipment and interval. Queue ${flushed ? "flushed" : "retained for retry"}.`
  );
};