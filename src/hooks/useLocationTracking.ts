import {
    attachAppStateListener,
    clearLog,
    detachAppStateListener,
    LocationEntry,
    markSynced,
    pruneOldEntries,
    readLog,
    startBackgroundTracking,
    startForegroundInterval,
    stopBackgroundTracking,
    stopForegroundInterval
} from "@/services/locationTracking";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseLocationTrackingReturn {
    isTracking: boolean;
    entries: LocationEntry[];
    unsyncedCount: number;
    startTracking: () => Promise<void>;
    stopTracking: () => Promise<void>;
    refreshEntries: () => Promise<void>;
    clearAllEntries: () => Promise<void>;
    markEntriesSynced: (timestamps: number[]) => Promise<void>;
}

export function useLocationTracking(): UseLocationTrackingReturn {
    const [isTracking, setIsTracking] = useState(false);
    const [entries, setEntries] = useState<LocationEntry[]>([]);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const refreshEntries = useCallback(async () => {
        const log = await readLog();
        if (isMounted.current) setEntries(log);
    }, []);

    useEffect(() => {
        refreshEntries();
        pruneOldEntries(7);
    }, [refreshEntries]);

    const startTracking = useCallback(async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
            console.warn("[useLocationTracking] Foreground permission denied");
            return;
        }

        const bgStarted = await startBackgroundTracking();
        console.log("[useLocationTracking] Background tracking started:", bgStarted);

        startForegroundInterval();

        attachAppStateListener();

        if (isMounted.current) setIsTracking(true);
    }, []);

    const stopTracking = useCallback(async () => {
        stopForegroundInterval();
        detachAppStateListener();
        await stopBackgroundTracking();
        if (isMounted.current) setIsTracking(false);
    }, []);

    const clearAllEntries = useCallback(async () => {
        await clearLog();
        if (isMounted.current) setEntries([]);
    }, []);

    const markEntriesSynced = useCallback(async (timestamps: number[]) => {
        await markSynced(timestamps);
        await refreshEntries();
    }, [refreshEntries]);

    const unsyncedCount = entries.filter((e) => !e.synced).length;

    return {
        isTracking,
        entries,
        unsyncedCount,
        startTracking,
        stopTracking,
        refreshEntries,
        clearAllEntries,
        markEntriesSynced,
    };
}
