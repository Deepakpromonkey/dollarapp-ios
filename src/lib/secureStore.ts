import * as SecureStore from "expo-secure-store";

export const KEYS = {
    ACCESS_TOKEN: "dt_access_token",
    DRIVER: "dt_driver",
} as const;


export interface StoredDriver {
    id: number;
    row_id: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    contact: string;
    profile_pic: string;
    roles: string;
    carrier_name: string;
    active_plan: string;
    phone_verified: boolean;
    liveness_verified: boolean;
    status: number;
}


async function setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
}

export async function getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
}


export async function saveSession(
    accessToken: string,
    driver: StoredDriver,
): Promise<void> {
    await Promise.all([
        setItem(KEYS.ACCESS_TOKEN, accessToken),
        setItem(KEYS.DRIVER, JSON.stringify(driver)),
    ]);
}

export async function getAccessToken(): Promise<string | null> {
    return getItem(KEYS.ACCESS_TOKEN);
}

export async function getStoredDriver(): Promise<StoredDriver | null> {
    const raw = await getItem(KEYS.DRIVER);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredDriver;
    } catch {
        return null;
    }
}

export async function clearSession(): Promise<void> {
    await Promise.all([
        removeItem(KEYS.ACCESS_TOKEN),
        removeItem(KEYS.DRIVER),
    ]);
}
