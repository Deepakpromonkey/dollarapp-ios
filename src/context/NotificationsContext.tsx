import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { onInvalidate } from "@/lib/invalidate";
import { notificationsApi } from "@/lib/notificationsApi";

/*
| The unread badge on the header bell.
|
| Only the count lives here; the inbox screen pages through the notifications
| itself. The count is fetched when a session starts (login, signup, or a
| session restored at launch), whenever the app comes back to the front, once
| a minute while it stays there, and whenever something announces
| invalidate("notifications") — a push arriving in the foreground, an arrival
| being recorded. Nothing is requested while signed out.
*/

const POLL_INTERVAL_MS = 60_000;

/*
| Every permission dialog and every trip to Settings takes the app out of the
| foreground and back, so a burst of "active" events costs one request.
*/
const FOREGROUND_MIN_GAP_MS = 5_000;

export interface NotificationsContextValue {
    /** Unread notifications for the signed-in driver; 0 when signed out or not known yet. */
    unreadCount: number;
    /** Fetch the count again. Never throws; a failure keeps the last known count. */
    refresh: () => Promise<void>;
    /** Mark one notification read. Resolves false when the server could not be told. */
    markRead: (uuid: string) => Promise<boolean>;
    /**
     * Mark the inbox read, or with `upToUuid` only that notification and the
     * older ones. Resolves false when the server could not be told.
     */
    markAllRead: (upToUuid?: string | null) => Promise<boolean>;
    /**
     * For a request that also returns the count (the inbox page): call this
     * before sending it and the returned function with the count it brings
     * back, so an older answer never overwrites a newer one.
     */
    trackUnreadCount: () => (count: number) => void;
}

/* Safe outside the provider: a header rendered in isolation just shows no badge. */
const NotificationsContext = createContext<NotificationsContextValue>({
    unreadCount: 0,
    refresh: async () => {},
    markRead: async () => false,
    markAllRead: async () => false,
    trackUnreadCount: () => () => {},
});

function toCount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const [unreadCount, setUnreadCount] = useState(0);
    const signedIn = userId !== null;

    /*
    | Answers can come back out of order: a minute's poll sent just before the
    | driver opened a notification may land after the "mark read" reply and
    | put the old count back. Every request takes a ticket when it starts, and
    | an answer is only used if no later-started request has been used yet.
    */
    const ticketRef = useRef(0);
    const appliedRef = useRef(0);

    const trackUnreadCount = useCallback(() => {
        const ticket = ++ticketRef.current;
        return (count: number) => {
            if (ticket < appliedRef.current) return;
            appliedRef.current = ticket;
            setUnreadCount(toCount(count));
        };
    }, []);

    const refresh = useCallback(async () => {
        if (!signedIn) return;
        const apply = trackUnreadCount();
        try {
            const { data } = await notificationsApi.unreadCount();
            apply(data?.data?.unread_count);
        } catch {
            // Keep showing the last known count; the next poll tries again.
        }
    }, [signedIn, trackUnreadCount]);

    const markRead = useCallback(
        async (uuid: string) => {
            if (!signedIn || !uuid) return false;
            const apply = trackUnreadCount();
            try {
                const { data } = await notificationsApi.markRead(uuid);
                apply(data?.data?.unread_count);
                return true;
            } catch {
                return false;
            }
        },
        [signedIn, trackUnreadCount],
    );

    const markAllRead = useCallback(
        async (upToUuid?: string | null) => {
            if (!signedIn) return false;
            const apply = trackUnreadCount();
            try {
                const { data } = await notificationsApi.markAllRead({ up_to_uuid: upToUuid });
                apply(data?.data?.unread_count);
                return true;
            } catch {
                return false;
            }
        },
        [signedIn, trackUnreadCount],
    );

    useEffect(() => {
        const offNotifications = onInvalidate("notifications", () => {
            void refresh();
        });
        const offSession = onInvalidate("session", () => {
            // Every answer still in flight belongs to the session that just ended.
            appliedRef.current = ++ticketRef.current;
            setUnreadCount(0);
        });
        return () => {
            offNotifications();
            offSession();
        };
    }, [refresh]);

    useEffect(() => {
        // Signed out: the "session" listener above has already cleared the count.
        if (userId === null) return;

        let lastRun = 0;
        let timer: ReturnType<typeof setInterval> | null = null;

        const run = () => {
            lastRun = Date.now();
            void refresh();
        };
        const startPolling = () => {
            if (!timer) timer = setInterval(run, POLL_INTERVAL_MS);
        };
        const stopPolling = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };

        // A session has just started: login, signup, or one restored at launch.
        run();
        if (AppState.currentState === "active") startPolling();

        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                if (Date.now() - lastRun >= FOREGROUND_MIN_GAP_MS) run();
                startPolling();
            } else {
                stopPolling();
            }
        });

        return () => {
            subscription.remove();
            stopPolling();
        };
    }, [userId, refresh]);

    const value = useMemo<NotificationsContextValue>(
        () => ({ unreadCount, refresh, markRead, markAllRead, trackUnreadCount }),
        [unreadCount, refresh, markRead, markAllRead, trackUnreadCount],
    );

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications(): NotificationsContextValue {
    return useContext(NotificationsContext);
}
