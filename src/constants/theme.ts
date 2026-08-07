export const LightTheme = {
    background: "#F7F7F0",
    card: "#FFFFFF",
    cardSecondary: "#F6F6F6",
    text: "#000000ff",
    textInverse: "#FFFFFF",
    secondaryText: "#A1A2A9",
    textCommon: "#ffffff",
    textCommon1: "#000000",
    primaryButton: "#2563EB",
    secondaryButton: "#30B775",
    err:"#ec3131ff"
} as const;

export const DarkTheme = {
    background: "#0D0F14",
    card: "#1A1D24",
    cardSecondary: "#23272F",
    text: "#F5F5F5",
    textInverse: "#000000ff",
    textCommon: "#ffffff",
    textCommon1: "#000000",
    secondaryText: "#9CA3AF",
    primaryButton: "#208AEF",
    secondaryButton: "#1C2A3A",
    err:"#ec3131ff"
} as const;

export type AppTheme = typeof LightTheme | typeof DarkTheme;
