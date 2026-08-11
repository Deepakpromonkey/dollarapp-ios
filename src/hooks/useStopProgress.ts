import { api } from "@/lib/api";
import type { StopEvent } from "@/types/shipment";
import { useCallback, useEffect, useState } from "react";

/**
 * The journey as a list of stops rather than five fixed steps.
 *
 * A load can have any number of stops, and each is driven the same way: arrive,
 * answer whatever the broker asked there, have the contact read out a code, move
 * on. The server decides which stop is next and what may be done at it, so the
 * app renders the same screen for a two-stop run and a six-stop one.
 */

/** What the driver can do at a stop right now. */
export type StopAction =
    | "arrive"
    | "answer_questions"
    | "verify_and_depart"
    | "complete_with_pod"
    | "waiting"
    | "done";

export interface StopProgress {
    stop_id: number;
    stop_number: number;
    stop_type: string;
    stop_name: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
    contact_name: string | null;
    comment_to_driver: string | null;

    is_final: boolean;
    otp_purpose: "load" | "delivery";

    arrived_at: string | null;
    otp_verified_at: string | null;
    completed_at: string | null;
    seal_number: string | null;
    delivery_condition: string | null;
    pod_image_url: string | null;
    receiver_printed_name: string | null;

    is_current: boolean;
    events: StopEvent[];
    events_outstanding: number;
    next_action: StopAction;
}

interface ProgressResponse {
    status: boolean;
    message: string;
    data: {
        is_activated: boolean;
        current_step: string;
        is_equipment_verified: boolean;
        current_stop_id: number | null;
        stops: StopProgress[];
    };
}

interface ProgressState {
    stops: StopProgress[];
    currentStopId: number | null;
    currentStop: StopProgress | null;
    isActivated: boolean;
    equipmentVerified: boolean;
    isComplete: boolean;
    loading: boolean;
    error: string | null;
    refresh: () => void;
    /** Adopts the stop list an action returned, saving a round trip. */
    apply: (stops: StopProgress[]) => void;
}

export function useStopProgress(uuid: string | null | undefined): ProgressState {
    const [stops, setStops] = useState<StopProgress[]>([]);
    const [currentStopId, setCurrentStopId] = useState<number | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [equipmentVerified, setEquipmentVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    const apply = useCallback((next: StopProgress[]) => {
        setStops(next);
        setCurrentStopId(next.find((s) => s.is_current)?.stop_id ?? null);
    }, []);

    useEffect(() => {
        if (!uuid) return;

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get<ProgressResponse>(
                    `/shipments/${uuid}/progress`,
                );
                if (cancelled) return;

                const data = res.data?.data;
                setStops(data?.stops ?? []);
                setCurrentStopId(data?.current_stop_id ?? null);
                setIsActivated(!!data?.is_activated);
                setEquipmentVerified(!!data?.is_equipment_verified);
            } catch (err: unknown) {
                if (cancelled) return;
                setError(
                    err instanceof Error ? err.message : "Could not load the journey",
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [uuid, tick]);

    return {
        stops,
        currentStopId,
        currentStop: stops.find((s) => s.stop_id === currentStopId) ?? null,
        isActivated,
        equipmentVerified,

        // No current stop on a load that has stops means every one is behind us.
        isComplete: stops.length > 0 && currentStopId === null,

        loading,
        error,
        refresh,
        apply,
    };
}
