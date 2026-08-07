import type { AppTheme } from "@/constants/theme";
import { useThemeContext } from "@/context/ThemeContext";

export function useAppTheme(): AppTheme {
    return useThemeContext().theme;
}
