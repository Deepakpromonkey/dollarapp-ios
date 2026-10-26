import { type Coord, haversineMiles, ROAD_FACTOR } from "@/utils/geo";

/*
| A rough "when will I get there" for the trip screen.
|
| There is no routing service behind this: it is the straight line from the
| driver to the stop, stretched by the same road factor every estimate in the
| app uses, at a flat speed. That is good enough to tell a driver whether they
| are comfortably early or cutting it fine, and it is always shown with "≈" so
| nobody reads it as a promise. It knows nothing about traffic or breaks.
*/

/*
| The last few miles into a stop are local roads and yards; everything before
| them is mostly highway. 50 mph is a common planning figure for a loaded truck
| once stops, lights and slow-downs are averaged in.
|
| Each stretch is timed at its own speed. Picking one speed for the whole trip
| by its length made the estimate jump about 12 minutes later at the 10-mile
| mark, while the truck was getting closer, and flip the ON TIME pill with it.
*/
const LOCAL_MPH = 25;
const HIGHWAY_MPH = 50;
const LOCAL_RADIUS_MILES = 10;

/*
| How far either side of the appointment still counts. Projected more than
| this early is ON TIME, within it AT RISK, beyond it LATE; an arrival within
| it after the appointment is still ARRIVED ON TIME.
*/
export const PUNCTUALITY_GRACE_MINUTES = 15;

export interface ArrivalEstimate {
  /** Estimated road miles to the stop. */
  miles: number;
  /** Estimated driving minutes to the stop. */
  minutes: number;
  /** When the driver should get there at that pace. */
  eta: Date;
}

/** An estimate from here to the stop, or null without a GPS fix or the stop's position. */
export function estimateArrival(
  from: Coord | null | undefined,
  to: Coord | null | undefined,
  now: number = Date.now(),
): ArrivalEstimate | null {
  if (!from || !to) return null;

  const miles = haversineMiles(from, to) * ROAD_FACTOR;
  const localMiles = Math.min(miles, LOCAL_RADIUS_MILES);
  const highwayMiles = Math.max(0, miles - LOCAL_RADIUS_MILES);
  const minutes = (localMiles / LOCAL_MPH + highwayMiles / HIGHWAY_MPH) * 60;

  return { miles, minutes, eta: new Date(now + minutes * 60_000) };
}

export type Punctuality = "on_time" | "at_risk" | "late" | "arrived_on_time" | "arrived_late";

export interface PunctualityInput {
  /** The stop's appointment as an exact instant. */
  appointment: Date | null;
  /** The estimated arrival, when there is one. */
  eta: Date | null;
  /** When the driver actually arrived, once they have. */
  arrivedAt: Date | null;
}

/** How the driver stands against the appointment, or null when there is nothing honest to say. */
export function punctuality({ appointment, eta, arrivedAt }: PunctualityInput): Punctuality | null {
  if (!appointment) return null;

  const grace = PUNCTUALITY_GRACE_MINUTES * 60_000;
  const due = appointment.getTime();

  if (arrivedAt) {
    return arrivedAt.getTime() <= due + grace ? "arrived_on_time" : "arrived_late";
  }

  if (!eta) return null;

  const at = eta.getTime();
  if (at <= due - grace) return "on_time";
  if (at <= due + grace) return "at_risk";
  return "late";
}

/** An ISO 8601 string from the API as a Date, or null when missing or unreadable. */
export function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "09:40 AM" in the phone's own time and 12/24-hour setting (the same call the chat screen uses). */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Like formatClock, with the day in front when it is not today: "Oct 14, 09:40 AM". */
export function formatDayClock(date: Date, now: number = Date.now()): string {
  const clock = formatClock(date);
  if (new Date(now).toDateString() === date.toDateString()) return clock;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${clock}`;
}

/*
| Fixed English names rather than the phone's locale: the card around them is
| in English, and a locale's "short" weekday can run longer than three letters,
| which is all the narrow ETA column has room for.
*/
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Whole calendar days from `now`'s date to `date`'s, in the phone's time zone. */
function calendarDaysBetween(now: Date, date: Date): number {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  // Rounded, because a day with a daylight-saving change is 23 or 25 hours long.
  return Math.round((to - from) / 86_400_000);
}

/**
 * Like formatClock, with the weekday in front when it is not today:
 * "Thu 12:48 PM". Shorter than formatDayClock, for a narrow column. A week or
 * more away (or in the past), where a weekday alone would be ambiguous, it
 * falls back to formatDayClock's date.
 */
export function formatWeekdayClock(date: Date, now: number = Date.now()): string {
  const days = calendarDaysBetween(new Date(now), date);
  if (days === 0) return formatClock(date);
  if (days < 0 || days > 6) return formatDayClock(date, now);
  return `${WEEKDAYS[date.getDay()]} ${formatClock(date)}`;
}
