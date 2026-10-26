import { LINKS } from "@/constants/links";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface BadgeConfig {
    label: string;
    color: string;
    bg: string;
}

/*
| Tiles carry a badge here only when it never changes. The License, My
| Equipment and Verification badges used to be hardcoded "VERIFIED" for every
| driver; the profile screen now works them out from the driver's own data.
*/
export interface ProfileTileData {
    id: "personal" | "license" | "equipment" | "verification";
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
    /** A web page the row opens in the in-app browser. */
    url?: string;
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
    },
    {
        id: "equipment",
        icon: "truck-outline",
        title: "My Equipment",
    },
    {
        id: "verification",
        icon: "shield-check-outline",
        title: "Verification",
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
        url: LINKS.support,
    },
    {
        id: "terms",
        icon: "shield-lock-outline",
        title: "Terms & Privacy",
        subtitle: "",
        url: LINKS.privacy,
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
        subtitle: "Deleted 15 days after you confirm",
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
