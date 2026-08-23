import { useRouter, useSegments } from "expo-router";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { OneSignal } from 'react-native-onesignal';

import {
    ApiError,
    authApi,
    Driver,
    LoginResponse,
    type LoginPayload,
    type SignupPayload,
} from "@/lib/api";
import { clearSession, getAccessToken, getStoredDriver, saveSession, StoredDriver } from "@/lib/secureStore";


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
    livenessStatus: "approved" | "in_review" | "declined" | "pending";
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
    clearError: () => void;
    hydrateFromSession: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

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

    useEffect(() => {
        async function bootstrap() {
            try {
                const token = await getAccessToken();
                if (token) {
                    const stored = await getStoredDriver();
                    if (stored) {
                        setUser(mapDriver(stored));
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
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === "(auth)";
        const inTabsGroup = segments[0] === "(tabs)";

        if (!user && inTabsGroup) {
            router.replace("/(auth)/login" as any);
        } else if (user && inAuthGroup) {
            router.replace("/(tabs)/trip" as any);
        }
    }, [user, isLoading, segments]);

    async function persistAndHydrate(res: LoginResponse) {
        const { driver: d } = res;
        
        if (d.id) {
            OneSignal.login(d.id.toString());
        }

        const slim: StoredDriver = toStoredDriver(d);
        await saveSession(res.token, slim);
        setUser(mapDriver(slim));
    }

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
    }, []);

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
    }, []);

    const signup = useCallback(async (_payload: SignupPayload) => {
        throw new Error("Use the signup screen's completeRegistration flow.");
    }, []);

    const hydrateFromSession = useCallback(async () => {
        try {
            const token = await getAccessToken();
            if (token) {
                const stored = await getStoredDriver();
                if (stored) {
                    setUser(mapDriver(stored));
                }
            }
        } catch {
            // ignore
        }
    }, []);

    const logout = useCallback(async () => {
        setIsSubmitting(true);
        try {
            await authApi.logout().catch(() => {});
            
            OneSignal.logout();

        } finally {
            await clearSession();
            setUser(null);
            setError(null);
            setIsSubmitting(false);
        }
    }, []);

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
            clearError,
            hydrateFromSession,
        }),
        [user, isLoading, isSubmitting, error, login, loginOtp, signup, logout, clearError, hydrateFromSession],
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