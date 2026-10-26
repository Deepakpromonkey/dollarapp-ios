import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import MaterialIcons from "@expo/vector-icons/build/MaterialIcons";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";

interface Props {
    /** Short headline, e.g. "Couldn't update your loads". */
    title: string;
    /** The reason, as plain as the API or friendlyError gave it. */
    message?: string | null;
    onRetry: () => void;
    /** A retry is in flight: shows a spinner in place of the button. */
    busy?: boolean;
    style?: ViewStyle;
}

/**
 * A failed fetch, said inline with a way to try again.
 *
 * Shown in place of (or above) the content rather than instead of the whole
 * screen, so pull to refresh and anything already loaded stay usable.
 */
export default function RetryNotice({ title, message, onRetry, busy = false, style }: Props) {
    const theme = useAppTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.card }, style]}>
            <MaterialIcons name="error-outline" size={22} color={theme.err} />
            <View style={styles.text}>
                <AppText variant="label" style={{ color: theme.text }}>
                    {title}
                </AppText>
                {message ? (
                    <AppText
                        variant="caption"
                        style={{ color: theme.secondaryText, lineHeight: 19, marginTop: 2 }}>
                        {message}
                    </AppText>
                ) : null}
            </View>
            {busy ? (
                <ActivityIndicator color={theme.primaryButton} style={styles.action} />
            ) : (
                <Pressable
                    onPress={onRetry}
                    hitSlop={10}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                        styles.action,
                        styles.retry,
                        { borderColor: theme.primaryButton, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <AppText
                        variant="caption"
                        style={{ color: theme.primaryButton, fontWeight: "600" }}>
                        Try again
                    </AppText>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    text: {
        flex: 1,
        minWidth: 0,
    },
    action: {
        flexShrink: 0,
    },
    retry: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
});
