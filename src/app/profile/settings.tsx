import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import { useThemeContext } from "@/context/ThemeContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
    const theme = useAppTheme();
    const { colorMode, setColorMode, isDark } = useThemeContext();

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <View style={[styles.inner, { backgroundColor: theme.background }]}>
                <NavHeader title="Settings" />

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}>

                    {/* Appearance */}
                    <AppText
                        variant="caption"
                        style={{
                            color: theme.secondaryText,
                            marginLeft: 4,
                            marginBottom: 4,
                        }}>
                        APPEARANCE
                    </AppText>

                    <View
                        style={[
                            styles.card,
                            { backgroundColor: theme.card },
                        ]}>
                        <View style={styles.cardHeader}>
                            <View
                                style={[
                                    styles.iconCircle,
                                    { backgroundColor: theme.cardSecondary },
                                ]}>
                                <MaterialCommunityIcons
                                    name={
                                        colorMode === "system"
                                            ? "theme-light-dark"
                                            : isDark
                                            ? "weather-night"
                                            : "white-balance-sunny"
                                    }
                                    size={20}
                                    color={theme.primaryButton}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <AppText
                                    variant="label1"
                                    style={{
                                        color: theme.text,
                                        fontWeight: "600",
                                    }}>
                                    Theme
                                </AppText>
                                <AppText
                                    variant="tiny"
                                    style={{
                                        color: theme.secondaryText,
                                        marginTop: 1,
                                    }}>
                                    {colorMode === "system"
                                        ? "Following system"
                                        : colorMode === "dark"
                                        ? "Dark theme"
                                        : "Light theme"}
                                </AppText>
                            </View>
                        </View>

                        {/* 3-way segment */}
                        <View
                            style={[
                                styles.segmentContainer,
                                { backgroundColor: theme.cardSecondary },
                            ]}>
                            {(
                                [
                                    {
                                        key: "light",
                                        icon: "white-balance-sunny",
                                        label: "Light",
                                    },
                                    {
                                        key: "system",
                                        icon: "theme-light-dark",
                                        label: "System",
                                    },
                                    {
                                        key: "dark",
                                        icon: "weather-night",
                                        label: "Dark",
                                    },
                                ] as const
                            ).map((option) => {
                                const isActive = colorMode === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        onPress={() =>
                                            setColorMode(option.key)
                                        }
                                        style={[
                                            styles.segmentOption,
                                            isActive && {
                                                backgroundColor: theme.card,
                                                shadowColor: "#000",
                                                shadowOffset: {
                                                    width: 0,
                                                    height: 1,
                                                },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 3,
                                                elevation: 2,
                                            },
                                        ]}>
                                        <MaterialCommunityIcons
                                            name={option.icon}
                                            size={16}
                                            color={
                                                isActive
                                                    ? theme.primaryButton
                                                    : theme.secondaryText
                                            }
                                        />
                                        <AppText
                                            variant="tiny"
                                            style={{
                                                color: isActive
                                                    ? theme.primaryButton
                                                    : theme.secondaryText,
                                                fontWeight: isActive
                                                    ? "700"
                                                    : "400",
                                                marginTop: 2,
                                            }}>
                                            {option.label}
                                        </AppText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    inner: { flex: 1 },
    content: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 40,
        gap: 8,
    },
    card: {
        borderRadius: 14,
        padding: 14,
        gap: 12,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    segmentContainer: {
        flexDirection: "row",
        borderRadius: 10,
        padding: 4,
        gap: 4,
    },
    segmentOption: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        borderRadius: 8,
        gap: 2,
    },
});
