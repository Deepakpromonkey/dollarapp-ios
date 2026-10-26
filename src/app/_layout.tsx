// First, before anything that renders: gesture handling has to be set up ahead of the screens.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "@/utils/LocationTracker";
/*
| Imported for its side effect, like the tracker above. The OS can wake the
| app on a geofence crossing from cold, and the task has to already be defined
| when it does — registering it from the trip screen would be too late, since
| that screen has not mounted yet. index.ts imports both ahead of the router as
| well; they stay here too, so nothing depends on which entry the build used.
*/
import "@/utils/arrivalAlerts";

import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    OneSignal,
    type NotificationClickEvent,
    type NotificationWillDisplayEvent,
    type PushSubscriptionChangedState,
} from "react-native-onesignal";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider, useNotifications } from "@/context/NotificationsContext";
import { ThemeProvider, useThemeContext } from "@/context/ThemeContext";
import { invalidate } from "@/lib/invalidate";
import { notificationsApi, type NotificationData } from "@/lib/notificationsApi";
import { configureNotificationHandler } from "@/utils/localNotifications";
import {
    goToTab,
    markLoadNotificationsRead,
    openNotificationTarget,
    toNotificationData,
} from "@/utils/notificationRouting";

const ONESIGNAL_APP_ID = "093cd863-0342-4491-a75e-61e728e7d542";

/*
| Push and local notifications are set up when this module loads, before any
| component mounts.
|
| The listeners below are added from effects, and React runs a child's effects
| before its parent's: had OneSignal still been initialised from RootLayout's
| own effect, the listeners would have reached the native SDK first.
|
| The expo-notifications handler is what lets the app's own alerts (arrivals,
| tracking warnings) show while it is open. It never asks for permission:
| OneSignal's prompt below is the one request for it.
*/
OneSignal.initialize(ONESIGNAL_APP_ID);
configureNotificationHandler();

SplashScreen.preventAutoHideAsync();

/*
| Alerts the app raises itself: arrivals (utils/arrivalAlerts) and tracking
| warnings (utils/locationHealth). Every other tap is OneSignal's.
*/
const LOCAL_ALERT_TYPES = new Set(["stop_arrival", "location_health"]);

/* Local alert taps already acted on, so a remount or a reload does not repeat one. */
const handledLocalResponses = new Set<string>();

