import AppText from "@/components/AppText";
import { useThemeContext } from "@/context/ThemeContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import {
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const { width } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 60;
const TAB_BAR_WIDTH = width * 0.22;

export default function TabLayout() {
    const { isDark } = useThemeContext();
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarActiveTintColor: theme.primaryButton,
                tabBarInactiveTintColor: theme.secondaryText,

                tabBarItemStyle: {
                    height: TAB_BAR_HEIGHT,
                    justifyContent: "center",
                    alignItems: "center",
                },

                tabBarStyle: {
                    position: "absolute",
                    bottom: insets.bottom > 0 ? insets.bottom : 12,
                    left: 16,
                    right: 16,
                    height: TAB_BAR_HEIGHT,
                    backgroundColor: "transparent",
                    borderTopWidth: 0,
                    borderWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                },

                tabBarBackground: () => <GlassBackground isDark={isDark} />,

                tabBarButton: ({
                    children,
                    onPress,
                    onLongPress,
                    style,
                    accessibilityState,
                }) => (
                    <Pressable
                        onPress={onPress}
                        onLongPress={onLongPress}
                        accessibilityState={accessibilityState}
                        android_ripple={null}
                        style={[
                            style as any,
                            {
                                flex: 1,
                                justifyContent: "center",
                                alignItems: "center",
                            },
                        ]}>
                        {children}
                    </Pressable>
                ),
            }}>
            <Tabs.Screen
                name="trip"
                options={{
                    title: "My Trip",
                    tabBarIcon: ({ color, focused }) => (
                        <GlassTabItem
                            focused={focused}
                            isDark={isDark}
                            icon={
                                <Ionicons
                                    name={focused ? "map" : "map-outline"}
                                    size={20}
                                    color={color}
                                />
                            }
                            label="My Trip"
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="loads"
                options={{
                    title: "Loads",
                    tabBarIcon: ({ color, focused }) => (
                        <GlassTabItem
                            focused={focused}
                            isDark={isDark}
                            icon={
                                <Ionicons
                                    name={focused ? "layers" : "layers-outline"}
                                    size={20}
                                    color={color}
                                />
                            }
                            label="Loads"
                            color={color}
                        />
                    ),
                }}
            />


            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, focused }) => (
                        <GlassTabItem
                            focused={focused}
                            isDark={isDark}
                            icon={
                                <Ionicons
                                    name={focused ? "person" : "person-outline"}
                                    size={20}
                                    color={color}
                                />
                            }
                            label="Profile"
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}

function GlassBackground({ isDark }: { isDark: boolean }) {
    const theme = useAppTheme();
    return (
        <View style={styles.glassWrapper}>
            <BlurView
                intensity={Platform.OS === "ios" ? 80 : 100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
            />
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: theme.card,
                        borderRadius: 30,
                        borderWidth: 1,
                        borderColor: theme.cardSecondary,
                    },
                ]}
            />
        </View>
    );
}

function GlassTabItem({
    focused,
    isDark,
    icon,
    label,
    color,
}: {
    focused: boolean;
    isDark: boolean;
    icon: React.ReactNode;
    label: string;
    color: string | import("react-native").ColorValue;
}) {
    const theme = useAppTheme();
    const content = (
        <>
            {icon}
            <AppText
                variant={focused ? "tiny" : "tiny"}
                style={{ color: color as string, marginTop: 2 }}>
                {label}
            </AppText>
        </>
    );

    if (!focused) {
        return <View style={styles.inactiveTab}>{content}</View>;
    }

    return (
        <BlurView
            intensity={40}
            tint={isDark ? "dark" : "light"}
            style={[
                styles.activeTab,
                {
                    backgroundColor: theme.background,
                    borderColor: theme.background,
                },
            ]}>
            {content}
        </BlurView>
    );
}

const styles = StyleSheet.create({
    glassWrapper: {
        flex: 1,
        borderRadius: 30,
        overflow: "hidden",
    },

    inactiveTab: {
        width: TAB_BAR_WIDTH,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
    },

    activeTab: {
        width: TAB_BAR_WIDTH,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",

        shadowColor: "#acd1f4ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
});
