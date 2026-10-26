import type { ShipmentStop } from "@/types/shipment";

/*
| One place that decides which stop is which.
|
| The trip screen, load detail and the loads list each picked the pickup and the
| delivery with their own `stops.find(...)`. That took the FIRST delivery on a
| multi-drop load, and nothing at all when a stop's type was spelt differently,
| which hid the whole trip card. These mirror the API's own rules
| (ShipmentController::pickupStop / deliveryStop): the first Pickup, else the
| first stop; the last Delivery, else the last stop.
*/

type Typed = { stop_number: number | string; stop_type?: string | null };

const isType = (stop: { stop_type?: string | null }, type: "pickup" | "delivery") =>
  (stop.stop_type ?? "").trim().toLowerCase() === type;

/** Stops in driving order. Never mutates the input. */
export function orderedStops<T extends { stop_number: number | string }>(
  stops?: T[] | null,
): T[] {
  return [...(stops ?? [])].sort((a, b) => Number(a.stop_number) - Number(b.stop_number));
}

/** The first pickup, or the first stop when none is typed as a pickup. */
export function originStop<T extends Typed>(stops?: T[] | null): T | undefined {
  const ordered = orderedStops(stops);
  return ordered.find((s) => isType(s, "pickup")) ?? ordered[0];
}

/** The final delivery, or the last stop when none is typed as a delivery. */
export function destinationStop<T extends Typed>(stops?: T[] | null): T | undefined {
  const ordered = orderedStops(stops);
  // A backwards loop rather than findLast, which this Hermes build may not have.
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (isType(ordered[i], "delivery")) return ordered[i];
  }
  return ordered[ordered.length - 1];
}

/** "Gurugram, HR", leaving out whichever half is missing (never "null, null"). */
export function cityState(stop?: { city?: string | null; state?: string | null } | null): string {
  return [stop?.city, stop?.state]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * The best one-line name for a stop: the facility name the broker typed, else
 * the city, else the street, else its number. Two stops in the same city used
 * to render identically because only city and state were ever shown.
 */
export function stopTitle(stop?: Partial<ShipmentStop> | null): string {
  if (!stop) return "—";
  return (
    stop.stop_name?.trim() ||
    cityState(stop) ||
    stop.address?.split(",")[0]?.trim() ||
    (stop.stop_number != null ? `Stop ${stop.stop_number}` : "Stop")
  );
}

/** A second line that adds what the title left out, or "" when there is nothing to add. */
export function stopSubtitle(stop?: Partial<ShipmentStop> | null): string {
  if (!stop) return "";
  const place = cityState(stop);
  if (stop.stop_name?.trim()) return place || stop.address?.trim() || "";
  if (place) return stop.address?.trim() || "";
  return "";
}

export interface StopAppointment {
  /** The exact instant, when the API could work out the stop's timezone. */
  at: Date | null;
  date: string | null;
  time: string | null;
  /** The broker's timezone label, e.g. "Eastern" or "India". */
  timezone: string | null;
}

/**
 * When the driver is expected at a stop.
 *
 * The broker saves the pickup's time in start_* and every later stop's in
 * end_*, so reading start_* everywhere left every delivery time blank. The API
 * also sends `appointment_at` (ISO 8601 with offset) when it can resolve the
 * stop's timezone label; only that becomes an exact `at`, because the labels
 * ("Eastern", "India") cannot be turned into an instant reliably on the phone.
 */
export function stopAppointment(stop?: Partial<ShipmentStop> | null): StopAppointment {
  if (!stop) return { at: null, date: null, time: null, timezone: null };

  const pickup = isType(stop, "pickup");
  const date = (pickup ? stop.start_date || stop.end_date : stop.end_date || stop.start_date) || null;
  const time = (pickup ? stop.start_time || stop.end_time : stop.end_time || stop.start_time) || null;
  const timezone =
    (pickup ? stop.start_timezone || stop.end_timezone : stop.end_timezone || stop.start_timezone) ||
    null;

  let at: Date | null = null;
  if (stop.appointment_at) {
    const parsed = new Date(stop.appointment_at);
    at = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return { at, date, time, timezone };
}