/*
| What happens when a notification arrives or is tapped.
|
| A tap can come before the app knows who is signed in: a push opened from a
| closed app starts it, and the session is still being read from storage when
| OneSignal reports the tap. The target is held until that settles and the
| launch redirect has taken the driver into the app, then opened; a push
| tapped while signed out is dropped, since it was for whoever used to be
| signed in here.
*/
function NotificationListeners(): null {
    const { user, isLoading } = useAuth();
    const { refresh, markRead } = useNotifications();
    const segments = useSegments();

    const userId = user?.id ?? null;
    /* For the OneSignal listeners, which are registered once and outlive renders. */
    const userIdRef = useRef(userId);
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    const pendingRef = useRef<NotificationData | null>(null);
    const [pendingVersion, setPendingVersion] = useState(0);

    const open = useCallback((data: NotificationData) => {
        pendingRef.current = data;
        setPendingVersion((v) => v + 1);
    }, []);

    const first = segments[0] as string | undefined;
    const inApp = !isLoading && userId !== null && !!first && first !== "(auth)";

    useEffect(() => {
        const target = pendingRef.current;
        if (!target || isLoading) return;

        if (userId === null) {
            pendingRef.current = null;
            return;
        }
        if (!inApp) return;

        pendingRef.current = null;

        if (target.notification_uuid) {
            openNotificationTarget(target);
            void markRead(target.notification_uuid);
            return;
        }

        if (target.type === "location_health") {
            // The phone's own tracking warning: the banner on My Trip says what it means.
            goToTab("trip");
            return;
        }

        if (target.type === "stop_arrival") {
            /*
            | The phone's own arrival alert has no inbox uuid: the server files
            | its row a moment after the alert is shown. Clearing that load's
            | arrival rows instead keeps the bell from counting an arrival the
            | driver has just opened. Done here rather than in the tap listener
            | because only now is it certain someone is signed in to send it.
            */
            void markLoadNotificationsRead("stop_arrival", target.shipment_uuid).then(
                (marked) => {
                    if (!marked) void refresh();
                },
            );
            openNotificationTarget(target);
            return;
        }

        openNotificationTarget(target);
        void refresh();
    }, [pendingVersion, isLoading, userId, inApp, markRead, refresh]);

    /*
    | Pushes reach this phone through the OneSignal subscription the API has on
    | file for the driver. That was only ever sent at login and signup, so a
    | subscription that did not exist yet at login, or that OneSignal later
    | replaced, left the driver getting nothing until they logged in again.
    */
    const registeredRef = useRef<string | null>(null);

    const registerDeviceToken = useCallback(async (
        token: string | null | undefined,
        driverId: number | null = userIdRef.current,
    ) => {
        if (!token || driverId === null) return;

        const key = `${driverId}:${token}`;
        if (registeredRef.current === key) return;
        registeredRef.current = key;

        try {
            await notificationsApi.registerDeviceToken(token);
        } catch {
            // Try again on the next change or the next launch.
            if (registeredRef.current === key) registeredRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (userId === null) {
            registeredRef.current = null;
            return;
        }

        let cancelled = false;
        OneSignal.User.pushSubscription
            .getIdAsync()
            .then((id) => {
                if (!cancelled) void registerDeviceToken(id, userId);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [userId, registerDeviceToken]);

    useEffect(() => {
        const onClick = (event: NotificationClickEvent) => {
            open(toNotificationData(event.notification.additionalData));
        };

        const onForeground = (event: NotificationWillDisplayEvent) => {
            const notification = event.getNotification();
            /*
            | Once a foreground listener exists, the native bridge holds every
            | push back until JavaScript calls display(). Without this call, a
            | push arriving while the app is open would never be shown.
            */
            try {
                notification.display();
            } catch (err) {
                console.warn("[Notifications] Could not show a push:", err);
            }

            const data = toNotificationData(notification.additionalData);
            invalidate("notifications");
            if (data.type === "load_assigned" || data.type === "chat_message") {
                invalidate("shipments");
            }
            if (data.type === "identity_verified" || data.type === "identity_declined") {
                invalidate("profile");
            }
        };

        const onSubscriptionChange = (change: PushSubscriptionChangedState) => {
            void registerDeviceToken(change.current?.id);
        };

        OneSignal.Notifications.addEventListener("click", onClick);
        OneSignal.Notifications.addEventListener("foregroundWillDisplay", onForeground);
        OneSignal.User.pushSubscription.addEventListener("change", onSubscriptionChange);

        return () => {
            OneSignal.Notifications.removeEventListener("click", onClick);
            OneSignal.Notifications.removeEventListener("foregroundWillDisplay", onForeground);
            OneSignal.User.pushSubscription.removeEventListener("change", onSubscriptionChange);
        };
    }, [open, registerDeviceToken]);

    useEffect(() => {
        const handle = (response: Notifications.NotificationResponse | null) => {
            if (!response) return;

            const data = toNotificationData(response.notification.request.content.data);
            if (!data.type || !LOCAL_ALERT_TYPES.has(data.type)) return;

            const key = `${response.notification.request.identifier}:${response.notification.date}`;
            if (handledLocalResponses.has(key)) return;
            handledLocalResponses.add(key);

            open(data);
            Notifications.clearLastNotificationResponseAsync().catch(() => {});
        };

        const subscription = Notifications.addNotificationResponseReceivedListener(handle);
        // The tap that started the app from closed, if any.
        Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});

        return () => subscription.remove();
    }, [open]);

    return null;
}

function AppNavigator() {
    const { isDark } = useThemeContext();
    const { isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            SplashScreen.hideAsync();
        }
    }, [isLoading]);

    return (
        <>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }} />
        </>
    );
}

export default function RootLayout() {
    useEffect(() => {
        /*
        | false: never OneSignal's own "Open Settings" dialog. With true it was
        | shown on every launch to a driver who had declined notifications,
        | which is the repeated pressing App Review rejects (5.1.1(iv)). iOS
        | shows its system prompt once, while the choice is still open.
        */
        OneSignal.Notifications.requestPermission(false).catch(() => {});
    }, []);

    const [fontsLoaded, fontError] = useFonts({
        "Poppins-Regular": require("../../assets/fonts/Poppins-Regular.ttf"),
        "Poppins-Medium": require("../../assets/fonts/Poppins-Medium.ttf"),
        "Poppins-SemiBold": require("../../assets/fonts/Poppins-SemiBold.ttf"),
        "Poppins-Bold": require("../../assets/fonts/Poppins-Bold.ttf"),
    });

    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <AuthProvider>
                    <NotificationsProvider>
                        <NotificationListeners />
                        <AppNavigator />
                    </NotificationsProvider>
                </AuthProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
