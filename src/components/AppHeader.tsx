import LoadDrawer from "@/components/LoadDrawer";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface AppHeaderProps {
    appName?: string;
    onNotificationPress?: () => void;
    notificationCount?: number;
    right?: ReactNode;
}

export default function AppHeader({
    appName = "Dollar Traq",
    onNotificationPress,
    notificationCount = 0,
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

                    <Pressable
                        onPress={onNotificationPress}
                        hitSlop={10}
                        style={[styles.iconBtn, { backgroundColor: iconBg }]}>
                        <MaterialCommunityIcons
                            name="bell-outline"
                            size={22}
                            color={iconColor}
                        />
                        {notificationCount > 0 && (
                            <View style={styles.badge} />
                        )}
                    </Pressable>
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
    badge: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#EF4444",
    },
});
