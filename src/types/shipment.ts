/** How the broker wants a custom event answered. */
export type AnswerType =
    | "yes_no"
    | "text"
    | "textarea"
    | "number"
    | "image_upload";

/**
 * A question the broker attached to a stop, plus this driver's answer to it.
 *
 * The questions live on the stop; the answers are the driver's own. Loading and
 * delivery stay blocked until every `required` one has been answered.
 */
export interface StopEvent {
    id: string;
    question: string;
    answer_type: AnswerType;
    required: boolean;
    answered: boolean;
    answer_value: string | null;
    answer_image_url: string | null;
    answered_at: string | null;
}

/*
 * Every text column on shipment_stops is nullable, and the broker leaves many
 * empty (a pickup has no end_* window, a delivery no start_* window). Typing them
 * as plain strings is how "null, null" reached the screen without a compiler
 * warning. Use src/utils/stops.ts to read these rather than formatting by hand.
 */
export interface ShipmentStop {
    id: number;
    shipment_id: number;
    stop_number: number;
    stop_type: "Pickup" | "Delivery" | string;
    stop_name: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    address: string | null;
    address_2: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
    country: string | null;
    start_date: string | null;
    start_time: string | null;
    start_timezone: string | null;
    end_date: string | null;
    end_time: string | null;
    end_timezone: string | null;
    /** Strings from the API; "0","0" stands in for a stop never located. Read with utils/geo stopCoord. */
    latitude: string | null;
    longitude: string | null;
    comment_to_driver: string | null;
    /** Whether the dock must give the driver a code before this stop can be completed. */
    requires_otp?: boolean;
    /**
     * The appointment as an exact instant (ISO 8601 with offset), worked out by the
     * API from the broker's date, time and timezone label. Null when the label is
     * one it cannot map. Read through utils/stops stopAppointment.
     */
    appointment_at?: string | null;
    events: {
        id: string;
        question: string;
        answer_type: AnswerType;
        required: boolean;
    }[] | null;
    created_at: string;
    updated_at: string;
}

export interface Shipment {
    id: number;
    uuid: string;
    company_id: number;
    created_by: number;
    updated_by: number;
    shipment_no: string;
    pro_number: string;
    carrier_name: string;
    carrier_mc: string;
    carrier_dot: string;
    carrier_phone: string;
    carrier_extension: string;
    tracking_method: string;
    country_code: string;
    tracking_number: string;
    truck_number: string;
    trailer_number: string;
    driver_phone_1: string;
    driver_phone_2: string;
    driver_phone_3: string;
    driver_type: string;
    team_load: number;
    tracking_start_at: string;

    /*
    | How often the broker wants this load to report, in seconds. Set per
    | shipment rather than per driver, and changeable while the load runs, so
    | the app treats every value it sees as the current instruction rather than
    | something read once at start. Absent or null on older API builds, in which
    | case the tracker falls back to its 300s default. The server raises "GPS
    | Signal Lost" once a load goes this long plus a few minutes without a ping,
    | so the tracker must report at this rate from the first minute.
    */
    tracking_interval_seconds?: number | null;

    notes: string;
    status: "Active" | "Upcoming" | "Past" | string;

    /** True once this driver has started the load. */
    is_activated: boolean;

    /** True while the Activate button should be offered. */
    can_activate: boolean;

    /**
     * The load the driver has started and not finished, when that is what stops
     * this one being activated (one load at a time). Null otherwise.
     */
    activation_blocked_by?: { uuid: string; shipment_no: string } | null;

    is_equipment_verified: boolean;

    /** Messages the broker sent that the driver has not opened yet. */
    unread_messages: number;

    created_at: string;
    updated_at: string;
    stops: ShipmentStop[];
}

export interface ShipmentsResponse {
    status: boolean;
    message: string;
    data: Shipment[];
}
