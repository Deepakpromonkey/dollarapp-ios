export type ItemStatus = "verified" | "pending" | "required";

export interface VerifyStatusData {
    completed: number;
    total: number;
}

export interface VerifyRowData {
    id: string;
    title: string;
    subtitle?: string;
    status: ItemStatus;
    matchScore?: string;
}

export interface VerifyTileData {
    id: string;
    title: string;
    status: ItemStatus;
    badge: {
        label: string;
        color: string;
        bg: string;
    };
}

export const verifyStatus: VerifyStatusData = {
    completed: 4,
    total: 6,
};

export const identityRows: VerifyRowData[] = [
    {
        id: "liveness",
        title: "Liveness Check",
        subtitle: "Didit facial liveness · anti-spoofing",
        status: "verified",
        matchScore: "MATCH 95%",
    },
];

export const identityTiles: VerifyTileData[] = [
    {
        id: "cdl",
        title: "Driver License (CDL)",
        status: "pending",
        badge: { label: "VERIFY", color: "#2563EB", bg: "#2563EB18" },
    },
    {
        id: "photo",
        title: "Profile Photo",
        status: "required",
        badge: { label: "REQUIRED", color: "#9CA3AF", bg: "#9CA3AF22" },
    },
];

export const equipmentRows: VerifyRowData[] = [
    {
        id: "vin",
        title: "VIN Verification",
        subtitle: "LIVE CAPTURE · OCR · MATCHED",
        status: "verified",
    },
    {
        id: "tractor",
        title: "Tractor & Trailer",
        subtitle: "LIVE CAPTURE · OCR · MATCHED",
        status: "verified",
    },
    {
        id: "plate",
        title: "License Plate",
        subtitle: "LIVE CAPTURE · OCR · MATCHED",
        status: "verified",
    },
];
