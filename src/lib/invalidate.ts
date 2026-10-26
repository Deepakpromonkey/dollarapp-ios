/*
| Telling the rest of the app that some data is out of date.
|
| Screens in the tab bar stay mounted for the whole session, so a screen that
| fetched once at mount kept showing whatever it got first: a load activated on
| the detail screen, a push about a new load, or an answer saved elsewhere did
| not reach the trip tab until the app was restarted. Anything that changes
| server state now announces it here, and anything holding a copy of that state
| listens and fetches again.
|
| Topics are deliberately coarse. Refetching a little more than strictly needed
| is cheap; a screen quietly showing yesterday's load is not.
*/

export type DataTopic =
  /** The driver's loads (GET /shipments): lists, trip header, load detail. */
  | "shipments"
  /** Journey and per-stop progress of the load being driven. */
  | "trip"
  /** Driver profile, verification state and equipment history. */
  | "profile"
  /** Notification inbox and unread badge. */
  | "notifications"
  /**
   * The signed-in driver changed or signed out. Every cache must drop what it
   * holds, so the next person on this phone never sees the last one's data.
   */
  | "session";

type Listener = () => void;

const listeners = new Map<DataTopic, Set<Listener>>();

/** Run `listener` whenever `topic` is invalidated. Returns an unsubscribe function. */
export function onInvalidate(topic: DataTopic, listener: Listener): () => void {
  let set = listeners.get(topic);
  if (!set) {
    set = new Set();
    listeners.set(topic, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Mark one or more kinds of data as stale. Safe to call from anywhere, including background tasks. */
export function invalidate(...topics: DataTopic[]): void {
  for (const topic of topics) {
    // Copied first: a listener that unsubscribes while running must not skip its neighbours.
    for (const listener of [...(listeners.get(topic) ?? [])]) {
      try {
        listener();
      } catch (err) {
        console.warn(`[invalidate] A "${topic}" listener failed:`, err);
      }
    }
  }
}
