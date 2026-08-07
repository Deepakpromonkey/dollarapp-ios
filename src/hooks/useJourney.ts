import { TripStepId } from "@/components/tripsteps/types";
import { api } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

export interface JourneyData {
    id: number;
    shipment_id: number;
    driver_id: number;
    current_step: TripStepId;
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
        current_step: TripStepId;
        journey: JourneyData;
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
    journey: JourneyData | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * @param uuid  
 */
export function useJourney(uuid: string | null | undefined): JourneyState {
    const [activeIndex, setActiveIndex] = useState(0);
    const [journey, setJourney] = useState<JourneyData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        if (!uuid) return;

        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get<JourneyResponse>(
                    `/shipments/${uuid}/journey`,
                );
                if (cancelled) return;

                const step = res.data?.data?.current_step;
                const idx = step !== undefined ? (STEP_INDEX[step] ?? 0) : 0;

                setActiveIndex(idx);
                setJourney(res.data?.data?.journey ?? null);
            } catch (err: unknown) {
                if (cancelled) return;
                if (
                    err &&
                    typeof err === "object" &&
                    "status" in err &&
                    (err as { status: number }).status === 404
                ) {
                    setActiveIndex(0);
                    setJourney(null);
                } else {
                    const msg =
                        err instanceof Error
                            ? err.message
                            : "Failed to load journey";
                    setError(msg);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [uuid, tick]);

    return { activeIndex, journey, loading, error, refresh };
}
