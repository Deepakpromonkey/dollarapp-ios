import * as SecureStore from "expo-secure-store";

export const KEYS = {
    ACCESS_TOKEN: "dt_access_token",
    DRIVER: "dt_driver",
} as const;


/*
 * Every key here has to exist on the API's DriverResource. JSON.stringify drops
 * undefined without a word, so a field this shape asks for and the response does
 * not carry is not a type error — it is a detail that vanishes between signup
 * and the next launch.
 */
export interface StoredDriver {
    id: number;
    uuid: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    contact: string | null;
    profile_pic: string | null;
    carrier_name: string | null;
    phone_verified: boolean;
    liveness_verified: boolean;
    liveness_status: "approved" | "in_review" | "declined" | "pending";
    status: string;
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
