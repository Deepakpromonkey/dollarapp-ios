import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import ShipmentCard from "@/components/loads/ShipmentCard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useShipments } from "@/hooks/useShipments";
import { router } from "expo-router";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AllPastScreen() {
    const theme = useAppTheme();
    const { past, loading, error, refresh } = useShipments();

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Past Loads" />

            {loading && past.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.primaryButton} size="large" />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <AppText variant="caption" style={{ color: theme.err }}>
                        {error}
                    </AppText>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={refresh}
                            tintColor={theme.primaryButton}
                        />
                    }>
                    {past.length === 0 ? (
                        <AppText
                            variant="caption"
                            style={[styles.empty, { color: theme.secondaryText }]}>
                            No past loads
                        </AppText>
                    ) : (
                        past.map((s) => (
                            <ShipmentCard
                                key={s.id}
                                shipment={s}
                                onPress={() => router.push(`/loads/${s.id}`)}
                            />
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    list: {
        padding: 20,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    empty: {
        textAlign: "center",
        paddingVertical: 40,
    },
});
