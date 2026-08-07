import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface ProfileUser {
    name: string;
    role: string;
    company: string;
    avatarUri?: string;
    didVerified: boolean;
}

export interface BadgeConfig {
    label: string;
    color: string;
    bg: string;
}

export interface ProfileTileData {
    id: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    badge?: BadgeConfig;
}

export interface ProfileRowData {
    id: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle?: string;
    badge?: BadgeConfig;
    variant?: "normal" | "destructive";
}

export type TripStatus = "clean" | "issue" | "pending";

export interface ProfileActivityData {
    id: string;
    date: string;
    tripId: string;
    status: TripStatus;
    origin: string;
    originTime: string;
    destination: string;
    destinationTime: string;
}

export const profileUser: ProfileUser = {
    name: "Anshul Gupta",
    role: "Driver",
    company: "Yo Yo",
    didVerified: true,
};

export const accountTiles: ProfileTileData[] = [
    {
        id: "personal",
        icon: "account-outline",
        title: "Personal Info",
         badge: {
             label: "Manage Identity",
            color: "#2563EB",
            bg: "#2563EB18",
        },
    },
    {
        id: "license",
        icon: "card-account-details-outline",
        title: "License (CDL)",
        badge: {
            label: "VERIFIED",
            color: "#22C55E",
            bg: "#22C55E18",
        },
    },
    {
        id: "equipment",
        icon: "truck-outline",
        title: "My Equipment", 
        badge: {
            label: "VERIFIED",
            color: "#22C55E",
            bg: "#22C55E18",
        },
    },
    {
        id: "verification",
        icon: "shield-check-outline",
        title: "Verification",
        badge: {
            label: "VERIFIED",
             color: "#22C55E",
            bg: "#22C55E18",
        },
    },
];

export const accountRows: ProfileRowData[] = [
    {
        id: "settings",
        icon: "cog-outline",
        title: "Settings",
        subtitle: "",
    },
];

export const supportRows: ProfileRowData[] = [
    {
        id: "help",
        icon: "help-circle-outline",
        title: "Help & Support",
        subtitle: "",
    },
    {
        id: "teams",
        icon: "account-group-outline",
        title: "Teams & Privacy",
        subtitle: "",
    },
    {
        id: "logout",
        icon: "logout",
        title: "Log Out",
        subtitle: "",
    },
];

export const dangerRows: ProfileRowData[] = [
    {
        id: "delete",
        icon: "delete-outline",
        title: "Delete Account",
        subtitle: "",
        variant: "destructive",
    },
];

export const recentActivity: ProfileActivityData[] = [
    {
        id: "trip-1",
        date: "Jun 18, 2026",
        tripId: "DT-48213",
        status: "clean",
        origin: "Dallas, TX",
        originTime: "08:30 AM",
        destination: "Chicago, IL",
        destinationTime: "04:45 PM",
    },
];
