import { api } from "@/lib/api";
import type { StopEvent } from "@/types/shipment";

/**
 * The load a driver is running: starting it, answering the broker's questions
 * at each stop, and getting a dock to confirm loading and delivery.
 */

interface Envelope<T> {
    status: boolean;
    message: string;
    data: T;
}

export interface StopEventsPayload {
    stop_id: number;
    stop_type?: string;
    stop_name?: string;
    events: StopEvent[];
    outstanding?: number;
}

/** Which end of the trip a verification code is for. */
export type OtpPurpose = "load" | "delivery";

export const loadApi = {
    /**
     * Move a load from Upcoming to Active. One way — the API refuses a second
     * call, which is why the button disappears once `is_activated` is set.
     */
    activate: (uuid: string) =>
        api.post<Envelope<unknown>>(`/shipments/${uuid}/activate`),

    getStopEvents: (uuid: string, stopId: number) =>
        api.get<Envelope<StopEventsPayload>>(
            `/shipments/${uuid}/stops/${stopId}/events`,
        ),

    /**
     * Send the driver's answers.
     *
     * Text answers and photos travel together under the same `answers[<id>]`
     * key, so this is always multipart even when nothing was photographed.
     */
    saveStopEvents: (
        uuid: string,
        stopId: number,
        answers: Record<string, string>,
        images: Record<string, { uri: string; name: string; type: string }>,
        coords?: { latitude: number; longitude: number } | null,
    ) => {
        const form = new FormData();

        Object.entries(answers).forEach(([eventId, value]) => {
            form.append(`answers[${eventId}]`, value);
        });

        Object.entries(images).forEach(([eventId, file]) => {
            form.append(`answers[${eventId}]`, file as unknown as Blob);
        });

        if (coords) {
            form.append("latitude", String(coords.latitude));
            form.append("longitude", String(coords.longitude));
        }

        return api.upload<Envelope<StopEventsPayload>>(
            `/shipments/${uuid}/stops/${stopId}/events`,
            form,
        );
    },

    /**
     * Ask the API to text a code to the contact at the stop. The driver never
     * receives it — someone at the dock reads it out.
     */
    sendStopOtp: (uuid: string, purpose: OtpPurpose) =>
        api.post<Envelope<{ sent_to: string; expires_in_minutes: number; stop_id: number }>>(
            `/shipments/${uuid}/journey/send-stop-otp`,
            { purpose },
        ),
} as const;
