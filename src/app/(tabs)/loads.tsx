import AppText from "@/components/AppText";
import LoadDrawer from "@/components/LoadDrawer";
import LoadHeader from "@/components/LoadHeader";
import ShipmentCard from "@/components/loads/ShipmentCard";
import PageHeader from "@/components/PageHeader";
import SectionHeader from "@/components/SectionHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useShipments } from "@/hooks/useShipments";
import MaterialIcons from "@expo/vector-icons/build/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
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

    const activePreview = active.slice(0, 1);
    const upcomingPreview = upcoming.slice(0, 2);
    const pastPreview = past.slice(0, 2);

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
                        onNotificationPress={() => {}}
                    />

                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={refresh}
                                tintColor={theme.primaryButton}
                            />
                        }>
                        <PageHeader
                            title="Loads"
                            subtitle="Manage your current and upcoming transport schedule."
                        />

                        {error ? (
                            <View
                                style={[
                                    styles.banner,
                                    { backgroundColor: theme.card },
                                ]}>
                                <MaterialIcons
                                    name="error-outline"
                                    size={22}
                                    color={theme.err}
                                />
                                <AppText
                                    variant="caption"
                                    style={{
                                        color: theme.err,
                                        flex: 1,
                                        lineHeight: 20,
                                    }}>
                                    {error}
                                </AppText>
                            </View>
                        ) : (
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
                        )}

          
                        <SectionHeader label="Active" dot="accent" />
                        <View style={styles.section}>
                            {loading && activePreview.length === 0 ? (
                                <ActivityIndicator
                                    color={theme.primaryButton}
                                    style={{ marginVertical: 12 }}
                                />
                            ) : activePreview.length === 0 ? (
                                <AppText
                                    variant="caption"
                                    style={[
                                        styles.empty,
                                        { color: theme.secondaryText },
                                    ]}>
                                    No active loads
                                </AppText>
                            ) : (
                                activePreview.map((s) => (
                                    <ShipmentCard
                                        key={s.id}
                                        shipment={s}
                                        isActive
                                        onPress={() => router.push(`/loads/${s.id}`)}
                                    />
                                ))
                            )}
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
                            {loading && upcomingPreview.length === 0 ? (
                                <ActivityIndicator
                                    color={theme.primaryButton}
                                    style={{ marginVertical: 12 }}
                                />
                            ) : upcomingPreview.length === 0 ? (
                                <AppText
                                    variant="caption"
                                    style={[
                                        styles.empty,
                                        { color: theme.secondaryText },
                                    ]}>
                                    No upcoming loads
                                </AppText>
                            ) : (
                                upcomingPreview.map((s) => (
                                    <ShipmentCard
                                        key={s.id}
                                        shipment={s}
                                        onPress={() => router.push(`/loads/${s.id}`)}
                                    />
                                ))
                            )}
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
                            {loading && pastPreview.length === 0 ? (
                                <ActivityIndicator
                                    color={theme.primaryButton}
                                    style={{ marginVertical: 12 }}
                                />
                            ) : pastPreview.length === 0 ? (
                                <AppText
                                    variant="caption"
                                    style={[
                                        styles.empty,
                                        { color: theme.secondaryText },
                                    ]}>
                                    No past loads
                                </AppText>
                            ) : (
                                pastPreview.map((s) => (
                                    <ShipmentCard
                                        key={s.id}
                                        shipment={s}
                                        onPress={() => router.push(`/loads/${s.id}`)}
                                    />
                                ))
                            )}
                        </View>
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
