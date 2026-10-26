import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Refresh a screen's data when the driver comes back to it.
 *
 * Fires when the screen regains focus (switching tabs, returning from a pushed
 * screen) and when the app returns to the foreground while this screen is the
 * one showing. The very first focus is skipped, because the screen's own mount
 * fetch has just run.
 *
 * Throttled on purpose. On Android every permission dialog and every trip to
 * Settings moves the app to the background and back, and several screens may
 * share one backend that matches loads with an unindexable phone query, so a
 * burst of these events must cost one fetch, not five.
 *
 * @param refresh  Called to refetch. Keep it stable (useCallback) or the hook
 *                 will treat every render as a new screen.
 * @param minGapMs Minimum time between two refreshes triggered by this hook.
 */
export function useRefreshOnFocusAndForeground(
  refresh: () => void,
  minGapMs = 10_000,
): void {
  const focused = useRef(false);
  const seenFirstFocus = useRef(false);
  const lastRun = useRef(0);

  const refreshRef = useRef(refresh);

  // Both effects are declared before the focus effect so they run ahead of it.
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Counted from mount: the mount fetch is the first refresh.
  useEffect(() => {
    lastRun.current = Date.now();
  }, []);

  const run = useCallback(() => {
    const now = Date.now();
    if (now - lastRun.current < minGapMs) return;
    lastRun.current = now;
    refreshRef.current();
  }, [minGapMs]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (seenFirstFocus.current) {
        run();
      } else {
        seenFirstFocus.current = true;
      }
      return () => {
        focused.current = false;
      };
    }, [run]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && focused.current) run();
    });
    return () => subscription.remove();
  }, [run]);
}
