import { api } from "@/lib/api";

/**
 * The driver's notification inbox: everything the server told the driver (new
 * loads, broker messages, tracking problems, arrivals, identity checks), kept
 * so it can be read again after the push itself is gone.
 */

interface Envelope<T> {
    status: boolean;
    message: string;
    data: T;
}

/*
| The types the API sends today. New ones can appear before the app knows
| them, so anything reading `type` must have a generic fallback rather than
| assume this list is complete.
*/
export type NotificationType =
    | "load_assigned"
    | "chat_message"
    | "gps_lost"
    | "tracking_disabled"
    | "stop_arrival"
    | "identity_verified"
    | "identity_declined";

/**
 * What a notification points at. Shared by inbox rows, OneSignal pushes and
 * the app's own arrival alerts, so every field but `type` may be missing.
 */
export interface NotificationData {
    type?: NotificationType | (string & {});
    shipment_uuid?: string | null;
    stop_id?: number | string | null;
    notification_uuid?: string | null;
    [key: string]: unknown;
}

export interface AppNotification {
    uuid: string;
    type: NotificationType | (string & {});
    title: string;
    body: string;
    data: NotificationData | null;
    shipment_uuid: string | null;
    /** How many times this alert fired while unread; repeats collapse into one row. */
    occurrences: number;
    read_at: string | null;
    /** ISO 8601 with offset. */
    created_at: string;
}

export interface NotificationPage {
    /** Newest first. */
    notifications: AppNotification[];
    unread_count: number;
    /** Pass back as `cursor` for the next, older page; null on the last page. */
    next_cursor: string | null;
}

export interface UnreadCount {
    unread_count: number;
}

/**
 * Which notifications POST /notifications/read-all marks read. Each field
 * narrows it further; with none, the whole inbox is marked read.
 */
export interface ReadAllFilters {
    /** Only this notification and older ones, so anything that arrived while the driver was looking stays unread. */
    up_to_uuid?: string | null;
    /** Only notifications of this type. */
    type?: NotificationType;
    /** Only notifications about this load. */
    shipment_uuid?: string | null;
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

export const notificationsApi = {
    list: (cursor?: string | null, limit = NOTIFICATIONS_PAGE_SIZE) =>
        api.get<Envelope<NotificationPage>>("/notifications", {
            params: cursor ? { limit, cursor } : { limit },
        }),

    unreadCount: () =>
        api.get<Envelope<UnreadCount>>("/notifications/unread-count"),

    /** 404s when the notification is not this driver's (or no longer exists). */
    markRead: (uuid: string) =>
        api.post<Envelope<UnreadCount>>(
            `/notifications/${encodeURIComponent(uuid)}/read`,
        ),

    /**
     * Mark the inbox read, or only the part `filters` names.
     *
     * `type` and `shipment_uuid` need an API build that knows them: an older
     * one ignores them and marks the whole inbox read.
     */
    markAllRead: (filters: ReadAllFilters = {}) =>
        api.post<Envelope<UnreadCount>>("/notifications/read-all", {
            ...(filters.up_to_uuid ? { up_to_uuid: filters.up_to_uuid } : {}),
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.shipment_uuid ? { shipment_uuid: filters.shipment_uuid } : {}),
        }),

    /**
     * Copy an arrival the phone noticed into the inbox. The server checks the
     * stop is on one of this driver's loads and records each stop once.
     * Background tasks post this with fetch instead (see utils/arrivalAlerts).
     */
    recordArrival: (stopId: number) =>
        api.post<Envelope<{ recorded: boolean }>>("/notifications/arrival", {
            stop_id: stopId,
        }),

    /**
     * Point this driver's pushes at this phone's OneSignal subscription. Same
     * rule as at login: the subscription moves to this driver.
     */
    registerDeviceToken: (deviceToken: string) =>
        api.post<Envelope<{ saved: boolean }>>("/driver/device-token", {
            device_token: deviceToken,
        }),
} as const;
