import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The chat on one load.
 *
 * There is no websocket on the driver API, so new messages are polled while the
 * screen is open. The request carries the last message the app already holds, so
 * a poll that finds nothing costs almost nothing — that is what makes a short
 * interval reasonable.
 */

export interface ChatMessage {
    uuid: string;
    shipment_id: number;
    sender_type: "broker" | "driver";
    sender_id: number;
    sender_name: string | null;
    body: string;
    read_at: string | null;
    created_at: string;
}

interface ChatResponse {
    status: boolean;
    message: string;
    data: {
        shipment: {
            uuid: string;
            shipment_no: string;
            pro_number: string | null;
            carrier_name: string | null;
        };
        viewer: "driver";
        messages: ChatMessage[];
    };
}

const POLL_MS = 4000;

interface ChatState {
    messages: ChatMessage[];
    shipmentNo: string | null;
    loading: boolean;
    sending: boolean;
    error: string | null;
    send: (body: string) => Promise<void>;
}

export function useShipmentChat(uuid: string | null | undefined): ChatState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [shipmentNo, setShipmentNo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Held in a ref as well as state so the poller reads the current cursor
    // without being torn down and recreated on every message.
    const lastUuid = useRef<string | null>(null);

    const merge = useCallback((incoming: ChatMessage[]) => {
        if (incoming.length === 0) return;

        setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.uuid));
            const fresh = incoming.filter((m) => !seen.has(m.uuid));
            if (fresh.length === 0) return prev;

            const next = [...prev, ...fresh];
            lastUuid.current = next[next.length - 1].uuid;
            return next;
        });
    }, []);

    const load = useCallback(
        async (incremental: boolean) => {
            if (!uuid) return;

            try {
                const path = incremental && lastUuid.current
                    ? `/shipments/${uuid}/messages?after=${lastUuid.current}`
                    : `/shipments/${uuid}/messages`;

                const res = await api.get<ChatResponse>(path);
                const payload = res.data?.data;

                setShipmentNo(payload?.shipment?.shipment_no ?? null);
                merge(payload?.messages ?? []);
                setError(null);
            } catch (err: unknown) {
                // A failed poll is not worth an error banner over a thread the
                // driver can already read — only the first load reports.
                if (!incremental) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Could not load the conversation",
                    );
                }
            } finally {
                setLoading(false);
            }
        },
        [uuid, merge],
    );

    useEffect(() => {
        if (!uuid) {
            setLoading(false);
            return;
        }

        lastUuid.current = null;
        setMessages([]);
        setLoading(true);

        load(false);

        const timer = setInterval(() => load(true), POLL_MS);
        return () => clearInterval(timer);
    }, [uuid, load]);

    const send = useCallback(
        async (body: string) => {
            const trimmed = body.trim();
            if (!uuid || !trimmed) return;

            setSending(true);
            try {
                const res = await api.post<{ data: ChatMessage }>(
                    `/shipments/${uuid}/messages`,
                    { body: trimmed },
                );

                // Appended from the server's response rather than optimistically,
                // so the message the driver sees is the one that was stored —
                // with its real timestamp and uuid for the poll cursor.
                const saved = res.data?.data;
                if (saved) merge([saved]);
            } catch (err: unknown) {
                setError(
                    err instanceof Error ? err.message : "Message not sent",
                );
                throw err;
            } finally {
                setSending(false);
            }
        },
        [uuid, merge],
    );

    return { messages, shipmentNo, loading, sending, error, send };
}
