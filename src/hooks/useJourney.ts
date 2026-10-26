import { api } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import { useCallback, useEffect, useRef, useState } from "react";

export interface JourneyData {
    id: number;
    shipment_id: number;
    driver_id: number;
    /**
     * One of the five step names the timeline knows, or "active" (started,
     * nothing done yet) and "completed". Typed loosely because the server
     * sends all of them.
     */
    current_step: string;
    shipper_arrival_lat: string | null;
    shipper_arrival_lng: string | null;
    shipper_arrived_at: string | null;
    shipper_otp: string | null;
    shipper_seal_number: string | null;
    loaded_at: string | null;
    receiver_arrival_lat: string | null;
    receiver_arrival_lng: string | null;
    receiver_arrived_at: string | null;
    receiver_otp: string | null;
    delivered_at: string | null;
    delivery_condition: string | null;
    pod_image_url: string | null;
    receiver_printed_name: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface JourneyResponse {
    status: boolean;
    message: string;
    data: {
        /** Also "not_started" or "active" when the driver has no journey yet. */
        current_step: string;
        journey: JourneyData | null;
        is_equipment_verified: boolean;
    };
}


const STEP_INDEX: Record<string, number> = {
    arrived_shipper: 1,
    loaded_shipper: 2,
    arrived_receiver: 3,
    delivered_receiver: 4,
    destination_arrival: 4,
    completed: 5, // all done
};

interface JourneyState {
    activeIndex: number;
    /** current_step as the server sent it, or null before the first answer. */
    currentStep: string | null;
    journey: JourneyData | null;

    /**
     * Whether the VIN, tractor and trailer photos are on file for this load.
     *
     * Comes from the server on every refresh rather than being remembered in
     * the app, so backgrounding or reloading does not lose it — and so the
     * app's idea of it cannot drift from what the API will actually allow.
     */
    equipmentVerified: boolean;

    /** True while this load's journey is being fetched, the first time or again. */
    loading: boolean;
    error: string | null;
    /** Fetch again. Resolves once that fetch has settled; never rejects. */
    refresh: () => Promise<void>;
}

interface JourneyFacts {
    /** The load these facts belong to. */
    uuid: string | null;
    activeIndex: number;
    currentStep: string | null;
    journey: JourneyData | null;
    equipmentVerified: boolean;
}

const EMPTY: Omit<JourneyFacts, "uuid"> = {
    activeIndex: 0,
    currentStep: null,
    journey: null,
    equipmentVerified: false,
};

/**
 * @param uuid  the load being driven; empty when there is none
 */
export function useJourney(uuid: string | null | undefined): JourneyState {
    const key = uuid || null;

    const [facts, setFacts] = useState<JourneyFacts>({ uuid: null, ...EMPTY });
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
    | Every fetch takes a number and only the newest may write. A fetch for a
    | load the screen has since left, or one overtaken by a refresh, just ends;
    | the newer one owns the spinner, so it always settles. The old
    | `if (!cancelled)` guard skipped resetting it, which left a full-screen
    | spinner up for good when the load went away mid-request.
    */
    const requestId = useRef(0);

    /* The request itself: state changes only once it settles, and only for the newest. */
    const fetchJourney = useCallback(async (id: number): Promise<void> => {
        if (!key) return;

        try {
            const res = await api.get<JourneyResponse>(`/shipments/${key}/journey`);
            if (id !== requestId.current) return;

            const step = res.data?.data?.current_step ?? null;
            setFacts({
                uuid: key,
                activeIndex: step ? (STEP_INDEX[step] ?? 0) : 0,
                currentStep: step,
                journey: res.data?.data?.journey ?? null,
                equipmentVerified: !!res.data?.data?.is_equipment_verified,
            });
        } catch (err: unknown) {
            if (id !== requestId.current) return;
            if (
                err &&
                typeof err === "object" &&
                "status" in err &&
                (err as { status: number }).status === 404
            ) {
                setFacts({ uuid: key, ...EMPTY });
            } else {
                setError(err instanceof Error ? err.message : "Failed to load journey");
                // Keep what this load already showed; a different load's facts never carry over.
                setFacts((prev) => (prev.uuid === key ? prev : { uuid: key, ...EMPTY }));
            }
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
        await fetchJourney(id);
    }, [key, fetchJourney]);

    useEffect(() => {
        const ids = requestId;
        void fetchJourney(++ids.current);
        return () => {
            // Leaving this load (or the screen): whatever is in flight for it may not write.
            ids.current++;
        };
    }, [fetchJourney]);

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

    /*
    | Read against the load being asked about, not the last one answered, so
    | the previous load's step is never shown, or acted on, for the next one,
    | not even for the render before its own fetch starts.
    */
    const fresh = facts.uuid === key;
    const view = fresh ? facts : EMPTY;

    return {
        activeIndex: view.activeIndex,
        currentStep: view.currentStep,
        journey: view.journey,
        equipmentVerified: view.equipmentVerified,
        loading: key ? !fresh || inFlight : false,
        error: fresh ? error : null,
        refresh: load,
    };
}
