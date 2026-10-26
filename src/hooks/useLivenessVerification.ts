import { startVerification as startDidit } from "@didit-protocol/sdk-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { toStoredDriver, useAuth } from "@/context/AuthContext";
import {
    ApiError,
    driverApi,
    type LivenessRefreshResponse,
    type LivenessSessionResponse,
    type LivenessStatus,
} from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { friendlyError } from "@/lib/loadApi";
import { resolveLiveness, type LivenessState } from "@/utils/liveness";

/*
| Identity verification after signup, from the profile.
|
| Signup lets a driver skip the check ("verify later from your profile"), and a
| check can come back declined. The flow: the API opens a Didit session for the
| signed-in driver, the Didit SDK runs the camera steps, then the API is asked
| what Didit decided. That last step matters: Didit's webhook may point at a
| different server (it does while testing over ngrok), and the driver should
| see the result now, not after the next restart.
*/

/*
| A finished check that Didit has not decided yet.
|
| The SDK closes the moment the driver finishes, and Didit can still be working
| on the result then: the refresh comes back "In Progress", which leaves
| liveness_status at skipped or pending, and so does a refresh that fails. The
| badge used to stay on VERIFY ID, and tapping it opened a second, billed Didit
| session that replaced the first one on the server, so the verdict on the
| check the driver had actually finished was ignored when it arrived. This
| phone now remembers that check: the profile shows it as in review, and a tap
| asks for the verdict again instead of starting over.
|
| Kept beside the server's state, never written into it. The profile reloads
| liveness_status from the API, so a faked "in_review" in the cached driver
| would be overwritten by the next fetch.
|
| Dropped once the server has a verdict (approved, declined or in review),
| when Didit reports the session abandoned or expired, when a new session
| starts, and after AWAITING_MAX_AGE_MS in any case. Didit decides a finished
| check within minutes, so by then nothing is lost by letting the driver start
| again, and a check that never resolves cannot lock them out of retrying.
*/
const AWAITING_KEY = "@liveness_awaiting_verdict";
const AWAITING_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/*
| Asked again after the first refresh, each wait longer than the last. The
| refresh endpoint allows 20 calls a minute; this is three in about 35 seconds.
*/
const POLL_DELAYS_MS = [5_000, 10_000, 20_000];

interface AwaitingVerdict {
    driverId: number;
    /** The Didit session the driver finished. */
    sessionId: string;
    /** When they finished it (ms). */
    since: number;
    /*
    | In memory only: a refresh has brought the verdict, but the profile still
    | shows the server's answer from before it. Holding the badge on IN REVIEW
    | until that answer is reloaded saves a flash of VERIFY ID in between.
    */
    answered?: boolean;
}

function isExpired(marker: AwaitingVerdict): boolean {
    return Date.now() - marker.since >= AWAITING_MAX_AGE_MS;
}

/* The stored marker, whoever it belongs to; null when there is none or it cannot be read. */
async function readMarker(): Promise<AwaitingVerdict | null> {
    try {
        const raw = await AsyncStorage.getItem(AWAITING_KEY);
        if (!raw) return null;
        const marker = JSON.parse(raw) as Partial<AwaitingVerdict> | null;
        return marker &&
            typeof marker.driverId === "number" &&
            typeof marker.sessionId === "string" &&
            typeof marker.since === "number"
            ? { driverId: marker.driverId, sessionId: marker.sessionId, since: marker.since }
            : null;
    } catch {
        return null;
    }
}

/*
| Remove the stored marker if it is this driver's (and, given a session, that
| session's): an answer for an older session must not clear a newer one.
*/
async function removeMarker(driverId: number, sessionId?: string): Promise<void> {
    const stored = await readMarker();
    if (!stored || stored.driverId !== driverId) return;
    if (sessionId && stored.sessionId !== sessionId) return;
    await AsyncStorage.removeItem(AWAITING_KEY).catch(() => {});
}

function isDecided(state: LivenessState | null): boolean {
    return state !== null && state !== "unverified";
}

/* Approved, declined or in review: the server has a verdict and no longer needs this phone's help. */
function hasVerdict(verdict: LivenessRefreshResponse | null): boolean {
    return !!verdict && isDecided(resolveLiveness(verdict.liveness_status, verdict.liveness_verified));
}

/* Didit stopped waiting for the driver: the session will never get a verdict. */
function diditGaveUp(verdict: LivenessRefreshResponse | null): boolean {
    const status = String(verdict?.didit_status ?? "").trim().toLowerCase();
    return status === "abandoned" || status === "expired";
}

function verdictStatus(verdict: LivenessRefreshResponse | null): LivenessStatus | null {
    if (!verdict) return null;
    return verdict.liveness_verified ? "approved" : verdict.liveness_status;
}

function tellDriver(status: LivenessStatus | null): void {
    switch (status) {
        case "approved":
            Alert.alert("ID verified", "Thanks! Your identity is verified.");
            return;
        case "declined":
            Alert.alert(
                "ID not verified",
                "We couldn't verify your ID. Tap Retry on your profile to try again.",
            );
            return;
        default:
            Alert.alert(
                "ID check sent",
                "We're checking your ID. Your profile will update when it's done.",
            );
    }
}

