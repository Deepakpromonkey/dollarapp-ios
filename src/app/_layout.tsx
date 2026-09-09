import "react-native-gesture-handler";
import "@/utils/LocationTracker";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useThemeContext } from "@/context/ThemeContext";
import {
    configureNotificationHandler,
    ensureNotificationPermission,
} from "@/utils/localNotifications";

import { OneSignal } from 'react-native-onesignal';

SplashScreen.preventAutoHideAsync();

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
        OneSignal.initialize("093cd863-0342-4491-a75e-61e728e7d542");
        OneSignal.Notifications.requestPermission(true);

        /*
        | Local notifications are what tell a driver their location has been
        | switched off. They share the OS-level permission OneSignal just asked
        | for, so this normally resolves without a second prompt — but the
        | handler has to be installed either way or anything raised while the
        | app is open is dropped silently, which is precisely when a driver is
        | most likely to be toggling the setting.
        */
        configureNotificationHandler();
        ensureNotificationPermission().catch(() => {});
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
                    <AppNavigator />
                </AuthProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}