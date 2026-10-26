import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Alert } from "react-native";
import { OneSignal } from 'react-native-onesignal';

import {
    ApiError,
    authApi,
    Driver,
    driverApi,
    LoginResponse,
    setUnauthorizedHandler,
    type AccountDeletionResponse,
    type LivenessStatus,
    type LoginPayload,
    type SignupPayload,
} from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import {
    clearSession,
    getAccessToken,
    getStoredDriver,
    saveDriver,
    saveSession,
    StoredDriver,
} from "@/lib/secureStore";
import { stopArrivalAlerts } from "@/utils/arrivalAlerts";
import { KEYS as LOCATION_KEYS } from "@/utils/locationConfig";
import { stopLocationTracking } from "@/utils/LocationTracker";


export interface AuthUser {
    id: number;
    uuid: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    contact: string | null;
    profilePic: string | null;
    carrierName: string | null;
    phoneVerified: boolean;
    livenessVerified: boolean;
    livenessStatus: LivenessStatus;
    status: string;
}

interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
}

interface AuthActions {
    login: (payload: LoginPayload) => Promise<void>;
    loginOtp: (contact: string, otp: string, device_token?: string | null) => Promise<void>;
    signup: (payload: SignupPayload) => Promise<void>;
    logout: () => Promise<void>;
    /**
     * Forget the session on this phone without asking the server: stop
     * tracking and arrival alerts, unlink pushes, clear storage and every
     * cached screen. For when the server has already ended the session.
     */
    signOutLocally: () => Promise<void>;
    /**
     * Ask for the account to be deleted. Resolves with the purge date; the
     * session is dead from that moment, so call signOutLocally next.
     */
    requestAccountDeletion: (reason?: string) => Promise<AccountDeletionResponse["data"]>;
    /** Merge fresh server values into the cached driver, on this phone and in memory. */
    updateDriver: (changes: Partial<StoredDriver>) => Promise<void>;
    clearError: () => void;
    hydrateFromSession: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

/*
| How long signing out waits for tracking to stop. Stopping sends the pings
| queued while offline, a request that can run to its own 20 s timeout, and it
| waits behind any tracker start still in progress; a dead network must not
| leave the driver staring at a spinner on the Log Out button.
*/
const TRACKING_STOP_TIMEOUT_MS = 5_000;

/** Wait for `promise`, but never longer than `ms`, and never reject. */
function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        promise
            .catch((err) => console.warn("[Auth] Sign-out step failed:", err))
            .finally(() => {
                clearTimeout(timer);
                resolve();
            });
    });
}

/*
 * The subset of DriverResource that gets persisted. Shared with the signup
 * screen: three call sites each writing this out by hand is how row_id and
 * active_plan survived here long after the API stopped sending them.
 */
export function toStoredDriver(d: Driver): StoredDriver {
    return {
        id: d.id,
        uuid: d.uuid,
        name: d.name,
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email,
        contact: d.contact,
        profile_pic: d.profile_pic,
        carrier_name: d.carrier_name,
        phone_verified: d.phone_verified,
        liveness_verified: d.liveness_verified,
        liveness_status: d.liveness_status,
        status: d.status,
    };
}

function mapDriver(d: Driver | StoredDriver): AuthUser {
    return {
        id: d.id,
        uuid: d.uuid,
        name: d.name || `${d.first_name} ${d.last_name}`.trim(),
        firstName: d.first_name,
        lastName: d.last_name,
        email: d.email,
        contact: d.contact,
        profilePic: d.profile_pic,
        carrierName: d.carrier_name,
        phoneVerified: d.phone_verified,
        livenessVerified: d.liveness_verified,
        livenessStatus: d.liveness_status,
        status: d.status,
    };
}

function extractErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const segments = useSegments();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /*
    | The signed-in driver, readable from callbacks that outlive a render: the
    | 401 handler and anything finishing after an await.
    */
    const userRef = useRef<AuthUser | null>(null);
    const applyUser = useCallback((next: AuthUser | null) => {
        userRef.current = next;
        setUser(next);
    }, []);

    /*
    | Set while this phone is ending the session on purpose (logging out,
    | deleting the account). Requests still in flight then come back 401, and
    | that is expected, not a reason to tell the driver their session expired.
    */
    const signingOutRef = useRef(false);
    const signOutRef = useRef<Promise<void> | null>(null);

    useEffect(() => {
        async function bootstrap() {
            try {
                const token = await getAccessToken();
                if (token) {
                    const stored = await getStoredDriver();
                    if (stored) {
                        applyUser(mapDriver(stored));
                    } else {
                        await clearSession();
                    }
                }
            } catch {
                await clearSession();
            } finally {
                setIsLoading(false);
            }
        }

        bootstrap();
    }, [applyUser]);

    useEffect(() => {
        if (isLoading) return;

        const first = segments[0] as string | undefined;
        const inAuthGroup = first === "(auth)";

        if (!user && first && !inAuthGroup) {
            /*
            | Any signed-in screen, not only the tabs: a session can now end
            | while the driver is on chat, load detail or the inbox. The stack
            | is cleared first, or the old tabs stay mounted under the login
            | screen and Back leads straight into them.
            */
            if (router.canDismiss()) router.dismissAll();
            router.replace("/(auth)/login" as any);
        } else if (user && inAuthGroup) {
            router.replace("/(tabs)/trip" as any);
        }
    }, [user, isLoading, segments, router]);

    /*
    | Pushes follow the session. OneSignal.logout() only unlinks the driver's
    | id: the phone's subscription stays live, and the servers push straight
    | to it (the API keeps the device token after logout), so a driver who
    | had logged out still got GPS-lost, ID-check and load pushes. Opting the
    | subscription out stops every sender at once; signing in turns it back
    | on. Also run at launch, which silences a phone that logged out on an
    | older build.
    |
    | On iOS, optIn() raises the notification prompt (or OneSignal's own "Open
    | Settings" dialog) when the driver has not allowed notifications, and
    | doing that on every sign-in would press a driver who said no (App Review
    | 5.1.1(iv)). So it only resumes a subscription the driver has already
    | allowed. A driver who allows it later, while signed in, is caught by the
    | permissionChange listener, which exists only for the signed-in session.
    | Registered here rather than at mount because this runs only after the
    | auth bootstrap, by which point the root layout has initialised OneSignal.
    */
    const signedIn = user !== null;
    useEffect(() => {
        if (isLoading) return;

        if (!signedIn) {
            try {
                OneSignal.User.pushSubscription.optOut();
            } catch (err) {
                console.warn("[Auth] Could not switch pushes off:", err);
            }
            return;
        }

        let cancelled = false;
        const optInIfAllowed = (granted: boolean) => {
            if (cancelled || !granted || signingOutRef.current) return;
            try {
                OneSignal.User.pushSubscription.optIn();
            } catch (err) {
                console.warn("[Auth] Could not switch pushes on:", err);
            }
        };

        OneSignal.Notifications.getPermissionAsync()
            .then(optInIfAllowed)
            .catch((err) => console.warn("[Auth] Could not read notification permission:", err));
        OneSignal.Notifications.addEventListener("permissionChange", optInIfAllowed);

        return () => {
            cancelled = true;
            OneSignal.Notifications.removeEventListener("permissionChange", optInIfAllowed);
        };
    }, [isLoading, signedIn]);

    const signOutLocally = useCallback((): Promise<void> => {
        // Logging out while a 401 is already signing out must not do it twice.
        if (signOutRef.current) return signOutRef.current;
        signingOutRef.current = true;

        const run = (async () => {
            try {
                await settleWithin(stopLocationTracking(), TRACKING_STOP_TIMEOUT_MS);
                /*
                | Pings that still could not be sent belong to this driver's
                | session. Left behind, they would go out under whoever signs in
                | next, against whatever load that driver starts.
                */
                await AsyncStorage.removeItem(LOCATION_KEYS.QUEUE).catch(() => {});
                // Whoever signs in next on this phone must not be told they have
                // arrived at this driver's stops.
                await stopArrivalAlerts().catch(() => {});
                try {
                    OneSignal.User.pushSubscription.optOut();
                } catch (err) {
                    console.warn("[Auth] Could not switch pushes off:", err);
                }
                try {
                    OneSignal.logout();
                } catch (err) {
                    console.warn("[Auth] OneSignal logout failed:", err);
                }
                await clearSession().catch(() => {});
            } finally {
                invalidate("session");
                applyUser(null);
                setError(null);
                signingOutRef.current = false;
                signOutRef.current = null;
            }
        })();

        signOutRef.current = run;
        return run;
    }, [applyUser]);

    /*
    | The server stopped accepting this session: the driver logged in on
    | another phone, or asked for the account to be deleted from one. Say so
    | once, then sign out here too.
    */
    const expireSession = useCallback(() => {
        if (!userRef.current || signingOutRef.current) return;
        Alert.alert("Session expired", "Please log in again.");
        void signOutLocally();
    }, [signOutLocally]);

    useEffect(() => {
        setUnauthorizedHandler(expireSession);
        return () => setUnauthorizedHandler(null);
    }, [expireSession]);

    /*
    | A session is starting: drop whatever the caches picked up while nobody
    | was signed in. invalidate("session") at sign-out only stops the requests
    | already in flight then. A screen still mounted for a moment afterwards
    | (load detail looking its load up again, say) can send one more with no
    | token, and its 401 used to sit in the loads store until the next login,
    | which then opened on "No active load" and "Session expired". Called once
    | the new token is stored and before the driver is set, so every screen
    | that mounts for this driver starts clean and fetches with that token.
    */
    const startSession = useCallback((next: AuthUser) => {
        invalidate("session");
        applyUser(next);
    }, [applyUser]);

    const persistAndHydrate = useCallback(async (res: LoginResponse) => {
        const { driver: d } = res;

        if (d.id) {
            try {
                OneSignal.login(d.id.toString());
            } catch (err) {
                console.warn("[Auth] OneSignal login failed:", err);
            }
        }

        const slim: StoredDriver = toStoredDriver(d);
        await saveSession(res.token, slim);
        startSession(mapDriver(slim));

        /*
        | Logging in is how a driver keeps an account they asked to delete. The
        | screen changes the moment the user is set, so this has to be an alert
        | rather than a message on the login form. The title greets; the body
        | is the server's own wording.
        */
        if (res.deletion_cancelled) {
            Alert.alert(
                "Welcome back",
                res.message ||
                    "Your account deletion has been cancelled and your account is active again.",
            );
        }
    }, [startSession]);

    const login = useCallback(async (payload: LoginPayload) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data } = await authApi.login(payload);
            await persistAndHydrate(data);
        } catch (err) {
            setError(extractErrorMessage(err));
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    }, [persistAndHydrate]);

    const loginOtp = useCallback(async (contact: string, otp: string,device_token?: string | null) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data } = await authApi.loginOtp({ contact, otp , device_token});
            await persistAndHydrate(data);
        } catch (err) {
            setError(extractErrorMessage(err));
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    }, [persistAndHydrate]);

    const signup = useCallback(async (_payload: SignupPayload) => {
        throw new Error("Use the signup screen's completeRegistration flow.");
    }, []);

    /* Signup: the screen has just stored the new session itself. */
    const hydrateFromSession = useCallback(async () => {
        try {
            const token = await getAccessToken();
            if (token) {
                const stored = await getStoredDriver();
                if (stored) {
                    startSession(mapDriver(stored));
                }
            }
        } catch {
            // ignore
        }
    }, [startSession]);

    const logout = useCallback(async () => {
        setIsSubmitting(true);
        signingOutRef.current = true;
        try {
            /*
            | Tracking stops before the token is revoked: stopping sends any
            | pings still queued from a dead spot, and only a token the server
            | still accepts can deliver them.
            */
            await settleWithin(stopLocationTracking(), TRACKING_STOP_TIMEOUT_MS);
            await authApi.logout().catch(() => {});
        } finally {
            await signOutLocally();
            setIsSubmitting(false);
        }
    }, [signOutLocally]);

    const requestAccountDeletion = useCallback(async (reason?: string) => {
        /*
        | The token dies the moment this succeeds. Requests already in flight
        | (the unread badge, a load refresh) will come back 401, and must not
        | put "Session expired" over the deletion confirmation.
        */
        signingOutRef.current = true;
        try {
            const { data } = await driverApi.requestAccountDeletion(reason);
            return data.data;
        } catch (err) {
            signingOutRef.current = false;
            if (err instanceof ApiError && err.status === 401) expireSession();
            throw err;
        }
    }, [expireSession]);

    const updateDriver = useCallback(async (changes: Partial<StoredDriver>) => {
        const stored = await getStoredDriver().catch(() => null);
        const current = userRef.current;
        /*
        | Only ever the driver signed in now: an answer that arrives after a
        | sign-out (or a different driver's login) must not write a profile
        | back into storage.
        */
        if (!stored || !current || stored.id !== current.id) return;
        if (changes.id !== undefined && changes.id !== stored.id) return;
        if (signingOutRef.current || userRef.current?.id !== stored.id) return;

        const next: StoredDriver = { ...stored, ...changes };
        await saveDriver(next);
        if (userRef.current?.id === next.id) applyUser(mapDriver(next));
    }, [applyUser]);

    const clearError = useCallback(() => setError(null), []);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            isLoading,
            isSubmitting,
            error,
            login,
            loginOtp,
            signup,
            logout,
            signOutLocally,
            requestAccountDeletion,
            updateDriver,
            clearError,
            hydrateFromSession,
        }),
        [
            user,
            isLoading,
            isSubmitting,
            error,
            login,
            loginOtp,
            signup,
            logout,
            signOutLocally,
            requestAccountDeletion,
            updateDriver,
            clearError,
            hydrateFromSession,
        ],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }
    return ctx;
}
