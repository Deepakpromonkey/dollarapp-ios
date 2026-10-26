import LoadDrawer from "@/components/LoadDrawer";
import { NotificationBell } from "@/components/LoadHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface AppHeaderProps {
    appName?: string;
    /** Defaults to opening the notification inbox. */
    onNotificationPress?: () => void;
    /** Defaults to the driver's unread count. */
    notificationCount?: number;
    right?: ReactNode;
}

export default function AppHeader({
    appName = "Dollar Traq",
    onNotificationPress,
    notificationCount,
    right,
}: AppHeaderProps) {
    const theme = useAppTheme();
    const isDark = theme.background === "#0D0F14";
    const [drawerOpen, setDrawerOpen] = useState(false);

    const iconBg = isDark ? "#1E2128" : "#ECF0EE";
    const iconColor = isDark ? "#9CA3AF" : "#4B5563";

    return (
        <>
            <View style={[styles.container, { backgroundColor: theme.card }]}>
                {/* Hamburger menu */}
                <Pressable
                    onPress={() => setDrawerOpen(true)}
                    hitSlop={10}
                    style={[styles.iconBtn, { backgroundColor: iconBg }]}>
                    <MaterialCommunityIcons
                        name="menu"
                        size={22}
                        color={iconColor}
                    />
                </Pressable>

                {/* Brand center */}
                <View style={styles.brand}>
                    
                        
                
                    <AppText variant="title" style={{ color: theme.text }}>
                        {appName}
                    </AppText>
                </View>

                {/* Right slot */}
                <View style={styles.rightSlot}>
                    {right}

                    <NotificationBell
                        onPress={onNotificationPress}
                        count={notificationCount}
                        iconSize={22}
                        iconColor={iconColor}
                        backgroundColor={iconBg}
                    />
                </View>
            </View>

            <LoadDrawer
                visible={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    brand: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    logoBox: {
        width: 32,
        height: 32,
        borderRadius: 9,
        justifyContent: "center",
        alignItems: "center",
    },
    rightSlot: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    iconBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
});
