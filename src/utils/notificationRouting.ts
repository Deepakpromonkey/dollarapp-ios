import { router, type Href } from "expo-router";

import { invalidate } from "@/lib/invalidate";
import {
    notificationsApi,
    type AppNotification,
    type NotificationData,
    type NotificationType,
} from "@/lib/notificationsApi";

/*
| Where a notification takes the driver.
|
| One map for every way a notification can be opened: a tapped OneSignal push,
| a tapped arrival alert the phone raised itself, and a row in the inbox. Each
| target also marks the data behind it as stale, because a driver opening "New
| load assigned" expects to see that load, not the list from before it arrived.
*/

/* Not in the generated route types until the dev server regenerates them. */
const INBOX = "/notifications" as Href;

export type TabName = "trip" | "loads" | "profile";

const TAB_HREF: Record<TabName, Href> = {
    trip: "/(tabs)/trip",
    loads: "/(tabs)/loads",
    profile: "/(tabs)/profile",
};

/**
 * Show one of the bottom tabs, from anywhere.
 *
 * Pushing a tab from a screen stacked above the tabs (load detail, chat, this
 * inbox) mounts a second copy of the whole tab bar on top of the first, with
 * its own stale data underneath. From there the existing tabs are popped back
 * to instead. Inside the tabs there is nothing to pop, and popping would do
 * nothing at all, so the tab is simply switched.
 */
export function goToTab(tab: TabName): void {
    const href = TAB_HREF[tab];
    if (router.canDismiss()) {
        router.dismissTo(href);
    } else {
        router.navigate(href);
    }
}

function text(value: unknown): string | null {
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

/**
 * Normalise a push payload into NotificationData.
 *
 * OneSignal hands over `additionalData` as an untyped object, and older
 * pushes (the broker's load push, anything sent before data was added) carry
 * less than newer ones, so every field is read defensively.
 */
export function toNotificationData(raw: unknown): NotificationData {
    if (!raw || typeof raw !== "object") return {};
    const source = raw as Record<string, unknown>;
    return {
        ...source,
        type: text(source.type) ?? undefined,
        shipment_uuid: text(source.shipment_uuid),
        stop_id: text(source.stop_id),
        notification_uuid: text(source.notification_uuid),
    };
}

/** The target of an inbox row; the row's own columns win over its payload. */
export function notificationDataFromRow(row: AppNotification): NotificationData {
    const data = toNotificationData(row.data);
    return {
        ...data,
        type: text(row.type) ?? data.type,
        shipment_uuid: text(row.shipment_uuid) ?? data.shipment_uuid ?? null,
        notification_uuid: row.uuid,
    };
}

/**
 * Mark one load's notifications of one type read, once the driver has seen
 * that load. Resolves true when the server took it.
 *
 * Some alerts give the app no inbox uuid to mark. The broker's "New load
 * assigned" push is sent before the once-a-minute sync files its inbox row,
 * and an arrival alert is raised by this phone before its copy reaches the
 * server. Marking by type and load needs no uuid, and clears the row once it
 * has landed (which is why the load screen asks again on every return).
 *
 * Best effort and quiet: a failure leaves the row unread, and the inbox can
 * still clear it.
 */
export async function markLoadNotificationsRead(
    type: NotificationType,
    shipmentUuid: string | null | undefined,
): Promise<boolean> {
    const uuid = text(shipmentUuid);
    // Without a load this would mark that type read on every load.
    if (!uuid) return false;

    try {
        await notificationsApi.markAllRead({ type, shipment_uuid: uuid });
    } catch {
        return false;
    }

    // The bell's count, and the inbox if it is open underneath.
    invalidate("notifications");
    return true;
}

/**
 * Take the driver to whatever a notification is about.
 *
 * Unknown types open the inbox, where the text is readable in full; opening
 * the inbox from the inbox stays where it is rather than stacking a copy.
 */
export function openNotificationTarget(data: NotificationData): void {
    const shipmentUuid = text(data.shipment_uuid);

    switch (data.type) {
        case "load_assigned":
            invalidate("shipments");
            if (shipmentUuid) {
                router.navigate({ pathname: "/loads/[id]", params: { id: shipmentUuid } });
            } else {
                goToTab("loads");
            }
            return;

        case "chat_message":
            // Unread counts on the load cards change once the thread is opened.
            invalidate("shipments");
            if (shipmentUuid) {
                router.navigate({ pathname: "/chat", params: { uuid: shipmentUuid } });
            } else {
                router.navigate(INBOX);
            }
            return;

        case "gps_lost":
        case "tracking_disabled":
        case "stop_arrival":
            invalidate("trip");
            goToTab("trip");
            return;

        case "identity_verified":
        case "identity_declined":
            invalidate("profile");
            goToTab("profile");
            return;

        default:
            router.navigate(INBOX);
    }
}
