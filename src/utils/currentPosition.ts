import * as Location from "expo-location";

const FIX_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

export const NO_POSITION_MESSAGE =
  "Couldn't get your location. Move somewhere with a clearer view of the sky and try again.";

/*
 * getCurrentPositionAsync has no timeout of its own. Indoors or under a weak
 * sky an iPhone can take minutes or never answer, which left buttons such as
 * "Arrived at Shipper" spinning forever. The live fix gets a deadline, then a
 * recent fix the phone already holds stands in. Null means neither exists.
 */
export async function getPositionWithin(
  accuracy: Location.Accuracy = Location.Accuracy.High,
): Promise<Location.LocationObject | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fresh = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), FIX_TIMEOUT_MS);
    }),
  ])
    .catch(() => null)
    .finally(() => clearTimeout(timer));

  if (fresh) {
    return fresh;
  }

  return Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
}

export type LocationAccess = "ok" | "denied" | "services_off";

/*
| Location for a one-off action such as marking arrival.
|
| Checks first, and asks only while iOS will still show its prompt; once the
| driver has declined, the answer is "denied" with no second request. It never
| asks for "Always": the trip screen's tracking owns that, and a driver checking
| in at a dock needs nothing more than "While Using".
|
| Callers show a static message for "denied" and "services_off". Neither result
| may lead to an alert or an automatic trip to Settings (App Review 5.1.1(iv)).
*/
export async function ensureForegroundLocation(): Promise<LocationAccess> {
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled) return "services_off";

  const current = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (current?.granted) return "ok";
  if (current && current.status === Location.PermissionStatus.DENIED && !current.canAskAgain) {
    return "denied";
  }

  const requested = await Location.requestForegroundPermissionsAsync().catch(() => null);
  return requested?.granted ? "ok" : "denied";
}
