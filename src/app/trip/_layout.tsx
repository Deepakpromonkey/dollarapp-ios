import { Stack } from "expo-router";

export default function TripLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="equipment-verification" />
            <Stack.Screen name="loaded-shipper-form" />
            <Stack.Screen name="delivered-receiver-form" />
            <Stack.Screen name="complete-delivery-form" />
        </Stack>
    );
}
