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

export interface ShipmentStop {
    id: number;
    shipment_id: number;
    stop_number: number;
    stop_type: "Pickup" | "Delivery" | string;
    stop_name: string;
    contact_name: string | null;
    contact_phone: string | null;
    address: string;
    address_2: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    start_date: string;
    start_time: string;
    start_timezone: string;
    end_date: string;
    end_time: string;
    end_timezone: string;
    latitude: string;
    longitude: string;
    comment_to_driver: string;
    alert_emails: string;
    events: Array<{
        id: string;
        question: string;
        answer_type: AnswerType;
        required: boolean;
    }> | null;
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
    notes: string;
    status: "Active" | "Upcoming" | "Past" | string;

    /** True once this driver has started the load. */
    is_activated: boolean;

    /** True while the Activate button should be offered. */
    can_activate: boolean;

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
