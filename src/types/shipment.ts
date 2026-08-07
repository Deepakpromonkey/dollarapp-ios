export interface ShipmentStop {
    id: number;
    shipment_id: number;
    stop_number: number;
    stop_type: "Pickup" | "Delivery" | string;
    stop_name: string;
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
    events: Array<{ customEventName: string; type: string; value: string }>;
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
    created_at: string;
    updated_at: string;
    stops: ShipmentStop[];
}

export interface ShipmentsResponse {
    status: boolean;
    message: string;
    data: Shipment[];
}
