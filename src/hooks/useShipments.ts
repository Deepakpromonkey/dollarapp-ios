import { api } from "@/lib/api";
import { onInvalidate } from "@/lib/invalidate";
import { friendlyError } from "@/lib/loadApi";
import { getAccessToken } from "@/lib/secureStore";
import type { Shipment, ShipmentsResponse } from "@/types/shipment";
import { useEffect, useSyncExternalStore } from "react";

/*
| One copy of the driver's loads for the whole app.
|
| Every screen used to fetch GET /shipments into its own state, once, when it
| mounted. The tabs stay mounted for the session, so a load activated on the
| detail screen, assigned by the broker, or simply failing to arrive the first
| time stayed missing from My Trip until the app was restarted. Now there is a
| single store: every screen reads the same answer, a change made anywhere
| (invalidate("shipments")) refetches it for all of them, and a burst of
| screens asking at once costs one request, which matters because the API
| finds a driver's loads with a phone-number scan no index can help.
|
| `loading` is true only until the first request of a session settles; after
| that a refetch sets `refreshing` and the loads already shown stay on screen,
| including when the refetch fails (its error is reported alongside them).
*/

interface ShipmentsSnapshot {
    active: Shipment[];
    upcoming: Shipment[];
    past: Shipment[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

export interface ShipmentsState extends ShipmentsSnapshot {
    /**
     * Fetch again (pull to refresh, a Retry button, coming back to a screen).
     * Joins a request already in flight. Resolves once it settles; never rejects.
     */
    refresh: () => Promise<void>;
}

const INITIAL: ShipmentsSnapshot = {
    active: [],
    upcoming: [],
    past: [],
    loading: true,
    refreshing: false,
    error: null,
};

/* A screen mounting within this long of the last good answer just reads it. */
const FRESH_FOR_MS = 10_000;

/*
| Several screens can ask at nearly the same moment (a chat closing, the screen
| under it regaining focus). An answer this new is good enough for any of them.
*/
const MIN_REFRESH_GAP_MS = 2_000;

let snapshot: ShipmentsSnapshot = INITIAL;
let inFlight: Promise<void> | null = null;
/* Data changed on the server while a request was already in flight: fetch once more after it. */
let refetchAfterFlight = false;
let lastSuccessAt = 0;
/* The raw JSON last shown, so an unchanged answer keeps the same arrays and re-renders nothing. */
let lastPayload = "";
/* Bumped when a session ends and when one starts. A request sent for another session can then never land. */
let session = 0;

const listeners = new Set<() => void>();

function update(patch: Partial<ShipmentsSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): ShipmentsSnapshot {
    return snapshot;
}

type FetchResult = { list: Shipment[] } | { error: string };

/*
| Never rejects: a failure comes back as the message to show, and null means
| nothing was asked because nobody is signed in.
|
| A screen still mounted for a moment after sign-out (load detail looking its
| load up again once the store is emptied, a chat closing) can ask for loads
| with no token left. The 401 it gets is not news about anyone's loads, and
| stored as this store's error it greeted the next driver to log in with
| "Session expired" over "No active load".
*/
async function fetchShipments(): Promise<FetchResult | null> {
    // Unreadable storage is not "signed out": the request goes ahead and reports what happens.
    const token = await getAccessToken().catch(() => undefined);
    if (token === null || token === "") return null;

    try {
        const res = await api.get<ShipmentsResponse>("/shipments");
        const list = res.data?.data;
        if (!Array.isArray(list)) {
            return { error: "The server sent an answer the app could not read. Try again." };
        }
        return { list };
    } catch (err: unknown) {
        return { error: friendlyError(err, "Could not load your loads.") };
    }
}

function patchFor(result: FetchResult): Partial<ShipmentsSnapshot> {
    if (!("list" in result)) return { error: result.error };

    const payload = JSON.stringify(result.list);
    lastSuccessAt = Date.now();
    if (payload === lastPayload) return { error: null };

    lastPayload = payload;
    return {
        active: result.list.filter((s) => s?.status === "Active"),
        upcoming: result.list.filter((s) => s?.status === "Upcoming"),
        past: result.list.filter((s) => s?.status === "Past"),
        error: null,
    };
}

function startRequest(): Promise<void> {
    const requestSession = session;

    if (!snapshot.loading) update({ refreshing: true });

    // .then always runs asynchronously, so `inFlight` below is set before it is cleared.
    const request = fetchShipments()
        .then((result) => {
            if (requestSession !== session) return;

            inFlight = null;

            if (result === null) {
                /*
                | Signed out, so nothing was sent. The snapshot stays as it is
                | (still loading after a sign-out) apart from a pull's spinner,
                | and there is nobody to fetch again for.
                */
                refetchAfterFlight = false;
                if (snapshot.refreshing) update({ refreshing: false });
                return;
            }

            update({ ...patchFor(result), loading: false, refreshing: false });

            if (refetchAfterFlight) {
                refetchAfterFlight = false;
                void startRequest();
            }
        })
        .catch((err: unknown) => {
            // Not expected; here so a bad payload cannot leave every screen on a spinner.
            console.warn("[shipments] Could not apply the response:", err);
            if (requestSession !== session) return;
            inFlight = null;
            update({ loading: false, refreshing: false, error: "Could not load your loads." });
        });

    inFlight = request;
    return request;
}

function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    // After a failure, "Try again" always tries.
    if (!snapshot.error && Date.now() - lastSuccessAt < MIN_REFRESH_GAP_MS) {
        return Promise.resolve();
    }
    return startRequest();
}

/* What a screen does when it mounts: fetch unless an answer is on its way or still fresh. */
function ensureFresh(): void {
    if (inFlight || Date.now() - lastSuccessAt < FRESH_FOR_MS) return;
    void startRequest();
}

onInvalidate("shipments", () => {
    // The request in flight may have been answered before the change.
    if (inFlight) {
        refetchAfterFlight = true;
    } else if (listeners.size > 0) {
        void startRequest();
    } else {
        // Nothing is showing loads; the next screen to mount fetches.
        lastSuccessAt = 0;
    }
});

/*
| Sign-out, and again at sign-in (AuthContext). Forget everything so whoever
| signs in next starts from a spinner, not from the last driver's loads or
| from anything a request made in between left behind. Deliberately no
| refetch here: at sign-out there is no session to fetch with, and at sign-in
| the screens that mount for the new driver fetch for themselves.
*/
onInvalidate("session", () => {
    session += 1;
    inFlight = null;
    refetchAfterFlight = false;
    lastSuccessAt = 0;
    lastPayload = "";
    snapshot = INITIAL;
    listeners.forEach((listener) => listener());
});

export function useShipments(): ShipmentsState {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        ensureFresh();
    }, []);

    return { ...state, refresh };
}
