import "expo-router/entry";

/*
| Background tasks are defined here, from the entry, not from a screen.
|
| When iOS relaunches the app in the background for a geofence crossing or a
| location update, it runs the JavaScript without drawing anything. Expo Router
| only loads src/app/_layout.tsx when it draws a screen, so a task defined only
| from there would not exist in that wake-up, and expo-task-manager treats an
| event for an undefined task as a task that was removed and unregisters it.
| That would switch the arrival geofences, or the tracker, off in the middle of
| a load. Imported here, both are defined on every start, screen or no screen.
*/
import "./src/utils/LocationTracker";
import "./src/utils/arrivalAlerts";