export function useLivenessVerification() {
    const { user, updateDriver } = useAuth();
    const driverId = user?.id ?? null;

    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);

    /* For timers and answers that outlive a render: who is signed in now. */
    const driverIdRef = useRef(driverId);
    // Declared before the effects below, so they see the new driver.
    useEffect(() => {
        driverIdRef.current = driverId;
    }, [driverId]);

    /* What the profile shows from the server now (see noteServerState). */
    const serverStateRef = useRef<LivenessState | null>(null);

    /* The signed-in driver's finished check that is still waiting on Didit. */
    const [awaiting, setAwaiting] = useState<AwaitingVerdict | null>(null);
    const awaitingRef = useRef<AwaitingVerdict | null>(null);

    // Another driver: the last one's check is not theirs. Reset while rendering;
    // the refs are reset in the effect below.
    const [shownDriver, setShownDriver] = useState(driverId);
    if (shownDriver !== driverId) {
        setShownDriver(driverId);
        setAwaiting(null);
    }

    const applyAwaiting = useCallback((next: AwaitingVerdict | null) => {
        awaitingRef.current = next;
        setAwaiting(next);
    }, []);

    const remember = useCallback(
        async (sessionId: string) => {
            const id = driverIdRef.current;
            if (id === null) return;
            const marker: AwaitingVerdict = { driverId: id, sessionId, since: Date.now() };
            applyAwaiting(marker);
            await AsyncStorage.setItem(AWAITING_KEY, JSON.stringify(marker)).catch(() => {});
        },
        [applyAwaiting],
    );

    /* Drop the marker at once; with `sessionId`, only if it is still that session's. */
    const forget = useCallback(
        async (sessionId?: string) => {
            const id = driverIdRef.current;
            if (id === null) return;
            const current = awaitingRef.current;
            if (current && (!sessionId || current.sessionId === sessionId)) {
                applyAwaiting(null);
            }
            await removeMarker(id, sessionId);
        },
        [applyAwaiting],
    );

    /*
    | The server has a verdict. Nothing is left to wait for, so the stored
    | marker goes; the badge lets go of IN REVIEW once the profile shows the
    | verdict too, which may be now.
    */
    const answer = useCallback(
        async (sessionId?: string) => {
            const id = driverIdRef.current;
            if (id === null) return;
            const current = awaitingRef.current;
            if (current && (!sessionId || current.sessionId === sessionId)) {
                applyAwaiting(isDecided(serverStateRef.current) ? null : { ...current, answered: true });
            }
            await removeMarker(id, sessionId);
        },
        [applyAwaiting],
    );

    /* Bumped to stop the polls for an earlier check. */
    const pollRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopPolling = useCallback(() => {
        pollRef.current += 1;
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
    }, []);

    // The marker belongs to one driver: load it for whoever is signed in now.
    useEffect(() => {
        stopPolling();
        serverStateRef.current = null;
        awaitingRef.current = null;
        if (driverId === null) return;

        let current = true;
        readMarker().then((stored) => {
            // Something newer may have been recorded while this was being read.
            if (!current || awaitingRef.current || !stored || stored.driverId !== driverId) return;
            if (isExpired(stored)) {
                void removeMarker(driverId, stored.sessionId);
                return;
            }
            applyAwaiting(stored);
        });

        return () => {
            current = false;
        };
    }, [driverId, applyAwaiting, stopPolling]);

    // No polls left running once the profile is gone (sign-out unmounts it).
    useEffect(() => stopPolling, [stopPolling]);

    /*
    | Ask the API for Didit's current verdict and bring this phone up to date.
    |
    | `quiet` is for asking again behind the driver's back (the polls, a
    | return to the profile): the profile is only reloaded when there is
    | something new to show.
    */
    const fetchVerdict = useCallback(
        async (quiet = false): Promise<LivenessRefreshResponse | null> => {
            // The marker this request is sent for. Any of this driver's when there
            // is none in memory, such as one still being read in from storage.
            const sessionId = awaitingRef.current?.sessionId;
            let verdict: LivenessRefreshResponse | null = null;
            try {
                const { data } = await driverApi.refreshLiveness();
                verdict = data;
                await updateDriver(
                    data.driver
                        ? toStoredDriver(data.driver)
                        : {
                              liveness_status: data.liveness_status,
                              liveness_verified: data.liveness_verified,
                          },
                ).catch(() => {});
                if (hasVerdict(data)) {
                    await answer(sessionId);
                } else if (diditGaveUp(data)) {
                    await forget(sessionId);
                }
                return data;
            } catch {
                return null;
            } finally {
                // The profile screen reloads its badge from the server.
                if (!quiet || hasVerdict(verdict) || diditGaveUp(verdict)) {
                    invalidate("profile");
                }
            }
        },
        [updateDriver, answer, forget],
    );

    /*
    | Didit usually decides within seconds of the SDK closing, so ask a few
    | more times before leaving it to the driver's next look at the profile.
    */
    const pollForVerdict = useCallback(
        (sessionId: string) => {
            stopPolling();
            const poll = pollRef.current;
            const driver = driverIdRef.current;

            const stillWaiting = () =>
                poll === pollRef.current &&
                driverIdRef.current === driver &&
                awaitingRef.current?.sessionId === sessionId &&
                !awaitingRef.current.answered;

            const schedule = (attempt: number) => {
                if (attempt >= POLL_DELAYS_MS.length) return;
                pollTimerRef.current = setTimeout(async () => {
                    pollTimerRef.current = null;
                    if (!stillWaiting()) return;
                    // A tap is already asking; this round can sit out.
                    if (!busyRef.current) await fetchVerdict(true);
                    if (stillWaiting()) schedule(attempt + 1);
                }, POLL_DELAYS_MS[attempt]);
            };

            schedule(0);
        },
        [stopPolling, fetchVerdict],
    );

    const run = useCallback(async (task: () => Promise<void>) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        try {
            await task();
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }, []);

    /**
     * Quietly ask again while a finished check is waiting on Didit (a return to
     * the profile, a pull to refresh). Does nothing otherwise, and never
     * rejects.
     */
    const recheck = useCallback(async () => {
        const marker = awaitingRef.current;
        if (!marker || marker.answered || busyRef.current) return;
        if (isExpired(marker)) {
            await forget(marker.sessionId);
            return;
        }
        await fetchVerdict(true);
    }, [forget, fetchVerdict]);

    /**
     * Tell the hook what the profile shows from the server now. A verdict
     * there means the marker has done its job; one the marker did not hear
     * about yet (the webhook got there first, or the profile's copy is older
     * than this check) is confirmed with a refresh before it is believed.
     */
    const noteServerState = useCallback(
        (state: LivenessState | null) => {
            serverStateRef.current = state;
            const marker = awaitingRef.current;
            if (!marker || !isDecided(state)) return;
            if (marker.answered) {
                applyAwaiting(null);
            } else {
                void recheck();
            }
        },
        [applyAwaiting, recheck],
    );

    /** Start (or retry) the identity check. */
    const verify = useCallback(
        () =>
            run(async () => {
                let session: LivenessSessionResponse;
                try {
                    ({ data: session } = await driverApi.startLiveness());
                } catch (err) {
                    if (err instanceof ApiError && err.status === 409) {
                        // Already verified or under review: say so, and fix the badge.
                        Alert.alert("ID check", err.message);
                        await fetchVerdict();
                        return;
                    }
                    Alert.alert(
                        "Couldn't start the ID check",
                        friendlyError(err, "Please check your connection and try again."),
                    );
                    return;
                }

                // This session replaces the one any earlier marker was waiting on.
                stopPolling();
                await forget();

                // Same token rule as the signup step (components/signup/Step6Liveness).
                const token =
                    session.session_token ??
                    session.session_url?.split("/").pop() ??
                    session.didit_session_id;

                let result;
                try {
                    result = await startDidit(token, {
                        // Unlike signup, nothing here depends on finishing: let the driver back out.
                        showCloseButton: true,
                        closeOnComplete: true,
                    });
                } catch (err) {
                    Alert.alert(
                        "Couldn't start the ID check",
                        friendlyError(err, "Please try again."),
                    );
                    return;
                }

                if (result.type === "cancelled") return;

                if (result.type === "failed") {
                    Alert.alert(
                        "ID check didn't finish",
                        result.error.message || "Please try again.",
                    );
                    return;
                }

                const verdict = await fetchVerdict();

                if (diditGaveUp(verdict)) {
                    Alert.alert("ID check didn't finish", "Please try again.");
                    return;
                }

                // Still being worked on, or the API could not be asked: wait for it here.
                if (!hasVerdict(verdict)) {
                    const sessionId = session.didit_session_id || result.session.sessionId;
                    await remember(sessionId);
                    pollForVerdict(sessionId);
                }

                tellDriver(verdictStatus(verdict));
            }),
        [run, fetchVerdict, stopPolling, forget, remember, pollForVerdict],
    );

    /** Ask again for the verdict on a check that is under review. */
    const checkStatus = useCallback(
        () =>
            run(async () => {
                const verdict = await fetchVerdict();
                const status = verdictStatus(verdict);

                if (status === "approved" || status === "declined") {
                    tellDriver(status);
                } else if (!verdict) {
                    Alert.alert(
                        "Couldn't check your ID",
                        "Please check your connection and try again.",
                    );
                } else if (status !== "in_review" && diditGaveUp(verdict)) {
                    Alert.alert(
                        "ID check didn't finish",
                        "Tap Verify ID on your profile to try again.",
                    );
                } else {
                    Alert.alert(
                        "ID check in review",
                        "Your ID check is being reviewed. We'll update your profile as soon as it's done.",
                    );
                }
            }),
        [run, fetchVerdict],
    );

    return {
        busy,
        verify,
        checkStatus,
        recheck,
        noteServerState,
        /**
         * The driver finished a check that Didit has not decided yet. The
         * server still says skipped or pending meanwhile: show it as in review.
         */
        awaitingVerdict: awaiting !== null,
    };
}
