import { driverApi, DriverProfile } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseDriverProfileResult {
    profile: DriverProfile | null;
    /** True only until the first answer arrives; a refetch keeps the profile on screen. */
    isLoading: boolean;
    error: string | null;
    /** Fetch again. Resolves once it settles; never rejects. */
    refetch: () => Promise<void>;
}

/*
| GET /driver/profile for the signed-in driver.
|
| Fetched on mount and again whenever something announces
| invalidate("profile") (an identity check finishing, a verdict pushed by the
| server). A failed refetch keeps the profile already shown and reports the
| error beside it, so the screen does not empty out over a bad connection.
| Sign-out drops everything.
*/
export function useDriverProfile(): UseDriverProfileResult {
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* Only the newest request may write; an older answer landing late is dropped. */
    const requestRef = useRef(0);

    // A promise chain, so state is only ever set once the request has answered.
    const fetchProfile = useCallback((): Promise<void> => {
        const request = ++requestRef.current;

        return driverApi
            .getProfile()
            .then(({ data }) => {
                if (request !== requestRef.current) return;
                setProfile(data.data);
                setError(null);
            })
            .catch((err: unknown) => {
                if (request !== requestRef.current) return;
                setError(
                    err instanceof Error ? err.message : "Failed to load profile",
                );
            })
            .finally(() => {
                if (request === requestRef.current) setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        const offProfile = onInvalidate("profile", () => {
            void fetchProfile();
        });
        const offSession = onInvalidate("session", () => {
            requestRef.current += 1;
            setProfile(null);
            setError(null);
            setIsLoading(true);
        });
        return () => {
            offProfile();
            offSession();
        };
    }, [fetchProfile]);

    return { profile, isLoading, error, refetch: fetchProfile };
}
