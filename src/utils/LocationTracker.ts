import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking } from "react-native";
import { getAccessToken } from "@/lib/secureStore";

const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";
const LOCATION_QUEUE_KEY = "@offline_location_queue";
const ACTIVE_SHIPMENT_KEY = "@active_shipment_uuid";
const NGROK_URL = "https://mobility-twitter-tameness.ngrok-free.dev/api/driver/location-ping";

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

  return val ? parseInt(val) : null;
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[DollarTraq Tracker] ❌ Background Location Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];

    if (location) {
      const newPing = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        device_timestamp: Date.now(),
      };

      console.log(
        `\n[DollarTraq Tracker] 📡 GPS Wakeup at ${new Date().toLocaleTimeString()}`
      );
      console.log(
        `[DollarTraq Tracker] 📍 Captured coordinates: Lat ${newPing.lat}, Lng ${newPing.lng}`
      );

      try {
        const token = await getAccessToken();
        const shipmentUuid = await AsyncStorage.getItem(ACTIVE_SHIPMENT_KEY);

        if (!token || !shipmentUuid) {
          console.warn(
            `[DollarTraq Tracker] ⏸️ Skipped ping: Token missing (${!!token}) or Shipment UUID missing (${!!shipmentUuid})`
          );
          return;
        }

        const storedQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
        let locationQueue = storedQueue ? JSON.parse(storedQueue) : [];
        locationQueue.push(newPing);

        console.log(
          `[DollarTraq Tracker] 🚀 Sending ${locationQueue.length} location(s) to server...`
        );

        const response = await fetch(NGROK_URL, {
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
          console.log(
            `[DollarTraq Tracker] ✅ SUCCESS! Server accepted ${locationQueue.length} location(s).`
          );
          await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);

          const result = await response.json();
          const newInterval = extractInterval(result);

          const currentIntervalStr = await AsyncStorage.getItem("trackingInterval");
          const currentInterval = currentIntervalStr ? parseInt(currentIntervalStr) : 300;

          if (newInterval && newInterval !== currentInterval) {
            console.log(
              `[DollarTraq Tracker] 🔄 Broker updated interval to ${newInterval}s. Restarting tracker...`
            );
            await AsyncStorage.setItem("trackingInterval", newInterval.toString());
            startLocationTracking(shipmentUuid, newInterval);
          }
        } else if (response.status === 403) {
          console.warn(
            `[DollarTraq Tracker] 🛑 403 Forbidden: Tracking window hasn't opened yet. Wiping local queue.`
          );
          await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
        } else {
          const errText = await response.text();
          console.warn(
            `[DollarTraq Tracker] ⚠️ Server Error Status ${response.status}: ${errText}`
          );
          await AsyncStorage.setItem(
            LOCATION_QUEUE_KEY,
            JSON.stringify(locationQueue)
          );
        }
      } catch (err) {
        console.warn(
          `[DollarTraq Tracker] 📶 NETWORK ERROR/OFFLINE: Saving ping locally.`,
          err
        );
        const storedQueue = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
        let locationQueue = storedQueue ? JSON.parse(storedQueue) : [];

        if (
          !locationQueue.find(
            (p: any) => p.device_timestamp === newPing.device_timestamp
          )
        ) {
          locationQueue.push(newPing);
        }

        await AsyncStorage.setItem(
          LOCATION_QUEUE_KEY,
          JSON.stringify(locationQueue)
        );
      }
    }
  }
});

export const startLocationTracking = async (
  shipmentUuid: string,
  intervalSeconds = 300
) => {
  const savedIntervalStr = await AsyncStorage.getItem("trackingInterval");
  let activeInterval = savedIntervalStr
    ? parseInt(savedIntervalStr)
    : intervalSeconds;

  console.log(
    `\n[DollarTraq Tracker] 🟢 INITIATING TRACKING for Shipment: ${shipmentUuid} at ${activeInterval}s intervals`
  );
  await AsyncStorage.setItem(ACTIVE_SHIPMENT_KEY, shipmentUuid);

  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    console.error("[DollarTraq Tracker] ❌ Foreground permission denied.");
    return;
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    console.error("[DollarTraq Tracker] ❌ Background permission denied.");
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
      console.error(
        "[DollarTraq Tracker] ❌ Auth token not found via getAccessToken!"
      );
    } else {
      console.log("[DollarTraq Tracker] 🔑 Auth token found successfully.");
      const response = await fetch(NGROK_URL, {
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
            },
          ],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[DollarTraq Tracker] ✅ Initial ping successful!");
        console.log("[DollarTraq Tracker] 📦 Server Response Payload:", JSON.stringify(result));

        const newInterval = extractInterval(result);

        if (newInterval && newInterval !== activeInterval) {
          console.log(
            `[DollarTraq Tracker] 🔄 Broker configured new interval: ${newInterval}s`
          );
          await AsyncStorage.setItem("trackingInterval", newInterval.toString());
          activeInterval = newInterval;
        } else if (!newInterval) {
          console.warn(
            "[DollarTraq Tracker] ⚠️ No interval key returned by server in ping response. Defaulting to active interval:", activeInterval
          );
        }
      } else {
        const resText = await response.text();
        console.warn(
          `[DollarTraq Tracker] ⚠️ Initial ping rejected. Status: ${response.status} - ${resText}`
        );
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

  console.log(
    `[DollarTraq Tracker] 🏃‍♂️ Background Task Registered running at ${activeInterval}s intervals.`
  );
};

export const stopLocationTracking = async () => {
  console.log(
    `\n[DollarTraq Tracker] 🔴 STOPPING TRACKING. Cleaning up active tasks...`
  );
  const hasStarted =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("[DollarTraq Tracker] ✅ Background task terminated.");
  }

  await AsyncStorage.removeItem(ACTIVE_SHIPMENT_KEY);
  await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
  await AsyncStorage.removeItem("trackingInterval");
  console.log(
    "[DollarTraq Tracker] 🧹 Cleared active shipment UUID, tracking interval, and wiped queue."
  );
};