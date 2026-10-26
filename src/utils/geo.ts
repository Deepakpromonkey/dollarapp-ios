/*
| Distances, without pretending to more precision than we have.
|
| Nothing in the system knows road distance: the broker never enters miles and
| no routing service is wired up. What we do have is each stop's coordinates,
| so distances here are straight lines stretched by a road factor and always
| shown as an estimate ("≈"), never as pay miles.
*/

export interface Coord {
  latitude: number;
  longitude: number;
}

/**
 * A position worth using, or null.
 *
 * Coordinates arrive from the API as strings and are not always real: blank, or
 * the "0","0" the API puts in place of a stop that was never located. Number("")
 * is 0 and "0" is a truthy string, so both used to slip through checks and draw
 * a line to the Gulf of Guinea. Same rule as arrivalAlerts.buildRegions.
 */
export function toCoord(lat: unknown, lng: unknown): Coord | null {
  const rawLat = String(lat ?? "").trim();
  const rawLng = String(lng ?? "").trim();
  if (rawLat === "" || rawLng === "") return null;

  const latitude = Number(rawLat);
  const longitude = Number(rawLng);

  const usable =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0);

  return usable ? { latitude, longitude } : null;
}

/** A stop's position, or null when it cannot be placed. */
export function stopCoord(stop?: { latitude?: unknown; longitude?: unknown } | null): Coord | null {
  return stop ? toCoord(stop.latitude, stop.longitude) : null;
}

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;

/** Great-circle distance in meters. */
export function haversineMeters(a: Coord, b: Coord): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Great-circle distance in miles. */
export function haversineMiles(a: Coord, b: Coord): number {
  return haversineMeters(a, b) / METERS_PER_MILE;
}

/*
| Roads are longer than straight lines; 1.2 is a common planning rule of thumb
| for highway freight (it runs higher around water and mountains). Applied in
| one place so every estimate in the app stretches by the same amount.
*/
export const ROAD_FACTOR = 1.2;

/**
 * Straight-line miles through the stops in order, or null when fewer than two
 * stops or ANY stop cannot be placed — a partial sum would understate the route
 * and read as a real number.
 */
export function straightLineMiles(
  stops: { stop_number: number | string; latitude?: unknown; longitude?: unknown }[],
): number | null {
  const points = [...stops]
    .sort((a, b) => Number(a.stop_number) - Number(b.stop_number))
    .map((s) => toCoord(s.latitude, s.longitude));

  if (points.length < 2 || points.some((p) => p === null)) return null;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMiles(points[i - 1]!, points[i]!);
  }
  return total;
}

/** Estimated road miles through the stops in order, or null when it cannot be worked out. */
export function estimatedRouteMiles(
  stops: { stop_number: number | string; latitude?: unknown; longitude?: unknown }[],
): number | null {
  const miles = straightLineMiles(stops);
  return miles === null ? null : miles * ROAD_FACTOR;
}

/** "0.4 mi", "8.2 mi", "1,234 mi". Manual separators: Intl number formatting is not guaranteed on this Hermes build. */
export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "—";
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${String(Math.round(miles)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} mi`;
}

/** "45 min", "6 h 52 min", "2 h". */
export function formatDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "—";
  const minutes = Math.round(totalMinutes);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
