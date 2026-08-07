import { api } from "@/lib/api";
import type { Shipment, ShipmentsResponse } from "@/types/shipment";
import { useCallback, useEffect, useState } from "react";

interface ShipmentsState {
    active: Shipment[];
    upcoming: Shipment[];
    past: Shipment[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useShipments(): ShipmentsState {
    const [active, setActive] = useState<Shipment[]>([]);
    const [upcoming, setUpcoming] = useState<Shipment[]>([]);
    const [past, setPast] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let cancelled = false;

        async function fetch() {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get<ShipmentsResponse>("/shipments");
                if (cancelled) return;

                const data = res.data?.data ?? [];
                setActive(data.filter((s) => s.status === "Active"));
                setUpcoming(data.filter((s) => s.status === "Upcoming"));
                setPast(data.filter((s) => s.status === "Past"));
            } catch (err: unknown) {
                if (cancelled) return;
                const msg =
                    err instanceof Error
                        ? err.message
                        : "Failed to load shipments";
                setError(msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetch();
        return () => {
            cancelled = true;
        };
    }, [tick]);

    return { active, upcoming, past, loading, error, refresh };
}
