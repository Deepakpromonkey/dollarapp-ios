import { driverApi, DriverProfile } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface UseDriverProfileResult {
    profile: DriverProfile | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useDriverProfile(): UseDriverProfileResult {
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await driverApi.getProfile();
            setProfile(data.data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load profile",
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { profile, isLoading, error, refetch: fetch };
}
