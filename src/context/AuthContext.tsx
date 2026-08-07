import { useRouter, useSegments } from "expo-router";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

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
    rowId: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    contact: string;
    profilePic: string;
    roles: string;
    carrierName: string;
    activePlan: string;
    phoneVerified: boolean;
    livenessVerified: boolean;
    status: number;
}

interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
}

interface AuthActions {
    login: (payload: LoginPayload) => Promise<void>;
    loginOtp: (contact: string, otp: string) => Promise<void>;
    signup: (payload: SignupPayload) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
    hydrateFromSession: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

function mapDriver(d: Driver | StoredDriver): AuthUser {
    return {
        id: d.id,
        rowId: d.row_id,
        name: d.name || `${d.first_name} ${d.last_name}`.trim(),
        firstName: d.first_name,
        lastName: d.last_name,
        email: d.email,
        contact: d.contact,
        profilePic: d.profile_pic,
        roles: d.roles,
        carrierName: d.carrier_name,
        activePlan: d.active_plan,
        phoneVerified: d.phone_verified,
        livenessVerified: d.liveness_verified,
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
        const slim: StoredDriver = {
            id: d.id,
            row_id: d.row_id,
            name: d.name,
            first_name: d.first_name,
            last_name: d.last_name,
            email: d.email,
            contact: d.contact,
            profile_pic: d.profile_pic,
            roles: d.roles,
            carrier_name: d.carrier_name,
            active_plan: d.active_plan,
            phone_verified: d.phone_verified,
            liveness_verified: d.liveness_verified,
            status: d.status,
        };
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

    const loginOtp = useCallback(async (contact: string, otp: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data } = await authApi.loginOtp({ contact, otp });
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
