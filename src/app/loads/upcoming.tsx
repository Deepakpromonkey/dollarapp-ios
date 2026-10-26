import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import RetryNotice from "@/components/loads/RetryNotice";
import ShipmentCard from "@/components/loads/ShipmentCard";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { useShipments } from "@/hooks/useShipments";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AllUpcomingScreen() {
    const theme = useAppTheme();
    const { upcoming, loading, error, refresh } = useShipments();
    const [pulling, setPulling] = useState(false);

    useRefreshOnFocusAndForeground(refresh);

    const onPull = useCallback(async () => {
        setPulling(true);
        try {
            await refresh();
        } finally {
            setPulling(false);
        }
    }, [refresh]);

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Upcoming Loads" />

            {loading && upcoming.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={theme.primaryButton} size="large" />
                </View>
            ) : (
                // Kept on errors too, so pulling down is always a way to try again.
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={pulling}
                            onRefresh={onPull}
                            tintColor={theme.primaryButton}
                        />
                    }>
                    {error ? (
                        <RetryNotice
                            title={
                                upcoming.length === 0
                                    ? "Couldn't get your loads"
                                    : "Couldn't update your loads"
                            }
                            message={error}
                            onRetry={onPull}
                            busy={pulling}
                            style={styles.notice}
                        />
                    ) : upcoming.length === 0 ? (
                        <AppText
                            variant="caption"
                            style={[styles.empty, { color: theme.secondaryText }]}>
                            No upcoming loads
                        </AppText>
                    ) : null}

                    {upcoming.map((s) => (
                        <ShipmentCard
                            key={s.id}
                            shipment={s}
                            onPress={() => router.push(`/loads/${s.id}`)}
                        />
                    ))}
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
    notice: {
        marginBottom: 16,
    },
    empty: {
        textAlign: "center",
        paddingVertical: 40,
    },
});
