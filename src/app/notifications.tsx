import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import { Fonts } from "@/constants/fonts";
import { useNotifications } from "@/context/NotificationsContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useRefreshOnFocusAndForeground } from "@/hooks/useRefreshOnFocusAndForeground";
import { onInvalidate } from "@/lib/invalidate";
import { friendlyError } from "@/lib/loadApi";
import { notificationsApi, type AppNotification } from "@/lib/notificationsApi";
import { notificationDataFromRow, openNotificationTarget } from "@/utils/notificationRouting";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    SectionList,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/*
| The notification inbox.
|
| Newest first, 20 at a time, loading older pages as the driver scrolls. The
| server collapses repeats of the same alert while they are unread (a load
| losing GPS every ten minutes is one row, "×6", not six), so a row can stand
| for several pushes.
*/

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

interface TypeLook {
    icon: Glyph;
    color: string;
}

const BLUE = "#2563EB";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const RED = "#EF4444";

/* Types the app does not know yet still get a row: a plain bell. */
const TYPE_LOOK: Record<string, TypeLook> = {
    load_assigned: { icon: "truck-plus-outline", color: BLUE },
    chat_message: { icon: "message-text-outline", color: BLUE },
    gps_lost: { icon: "crosshairs-off", color: RED },
    tracking_disabled: { icon: "map-marker-alert-outline", color: AMBER },
    stop_arrival: { icon: "map-marker-check-outline", color: GREEN },
    identity_verified: { icon: "shield-check-outline", color: GREEN },
    identity_declined: { icon: "shield-alert-outline", color: RED },
};

