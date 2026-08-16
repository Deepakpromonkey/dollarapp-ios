// import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as BackgroundFetch from "expo-background-fetch";
// import * as Location from "expo-location";
// import * as TaskManager from "expo-task-manager";
// import { AppState, Platform } from "react-native";


// export const LOCATION_TASK_NAME = "dt-background-location";
// export const BG_FETCH_TASK_NAME = "dt-bg-fetch-location";

// const STORAGE_KEY = "dt_location_log";
// const INTERVAL_MS = 5 * 60 * 1000; 


// export interface LocationEntry {
//     timestamp: number;    
//     lat: number;
//     lng: number;
//     accuracy: number | null;
//     synced: boolean;         
// }


// export async function readLog(): Promise<LocationEntry[]> {
//     try {
//         const raw = await AsyncStorage.getItem(STORAGE_KEY);
//         return raw ? (JSON.parse(raw) as LocationEntry[]) : [];
//     } catch {
//         return [];
//     }
// }

// export async function appendEntry(entry: LocationEntry): Promise<void> {
//     const log = await readLog();
//     log.push(entry);
//     await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
// }

// export async function markSynced(timestamps: number[]): Promise<void> {
//     const log = await readLog();
//     const set = new Set(timestamps);
//     const updated = log.map((e) => (set.has(e.timestamp) ? { ...e, synced: true } : e));
//     await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
// }

// export async function pruneOldEntries(maxAgeDays = 7): Promise<void> {
//     const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
//     const log = await readLog();
//     const trimmed = log.filter((e) => !e.synced || e.timestamp > cutoff);
//     await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
// }

// export async function clearLog(): Promise<void> {
//     await AsyncStorage.removeItem(STORAGE_KEY);
// }


// async function captureAndSave(): Promise<LocationEntry | null> {
//     try {
//         const { status } = await Location.getForegroundPermissionsAsync();
//         if (status !== Location.PermissionStatus.GRANTED) return null;

//         const loc = await Location.getCurrentPositionAsync({
//             accuracy: Location.Accuracy.Balanced,
//         });

//         const entry: LocationEntry = {
//             timestamp: loc.timestamp,
//             lat: loc.coords.latitude,
//             lng: loc.coords.longitude,
//             accuracy: loc.coords.accuracy,
//             synced: false,
//         };

//         await appendEntry(entry);
//         // console.log("[LocationTracking] Saved:", entry.lat, entry.lng, new Date(entry.timestamp).toISOString());
//         return entry;
//     } catch (err) {
//         console.warn("[LocationTracking] captureAndSave failed:", err);
//         return null;
//     }
// }

// TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
//     if (error) {
//         console.warn("[LocationTask] Error:", error.message);
//         return;
//     }

//     const locations = data?.locations;
//     if (!locations || locations.length === 0) return;

//     const loc = locations[locations.length - 1];
//     const entry: LocationEntry = {
//         timestamp: loc.timestamp,
//         lat: loc.coords.latitude,
//         lng: loc.coords.longitude,
//         accuracy: loc.coords.accuracy,
//         synced: false,
//     };

//     await appendEntry(entry);
//     // console.log("[LocationTask] Background saved:", entry.lat, entry.lng);
// });


// TaskManager.defineTask(BG_FETCH_TASK_NAME, async () => {
//     try {
//         const entry = await captureAndSave();
//         return entry
//             ? BackgroundFetch.BackgroundFetchResult.NewData
//             : BackgroundFetch.BackgroundFetchResult.NoData;
//     } catch {
//         return BackgroundFetch.BackgroundFetchResult.Failed;
//     }
// });



// export async function startBackgroundTracking(): Promise<boolean> {
//     try {
      
//         const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
//         if (bgStatus !== Location.PermissionStatus.GRANTED) {
//             console.warn("[LocationTracking] Background permission denied");
        
//         }

    
//         const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
//         if (!alreadyRunning) {
//             await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
//                 accuracy: Location.Accuracy.Balanced,
//                 timeInterval: INTERVAL_MS,
//                 distanceInterval: 0,               
//                 deferredUpdatesInterval: INTERVAL_MS,
//                 deferredUpdatesDistance: 0,
//                 pausesUpdatesAutomatically: false,
//                 showsBackgroundLocationIndicator: true, 
//                 foregroundService: {               
//                     notificationTitle: "DollarTraq",
//                     notificationBody: "Tracking your trip location",
//                     notificationColor: "#1D4ED8",
//                 },
//                 activityType: Location.ActivityType.AutomotiveNavigation,
//             });
//             console.log("[LocationTracking] Background location started");
//         }

//         if (Platform.OS === "ios") {
//             await BackgroundFetch.registerTaskAsync(BG_FETCH_TASK_NAME, {
//                 minimumInterval: 5 * 60, 
//                 stopOnTerminate: false,
//                 startOnBoot: true,
//             }).catch(() => {}); 
//         }

//         return true;
//     } catch (err) {
//         console.error("[LocationTracking] startBackgroundTracking failed:", err);
//         return false;
//     }
// }

// export async function stopBackgroundTracking(): Promise<void> {
//     try {
//         const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
//         if (running) {
//             await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
//             console.log("[LocationTracking] Background location stopped");
//         }

//         if (Platform.OS === "ios") {
//             await BackgroundFetch.unregisterTaskAsync(BG_FETCH_TASK_NAME).catch(() => {});
//         }
//     } catch (err) {
//         console.warn("[LocationTracking] stopBackgroundTracking error:", err);
//     }
// }



// let _fgTimer: ReturnType<typeof setInterval> | null = null;


// export function startForegroundInterval(): void {
//     if (_fgTimer) return;
//     captureAndSave();
//     _fgTimer = setInterval(() => {
//         captureAndSave();
//     }, INTERVAL_MS);
//     console.log("[LocationTracking] Foreground interval started");
// }

// export function stopForegroundInterval(): void {
//     if (_fgTimer) {
//         clearInterval(_fgTimer);
//         _fgTimer = null;
//         console.log("[LocationTracking] Foreground interval stopped");
//     }
// }



// let _appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

// export function attachAppStateListener(): void {
//     if (_appStateSubscription) return;
//     _appStateSubscription = AppState.addEventListener("change", (nextState) => {
//         if (nextState === "active") {
//             startForegroundInterval();
//         } else {
//             stopForegroundInterval();
//         }
//     });
// }

// export function detachAppStateListener(): void {
//     _appStateSubscription?.remove();
//     _appStateSubscription = null;
// }
