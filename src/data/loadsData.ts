export type LoadStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CLEAN";

export interface UpcomingLoad {
    id: string;
    loadNumber: string;
    status: "SCHEDULED" | "IN_PROGRESS";
    pickupCity: string;
    pickupTime: string;
    dropoffCity: string;
    dropoffLabel: string;
    equipment: string;
    distance: string;
    tripStatus: string;
    stages: number;
    totalStages: number;
}

export interface PastLoad {
    id: string;
    loadNumber: string;
    route: string;
    date: string;
    status: "CLEAN";
}

export const upcomingLoads: UpcomingLoad[] = [
    {
        id: "1",
        loadNumber: "DT-48390",
        status: "SCHEDULED",
        pickupCity: "Chicago, IL",
        pickupTime: "June 19 · 07:00 -09:00 AM CT",
        dropoffCity: "Dallas, TX",
        dropoffLabel: "Pickup Ready",
        equipment: "53' Dry Van",
        distance: "355 mi",
        tripStatus: "NOT STARTED",
        stages: 0,
        totalStages: 4,
    },
    {
        id: "2",
        loadNumber: "DT-48391",
        status: "SCHEDULED",
        pickupCity: "Houston, TX",
        pickupTime: "June 20 · 08:00 - 10:00 AM CT",
        dropoffCity: "Memphis, TN",
        dropoffLabel: "Pickup Ready",
        equipment: "48' Flatbed",
        distance: "492 mi",
        tripStatus: "NOT STARTED",
        stages: 0,
        totalStages: 4,
    },
    {
        id: "3",
        loadNumber: "DT-48392",
        status: "SCHEDULED",
        pickupCity: "Atlanta, GA",
        pickupTime: "June 21 · 06:00 - 08:00 AM ET",
        dropoffCity: "Nashville, TN",
        dropoffLabel: "Pickup Ready",
        equipment: "53' Reefer",
        distance: "248 mi",
        tripStatus: "NOT STARTED",
        stages: 0,
        totalStages: 4,
    },
    {
        id: "4",
        loadNumber: "DT-48393",
        status: "SCHEDULED",
        pickupCity: "Phoenix, AZ",
        pickupTime: "June 22 · 09:00 - 11:00 AM MT",
        dropoffCity: "Los Angeles, CA",
        dropoffLabel: "Pickup Ready",
        equipment: "53' Dry Van",
        distance: "371 mi",
        tripStatus: "NOT STARTED",
        stages: 0,
        totalStages: 4,
    },
    {
        id: "5",
        loadNumber: "DT-48394",
        status: "SCHEDULED",
        pickupCity: "Denver, CO",
        pickupTime: "June 23 · 07:30 - 09:30 AM MT",
        dropoffCity: "Kansas City, MO",
        dropoffLabel: "Pickup Ready",
        equipment: "48' Flatbed",
        distance: "600 mi",
        tripStatus: "NOT STARTED",
        stages: 0,
        totalStages: 4,
    },
];

export const pastLoads: PastLoad[] = [
    {
        id: "1",
        loadNumber: "DT-48213",
        route: "Dallas, TX → Chicago, IL",
        date: "June 18, 2026",
        status: "CLEAN",
    },
    {
        id: "2",
        loadNumber: "DT-48214",
        route: "Dallas, TX → Chicago, IL",
        date: "June 18, 2026",
        status: "CLEAN",
    },
    {
        id: "3",
        loadNumber: "DT-48100",
        route: "Houston, TX → Memphis, TN",
        date: "June 15, 2026",
        status: "CLEAN",
    },
    {
        id: "4",
        loadNumber: "DT-48050",
        route: "Atlanta, GA → Nashville, TN",
        date: "June 12, 2026",
        status: "CLEAN",
    },
    {
        id: "5",
        loadNumber: "DT-47990",
        route: "Phoenix, AZ → Los Angeles, CA",
        date: "June 10, 2026",
        status: "CLEAN",
    },
];