function lookFor(type: string, fallbackColor: string): TypeLook {
    return TYPE_LOOK[type] ?? { icon: "bell-outline", color: fallbackColor };
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfDay(date: Date): number {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
}

/* Formatted by hand so every phone shows the same thing, whatever its locale support. */
function clockTime(date: Date): string {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

function whenLabel(iso: string, todayStart: number): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const day = startOfDay(date);
    if (day >= todayStart) return clockTime(date);
    // Counted in calendar days, not 24 hours, so a clock change does not shift it.
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    if (day >= yesterday.getTime()) return `Yesterday, ${clockTime(date)}`;
    return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${clockTime(date)}`;
}

interface Section {
    title: string;
    data: AppNotification[];
}

interface Inbox {
    items: AppNotification[];
    /** Cursor for the page after the last item shown; null once everything is loaded. */
    nextCursor: string | null;
}

const EMPTY_INBOX: Inbox = { items: [], nextCursor: null };

/* Older pages appended below, skipping anything already shown. */
function appendOlder(current: AppNotification[], older: AppNotification[]): AppNotification[] {
    const seen = new Set(current.map((n) => n.uuid));
    return [...current, ...older.filter((n) => !seen.has(n.uuid))];
}

/*
| Put a fresh first page on top of what is already loaded.
|
| Coming back to the inbox reloads the newest page; throwing away the older
| pages the driver had scrolled through would jump them back to the top. The
| list is ordered by the server, so everything below the fresh page's last row
| can stay, and so can the cursor that continues after it. If none of the
| fresh page was on screen (a whole page of new arrivals), the gap cannot be
| known, and the list starts over from the fresh page.
*/
function mergeFirstPage(current: Inbox, first: AppNotification[], firstCursor: string | null): Inbox {
    const last = first[first.length - 1];
    const lastIndex = last ? current.items.findIndex((n) => n.uuid === last.uuid) : -1;
    if (lastIndex === -1) return { items: first, nextCursor: firstCursor };

    const fresh = new Set(first.map((n) => n.uuid));
    const below = current.items.slice(lastIndex + 1).filter((n) => !fresh.has(n.uuid));
    return { items: [...first, ...below], nextCursor: current.nextCursor };
}

export default function NotificationsScreen() {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const { unreadCount, markRead, markAllRead, trackUnreadCount } = useNotifications();

    const [inbox, setInbox] = useState<Inbox>(EMPTY_INBOX);
    const { items, nextCursor } = inbox;
    /* "loading" and "failed" only describe the first page; after that the list stays up. */
    const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
    const [error, setError] = useState<string | null>(null);
    const [pulling, setPulling] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState<string | null>(null);
    const [markingAll, setMarkingAll] = useState(false);

    /*
    | Reloading the first page replaces the whole list, so an older page still
    | on its way must not be appended to the new one: every load remembers the
    | generation it started in and is dropped if the list has moved on.
    */
    const generationRef = useRef(0);
    const loadingMoreRef = useRef(false);

    // A promise chain, so state is only ever set once the page has answered.
    const loadFirstPage = useCallback((): Promise<void> => {
        const generation = ++generationRef.current;
        // An older page still on its way is dropped below, so stop waiting for it.
        loadingMoreRef.current = false;
        const reportUnread = trackUnreadCount();

        return notificationsApi
            .list(null)
            .then(({ data }) => {
                if (generation !== generationRef.current) return;
                const page = data.data;
                const first = Array.isArray(page?.notifications) ? page.notifications : [];
                setInbox((current) => mergeFirstPage(current, first, page?.next_cursor ?? null));
                setError(null);
                setMoreError(null);
                setPhase("ready");
                reportUnread(page?.unread_count ?? 0);
            })
            .catch((err: unknown) => {
                if (generation !== generationRef.current) return;
                setError(friendlyError(err, "Could not load your notifications."));
                setPhase((current) => (current === "ready" ? "ready" : "failed"));
            })
            .finally(() => {
                if (generation === generationRef.current) setLoadingMore(false);
            });
    }, [trackUnreadCount]);

    const loadMore = useCallback(async () => {
        if (!nextCursor || loadingMoreRef.current || phase !== "ready") return;
        loadingMoreRef.current = true;
        const generation = generationRef.current;
        setLoadingMore(true);
        setMoreError(null);

        try {
            const { data } = await notificationsApi.list(nextCursor);
            if (generation !== generationRef.current) return;
            const older = Array.isArray(data.data?.notifications) ? data.data.notifications : [];
            setInbox((current) => ({
                items: appendOlder(current.items, older),
                nextCursor: data.data?.next_cursor ?? null,
            }));
        } catch (err) {
            if (generation !== generationRef.current) return;
            setMoreError(friendlyError(err, "Could not load older notifications."));
        } finally {
            if (generation === generationRef.current) {
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        }
    }, [nextCursor, phase]);

    useEffect(() => {
        loadFirstPage();

        const offNotifications = onInvalidate("notifications", () => {
            loadFirstPage();
        });
        const offSession = onInvalidate("session", () => {
            generationRef.current += 1;
            loadingMoreRef.current = false;
            setInbox(EMPTY_INBOX);
            setError(null);
            setMoreError(null);
            setPhase("loading");
        });
        return () => {
            offNotifications();
            offSession();
        };
    }, [loadFirstPage]);

    useRefreshOnFocusAndForeground(loadFirstPage);

    const handlePull = useCallback(async () => {
        setPulling(true);
        try {
            await loadFirstPage();
        } finally {
            setPulling(false);
        }
    }, [loadFirstPage]);

    const handleRetry = useCallback(() => {
        setPhase("loading");
        setError(null);
        loadFirstPage();
    }, [loadFirstPage]);

    const handlePress = useCallback(
        (item: AppNotification) => {
            if (!item.read_at) {
                const now = new Date().toISOString();
                setInbox((current) => ({
                    ...current,
                    items: current.items.map((n) =>
                        n.uuid === item.uuid ? { ...n, read_at: now } : n,
                    ),
                }));
                void markRead(item.uuid);
            }
            openNotificationTarget(notificationDataFromRow(item));
        },
        [markRead],
    );

    const hasUnreadRows = items.some((n) => !n.read_at);

    const handleMarkAllRead = useCallback(async () => {
        const newest = items[0];
        if (!newest || markingAll) return;

        setMarkingAll(true);
        const now = new Date().toISOString();
        // Only what is on screen: anything newer that lands meanwhile stays unread.
        setInbox((current) => ({
            ...current,
            items: current.items.map((n) => (n.read_at ? n : { ...n, read_at: now })),
        }));

        const saved = await markAllRead(newest.uuid);
        if (!saved) {
            // Show what the server really has, then say why it is still unread.
            await loadFirstPage();
            setError("Couldn't mark everything as read. Try again.");
        }
        setMarkingAll(false);
    }, [items, markingAll, markAllRead, loadFirstPage]);

    const todayStart = startOfDay(new Date());

    const sections = useMemo<Section[]>(() => {
        const today: AppNotification[] = [];
        const earlier: AppNotification[] = [];
        for (const item of items) {
            const time = new Date(item.created_at).getTime();
            (Number.isFinite(time) && time >= todayStart ? today : earlier).push(item);
        }
        const result: Section[] = [];
        if (today.length) result.push({ title: "Today", data: today });
        if (earlier.length) result.push({ title: "Earlier", data: earlier });
        return result;
    }, [items, todayStart]);

    const renderItem = ({ item }: { item: AppNotification }) => {
        const unread = !item.read_at;
        const look = lookFor(item.type, theme.secondaryText);

        return (
            <Pressable
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityHint={unread ? "Unread" : undefined}
                style={({ pressed }) => [
                    styles.row,
                    {
                        backgroundColor: theme.card,
                        borderColor: unread ? `${theme.primaryButton}40` : theme.cardSecondary,
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}>
                <View style={[styles.iconCircle, { backgroundColor: `${look.color}18` }]}>
                    <MaterialCommunityIcons name={look.icon} size={20} color={look.color} />
                </View>

                <View style={styles.rowBody}>
                    <View style={styles.rowTitleLine}>
                        <AppText
                            variant="label1"
                            numberOfLines={2}
                            style={{
                                flex: 1,
                                color: theme.text,
                                fontFamily: unread ? Fonts.semiBold : Fonts.regular,
                            }}>
                            {item.title}
                        </AppText>
                        {item.occurrences > 1 && (
                            <View style={[styles.repeatPill, { backgroundColor: theme.cardSecondary }]}>
                                <AppText
                                    variant="tiny"
                                    style={{ color: theme.secondaryText, fontFamily: Fonts.semiBold }}>
                                    ×{item.occurrences}
                                </AppText>
                            </View>
                        )}
                    </View>

                    {item.body ? (
                        <AppText
                            variant="caption"
                            numberOfLines={3}
                            style={{ color: unread ? theme.text : theme.secondaryText }}>
                            {item.body}
                        </AppText>
                    ) : null}

                    <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                        {whenLabel(item.created_at, todayStart)}
                    </AppText>
                </View>

                {unread ? (
                    <View style={[styles.unreadDot, { backgroundColor: theme.primaryButton }]} />
                ) : (
                    <View style={styles.unreadDotSpace} />
                )}
            </Pressable>
        );
    };

    const renderFooter = () => {
        if (loadingMore) {
            return (
                <View style={styles.footer}>
                    <ActivityIndicator size="small" color={theme.primaryButton} />
                </View>
            );
        }
        if (moreError) {
            return (
                <Pressable onPress={loadMore} style={styles.footer} hitSlop={8}>
                    <AppText variant="caption" style={{ color: theme.secondaryText, textAlign: "center" }}>
                        {moreError}
                    </AppText>
                    <AppText variant="caption" style={{ color: theme.primaryButton, marginTop: 4 }}>
                        Tap to try again
                    </AppText>
                </Pressable>
            );
        }
        return null;
    };

    let body;
    if (phase === "loading") {
        body = (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primaryButton} />
            </View>
        );
    } else if (phase === "failed") {
        body = (
            <View style={styles.centered}>
                <MaterialCommunityIcons name="bell-off-outline" size={40} color={theme.secondaryText} />
                <AppText variant="body" style={{ color: theme.text, textAlign: "center" }}>
                    {"Couldn't load your notifications"}
                </AppText>
                {error ? (
                    <AppText variant="caption" style={{ color: theme.secondaryText, textAlign: "center" }}>
                        {error}
                    </AppText>
                ) : null}
                <AppButton title="Try again" onPress={handleRetry} style={styles.retryButton} />
            </View>
        );
    } else {
        body = (
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.uuid}
                renderItem={renderItem}
                renderSectionHeader={({ section }) => (
                    <AppText
                        variant="caption"
                        style={[styles.sectionTitle, { color: theme.secondaryText, backgroundColor: theme.background }]}>
                        {section.title}
                    </AppText>
                )}
                stickySectionHeadersEnabled={false}
                ListHeaderComponent={
                    items.length > 0 || error ? (
                        <View style={styles.listHeader}>
                            {error ? (
                                <View style={styles.errorBanner}>
                                    <AppText variant="caption" style={{ color: RED }}>
                                        {error}
                                    </AppText>
                                </View>
                            ) : null}
                            {items.length > 0 ? (
                                <View style={styles.summaryRow}>
                                    <AppText variant="caption" style={{ color: theme.secondaryText }}>
                                        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                                    </AppText>
                                    {hasUnreadRows ? (
                                        <Pressable
                                            onPress={handleMarkAllRead}
                                            disabled={markingAll}
                                            hitSlop={10}
                                            accessibilityRole="button"
                                            style={({ pressed }) => [
                                                styles.markAll,
                                                { opacity: pressed || markingAll ? 0.6 : 1 },
                                            ]}>
                                            <MaterialCommunityIcons
                                                name="check-all"
                                                size={16}
                                                color={theme.primaryButton}
                                            />
                                            <AppText
                                                variant="caption"
                                                style={{ color: theme.primaryButton, fontFamily: Fonts.semiBold }}>
                                                Mark all read
                                            </AppText>
                                        </Pressable>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="bell-outline" size={40} color={theme.secondaryText} />
                        <AppText variant="body" style={{ color: theme.text, textAlign: "center" }}>
                            No notifications yet
                        </AppText>
                        <AppText variant="caption" style={{ color: theme.secondaryText, textAlign: "center" }}>
                            New loads, messages from your broker and tracking alerts will show up here.
                        </AppText>
                    </View>
                }
                ListFooterComponent={renderFooter}
                onEndReached={loadMore}
                onEndReachedThreshold={0.4}
                refreshControl={
                    <RefreshControl
                        refreshing={pulling}
                        onRefresh={handlePull}
                        tintColor={theme.primaryButton}
                        colors={[theme.primaryButton]}
                    />
                }
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 24 },
                    sections.length === 0 && styles.listContentEmpty,
                ]}
                showsVerticalScrollIndicator={false}
            />
        );
    }

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <NavHeader title="Notifications" />
            {body}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        gap: 10,
    },
    retryButton: {
        marginTop: 8,
        alignSelf: "stretch",
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 8,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    listHeader: {
        gap: 8,
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
    },
    markAll: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    errorBanner: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#EF444440",
        backgroundColor: "#EF444418",
        padding: 12,
    },
    sectionTitle: {
        paddingHorizontal: 4,
        paddingTop: 8,
        paddingBottom: 2,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: "center",
        alignItems: "center",
    },
    rowBody: {
        flex: 1,
        gap: 4,
    },
    rowTitleLine: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    repeatPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
    },
    unreadDotSpace: {
        width: 10,
    },
    footer: {
        paddingVertical: 20,
        alignItems: "center",
    },
    empty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        paddingVertical: 48,
        gap: 10,
    },
});
