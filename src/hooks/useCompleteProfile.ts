import { useCallback, useEffect, useRef, useState } from "react";
import { driverApi, VerifiedEquipment } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import { friendlyError } from "@/lib/loadApi";

/*
| The driver's equipment photo history (GET /driver/complete-profile).
|
| Fetched on mount, and again whenever the profile is invalidated (a new set
| of equipment photos was just submitted). `isLoading` covers only the first
| fetch: a later one keeps the history on screen, and if it fails the reason
| is reported in `error` alongside what is already shown.
*/

type HistoryResult = { history: VerifiedEquipment[] } | { error: string };

/* Never rejects: a failure comes back as the message to show. */
async function fetchHistory(): Promise<HistoryResult> {
    try {
        const response = await driverApi.getCompleteProfile();
        const history = response.data?.data?.verified_equipment_history;
        if (!Array.isArray(history)) {
            return { error: "The server sent an answer the app could not read. Try again." };
        }
        return { history };
    } catch (err: unknown) {
        return { error: friendlyError(err, "Could not load your equipment history.") };
    }
}

export function useCompleteProfile() {
    const [equipmentHistory, setEquipmentHistory] = useState<VerifiedEquipment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* Only the newest request may write: an older one that finishes late is dropped. */
    const requestId = useRef(0);

    const apply = useCallback((id: number, result: HistoryResult) => {
        if (id !== requestId.current) return;
        if ("history" in result) {
            setEquipmentHistory(result.history);
            setError(null);
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    }, []);

    const refetch = useCallback(async () => {
        const id = ++requestId.current;
        apply(id, await fetchHistory());
    }, [apply]);

    useEffect(() => {
        const id = ++requestId.current;
        fetchHistory().then((result) => apply(id, result));

        const stopProfile = onInvalidate("profile", () => {
            refetch();
        });

        // Signed out: drop this driver's photos, and anything still on its way.
        const stopSession = onInvalidate("session", () => {
            requestId.current += 1;
            setEquipmentHistory([]);
            setError(null);
            setIsLoading(true);
        });

        return () => {
            stopProfile();
            stopSession();
            requestId.current += 1;
        };
    }, [apply, refetch]);

    return { equipmentHistory, isLoading, error, refetch };
}
