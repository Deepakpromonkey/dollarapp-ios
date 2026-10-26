import { api } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import type { StopEvent } from "@/types/shipment";
import { useCallback, useEffect, useRef, useState } from "react";

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

    /** Whether the dock must give the driver a code before this stop can be completed. */
    requires_otp: boolean;
    /** The appointment as an exact instant (ISO 8601 with offset), or null when unknown. */
    appointment_at?: string | null;

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
    /** True while this load's progress is being fetched, the first time or again. */
    loading: boolean;
    error: string | null;
    /** Fetch again. Resolves once that fetch has settled; never rejects. */
    refresh: () => Promise<void>;
    /** Adopts the stop list an action returned, saving a round trip. */
    apply: (stops: StopProgress[]) => void;
}

interface ProgressFacts {
    /** The load these facts belong to. */
    uuid: string | null;
    stops: StopProgress[];
    currentStopId: number | null;
    isActivated: boolean;
    equipmentVerified: boolean;
}

const EMPTY: Omit<ProgressFacts, "uuid"> = {
    stops: [],
    currentStopId: null,
    isActivated: false,
    equipmentVerified: false,
};

export function useStopProgress(uuid: string | null | undefined): ProgressState {
    const key = uuid || null;

    const [facts, setFacts] = useState<ProgressFacts>({ uuid: null, ...EMPTY });
    const [inFlight, setInFlight] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /*
    | A different load: the spinner and error belong to it, not the last one.
    | Adjusted while rendering, so the fetch effect below only has to start the
    | request and never sets state before it settles.
    */
    const [shownKey, setShownKey] = useState(key);
    if (shownKey !== key) {
        setShownKey(key);
        setInFlight(key !== null);
        setError(null);
        if (key === null) setFacts({ uuid: null, ...EMPTY });
    }

    /*
    | Every fetch takes a number and only the newest may write, so a fetch for
    | a load the screen has left, or one overtaken by a refresh, cannot land
    | its stops (and their ids, which the action buttons post) on another load.
    | The newest fetch also owns the spinner, so loading always settles.
    */
    const requestId = useRef(0);

    /* The request itself: state changes only once it settles, and only for the newest. */
    const fetchProgress = useCallback(async (id: number): Promise<void> => {
        if (!key) return;

        try {
            const res = await api.get<ProgressResponse>(`/shipments/${key}/progress`);
            if (id !== requestId.current) return;

            const data = res.data?.data;
            setFacts({
                uuid: key,
                stops: data?.stops ?? [],
                currentStopId: data?.current_stop_id ?? null,
                isActivated: !!data?.is_activated,
                equipmentVerified: !!data?.is_equipment_verified,
            });
        } catch (err: unknown) {
            if (id !== requestId.current) return;
            setError(err instanceof Error ? err.message : "Could not load the journey");
            // Keep what this load already showed; a different load's stops never carry over.
            setFacts((prev) => (prev.uuid === key ? prev : { uuid: key, ...EMPTY }));
        } finally {
            if (id === requestId.current) setInFlight(false);
        }
    }, [key]);

    const load = useCallback(async (): Promise<void> => {
        const id = ++requestId.current;

        if (!key) {
            setFacts({ uuid: null, ...EMPTY });
            setInFlight(false);
            setError(null);
            return;
        }

        setInFlight(true);
        setError(null);
        await fetchProgress(id);
    }, [key, fetchProgress]);

    useEffect(() => {
        const ids = requestId;
        void fetchProgress(++ids.current);
        return () => {
            // Leaving this load (or the screen): whatever is in flight for it may not write.
            ids.current++;
        };
    }, [fetchProgress]);

    const apply = useCallback(
        (next: StopProgress[]) => {
            if (!key) return;
            /*
            | The action's answer is newer than any fetch still in flight, which
            | may have been sent before the action and would put the stop back.
            */
            requestId.current++;
            setInFlight(false);
            setFacts((prev) => ({
                ...(prev.uuid === key ? prev : { ...EMPTY }),
                uuid: key,
                stops: next,
                currentStopId: next.find((s) => s.is_current)?.stop_id ?? null,
            }));
        },
        [key],
    );

    // Re-subscribed per load, so each listener works on the load being shown.
    useEffect(() => {
        const offTrip = onInvalidate("trip", () => {
            load();
        });
        const offSession = onInvalidate("session", () => {
            requestId.current++;
            setFacts({ uuid: key, ...EMPTY });
            setInFlight(false);
            setError(null);
        });
        return () => {
            offTrip();
            offSession();
        };
    }, [load, key]);

    // Read against the load being asked about, so the previous load's stops never show for the next.
    const fresh = facts.uuid === key;
    const view = fresh ? facts : EMPTY;

    return {
        stops: view.stops,
        currentStopId: view.currentStopId,
        currentStop: view.stops.find((s) => s.stop_id === view.currentStopId) ?? null,
        isActivated: view.isActivated,
        equipmentVerified: view.equipmentVerified,

        // No current stop on a load that has stops means every one is behind us.
        isComplete: view.stops.length > 0 && view.currentStopId === null,

        loading: key ? !fresh || inFlight : false,
        error: fresh ? error : null,
        refresh: load,
        apply,
    };
}
