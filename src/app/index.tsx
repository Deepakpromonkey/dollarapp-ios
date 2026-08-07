import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import { View } from "react-native";

export default function Index() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <View style={{ flex: 1 }} />;
    }

    if (user) {
        return <Redirect href="/(tabs)/trip" />;
    }

    return <Redirect href="/(auth)/login" />;
}
