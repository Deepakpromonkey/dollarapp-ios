import AppText from "@/components/AppText";
import LoadDrawer from "@/components/LoadDrawer";
import LoadHeader from "@/components/LoadHeader";
import RetryNotice from "@/components/loads/RetryNotice";
import ShipmentCard from "@/components/loads/ShipmentCard";
import PageHeader from "@/components/PageHeader";
import SectionHeader from "@/components/SectionHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";
import MaterialIcons from "@expo/vector-icons/build/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoadsScreen() {
    const theme = useAppTheme();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { active, upcoming, past, loading, error, refresh } = useShipments();
    const [pulling, setPulling] = useState(false);

    useRefreshOnFocusAndForeground(refresh);

    /* The spinner follows the driver's pull, not the quiet refresh on focus. */
    const onPull = useCallback(async () => {
        setPulling(true);
        try {
            await refresh();
        } finally {
            setPulling(false);
        }
    }, [refresh]);

    // Nothing loaded and the request failed: "No active loads" would be a guess.
    const nothingLoaded =
        active.length === 0 && upcoming.length === 0 && past.length === 0;
    const showSections = !(error && nothingLoaded);

    // Every active load: showing only the first made any other one vanish from this tab.
    const activePreview = active;
    const upcomingPreview = upcoming.slice(0, 2);
    const pastPreview = past.slice(0, 2);

    const renderLoads = (
        loads: Shipment[],
        emptyLabel: string,
        isActive = false,
    ) => {
        if (loading && loads.length === 0) {
            return (
                <ActivityIndicator
                    color={theme.primaryButton}
                    style={{ marginVertical: 12 }}
                />
            );
        }

        if (loads.length === 0) {
            return (
                <AppText
                    variant="caption"
                    style={[styles.empty, { color: theme.secondaryText }]}>
                    {emptyLabel}
                </AppText>
            );
        }

        return loads.map((s) => (
            <ShipmentCard
                key={s.id}
                shipment={s}
                isActive={isActive}
                onPress={() => router.push(`/loads/${s.id}`)}
            />
        ));
    };

    return (
        <View style={{ flex: 1 }}>
            <SafeAreaView
                edges={["top"]}
                style={[styles.container, { backgroundColor: theme.card }]}>
                <StatusBar
                    backgroundColor={theme.card}
                    barStyle="dark-content"
                />
                <View
                    style={[
                        styles.inner,
                        { backgroundColor: theme.background },
                    ]}>
                    <LoadHeader
                        title="Load Identifier"
                        live
                        onMenuPress={() => setDrawerOpen(true)}
                    />

                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={pulling}
                                onRefresh={onPull}
                                tintColor={theme.primaryButton}
                            />
                        }>
                        <PageHeader
                            title="Loads"
                            subtitle="Manage your current and upcoming transport schedule."
                        />

                        {error ? (
                            <RetryNotice
                                title={
                                    nothingLoaded
                                        ? "Couldn't get your loads"
                                        : "Couldn't update your loads"
                                }
                                message={error}
                                onRetry={onPull}
                                busy={pulling}
                                style={styles.notice}
                            />
                        ) : upcoming.length > 0 ? (
                            <View
                                style={[
                                    styles.banner,
                                    { backgroundColor: theme.card },
                                ]}>
                                <MaterialIcons
                                    name="verified"
                                    size={22}
                                    color={theme.primaryButton}
                                />
                                <AppText
                                    variant="caption"
                                    style={{
                                        color: theme.text,
                                        flex: 1,
                                        lineHeight: 20,
                                    }}>
                                    Your next scheduled load is ready.
                                </AppText>
                            </View>
                        ) : null}

                        {showSections && (
                            <>
                                <SectionHeader label="Active" dot="accent" />
                                <View style={styles.section}>
                                    {renderLoads(activePreview, "No active loads", true)}
                                </View>

                                <SectionHeader
                                    label="Upcoming"
                                    right={
                                        <Pressable
                                            onPress={() =>
                                                router.push("/loads/upcoming")
                                            }
                                            hitSlop={8}>
                                            <AppText
                                                variant="caption"
                                                style={{
                                                    color: theme.primaryButton,
                                                }}>
                                                See All
                                            </AppText>
                                        </Pressable>
                                    }
                                />
                                <View style={styles.section}>
                                    {renderLoads(upcomingPreview, "No upcoming loads")}
                                </View>

                                <SectionHeader
                                    label="Past"
                                    right={
                                        <Pressable
                                            onPress={() => router.push("/loads/past")}
                                            hitSlop={8}>
                                            <AppText
                                                variant="caption"
                                                style={{
                                                    color: theme.primaryButton,
                                                    fontWeight: "600",
                                                }}>
                                                See All
                                            </AppText>
                                        </Pressable>
                                    }
                                />
                                <View style={styles.section}>
                                    {renderLoads(pastPreview, "No past loads")}
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>

            <LoadDrawer
                visible={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    inner: {
        flex: 1,
    },
    content: {
        paddingBottom: 120,
        paddingHorizontal: 20,
    },
    notice: {
        marginBottom: 24,
    },
    banner: {
        marginBottom: 24,
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    section: {
        marginBottom: 24,
    },
    empty: {
        textAlign: "center",
        paddingVertical: 12,
    },
});
