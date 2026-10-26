import { orderedStops } from "@/utils/stops";

/*
| The one-word status on the trip card.
|
| It used to say IN TRANSIT whatever was happening: before the load was
| started, while the driver sat at the dock, and after delivery. It is now
| worked out from the per-stop progress (/progress), which knows about every
| stop. The five-step journey is only a fallback while progress loads, because
| it maps just the first and last stops and cannot see the ones in between.
*/

export type TripBadgeTone = "neutral" | "primary" | "success";

export interface TripBadge {
  label: string;
  tone: TripBadgeTone;
}

/** The parts of a /progress stop this needs. */
export interface BadgeStop {
  stop_number: number | string;
  is_current: boolean;
  is_final?: boolean;
  arrived_at: string | null;
}

export interface TripBadgeInput {
  /** The driver has started this load (a journey exists for it). */
  isActivated: boolean;
  /** Stops from /progress, in any order. Empty while it loads. */
  progress: BadgeStop[];
  /** current_step from the journey, e.g. "arrived_shipper" or "completed". */
  journeyStep?: string | null;
  /** Every stop is finished, by whichever source noticed first. */
  complete?: boolean;
}

const DELIVERED: TripBadge = { label: "DELIVERED", tone: "success" };
const NOT_STARTED: TripBadge = { label: "NOT STARTED", tone: "neutral" };
const TO_PICKUP: TripBadge = { label: "TO PICKUP", tone: "primary" };
const AT_PICKUP: TripBadge = { label: "AT PICKUP", tone: "primary" };
const IN_TRANSIT: TripBadge = { label: "IN TRANSIT", tone: "primary" };
const AT_DELIVERY: TripBadge = { label: "AT DELIVERY", tone: "primary" };

export function tripBadge({
  isActivated,
  progress,
  journeyStep,
  complete = false,
}: TripBadgeInput): TripBadge {
  if (complete || journeyStep === "completed") return DELIVERED;
  if (!isActivated) return NOT_STARTED;

  const stops = orderedStops(progress);

  if (stops.length > 0) {
    const index = stops.findIndex((s) => s.is_current);

    // No current stop on a load that has stops means every one is behind us.
    if (index === -1) return DELIVERED;

    const current = stops[index];
    const arrived = !!current.arrived_at;

    if (index === 0) return arrived ? AT_PICKUP : TO_PICKUP;
    if (current.is_final || index === stops.length - 1) {
      return arrived ? AT_DELIVERY : IN_TRANSIT;
    }
    return arrived ? { label: `AT STOP ${index + 1}`, tone: "primary" } : IN_TRANSIT;
  }

  switch (journeyStep) {
    case "arrived_shipper":
      return AT_PICKUP;
    case "loaded_shipper":
      return IN_TRANSIT;
    case "arrived_receiver":
    case "delivered_receiver":
      return AT_DELIVERY;
    default:
      return TO_PICKUP;
  }
}
