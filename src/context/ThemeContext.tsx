import { DarkTheme, LightTheme, type AppTheme } from "@/constants/theme";
import * as SecureStore from "expo-secure-store";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { useColorScheme } from "react-native";

type ColorMode = "light" | "dark" | "system";

const STORE_KEY = "dollar_traq_color_mode";

interface ThemeContextValue {
    theme: AppTheme;
    colorMode: ColorMode;
    isDark: boolean;
    setColorMode: (mode: ColorMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [colorMode, setColorModeState] = useState<ColorMode>("system");

    // Load persisted preference on mount
    useEffect(() => {
        SecureStore.getItemAsync(STORE_KEY).then((saved) => {
            if (saved === "light" || saved === "dark" || saved === "system") {
                setColorModeState(saved);
            }
        });
    }, []);

    const setColorMode = useCallback((mode: ColorMode) => {
        setColorModeState(mode);
        SecureStore.setItemAsync(STORE_KEY, mode);
    }, []);

    const toggleTheme = useCallback(() => {
        setColorModeState((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            SecureStore.setItemAsync(STORE_KEY, next);
            return next;
        });
    }, []);

    const isDark =
        colorMode === "system" ? systemScheme === "dark" : colorMode === "dark";

    const theme = isDark ? DarkTheme : LightTheme;

    return (
        <ThemeContext.Provider
            value={{ theme, colorMode, isDark, setColorMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useThemeContext must be used within ThemeProvider");
    }
    return ctx;
}
