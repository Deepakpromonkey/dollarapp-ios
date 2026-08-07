import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const DRAWER_WIDTH = Dimensions.get("window").width * 0.78;

interface DrawerItem {
    id: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    route?: string;
    onPress: () => void;
    destructive?: boolean;
}

interface LoadDrawerProps {
    visible: boolean;
    onClose: () => void;
}

export default function LoadDrawer({ visible, onClose }: LoadDrawerProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const { logout } = useAuth();

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -DRAWER_WIDTH,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const navItems: DrawerItem[] = [
        {
            id: "loads",
            icon: "layers-outline",
            label: "Loads",
            route: "/loads",
            onPress: () => {
                router.push("/(tabs)/loads");
                onClose();
            },
        },
        {
            id: "trip",
            icon: "map-outline",
            label: "My Trip",
            route: "/trip",
            onPress: () => {
                router.push("/(tabs)/trip");
                onClose();
            },
        },
        {
            id: "profile",
            icon: "account-outline",
            label: "Profile",
            route: "/profile",
            onPress: () => {
                router.push("/(tabs)/profile");
                onClose();
            },
        },
    ];

    const bottomItems: DrawerItem[] = [
        {
            id: "logout",
            icon: "logout",
            label: "Log Out",
            onPress: async () => {
                await logout();
                onClose();
            },
            destructive: true,
        },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent>
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        styles.backdrop,
                        { opacity: backdropAnim },
                    ]}
                />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.drawer,
                    {
                        width: DRAWER_WIDTH,
                        backgroundColor: theme.card,
                        paddingTop: insets.top + 16,
                        paddingBottom: insets.bottom + 16,
                        transform: [{ translateX: slideAnim }],
                    },
                ]}>
                <View style={styles.drawerHeader}>
                    <View
                        style={[
                            styles.logoMark,
                            { backgroundColor: theme.primaryButton + "20" },
                        ]}>
                        <MaterialCommunityIcons
                            name="truck-fast-outline"
                            size={22}
                            color={theme.primaryButton}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <AppText
                            variant="label1"
                            style={{ color: theme.text, fontWeight: "700" }}>
                            DollarTraq
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            Driver App
                        </AppText>
                    </View>
                    <Pressable onPress={onClose} hitSlop={10}>
                        <MaterialCommunityIcons
                            name="close"
                            size={20}
                            color={theme.secondaryText}
                        />
                    </Pressable>
                </View>

                <View
                    style={[
                        styles.divider,
                        { backgroundColor: theme.cardSecondary },
                    ]}
                />

                <View style={styles.navSection}>
                    {navItems.map((item) => (
                        <DrawerNavItem
                            key={item.id}
                            item={item}
                            theme={theme}
                            pathname={pathname}
                        />
                    ))}
                </View>

                <View style={{ flex: 1 }} />

                <View
                    style={[
                        styles.divider,
                        { backgroundColor: theme.cardSecondary },
                    ]}
                />

                <View style={[styles.navSection, { marginTop: 8 }]}>
                    {bottomItems.map((item) => (
                        <DrawerNavItem
                            key={item.id}
                            item={item}
                            theme={theme}
                            pathname={pathname}
                        />
                    ))}
                </View>
            </Animated.View>
        </Modal>
    );
}

function DrawerNavItem({
    item,
    theme,
    pathname,
}: {
    item: DrawerItem;
    theme: any;
    pathname: string;
}) {
    const isActive = !!item.route && pathname === item.route;
    const color = item.destructive
        ? theme.err
        : isActive
        ? theme.primaryButton
        : theme.text;
    const iconColor = item.destructive ? theme.err : theme.primaryButton;

    return (
        <Pressable
            onPress={item.onPress}
            style={({ pressed }) => [
                styles.navItem,
                isActive && { backgroundColor: theme.primaryButton + "18" },
                !isActive && pressed && { backgroundColor: theme.cardSecondary },
            ]}>
            <View
                style={[
                    styles.navIconWrap,
                    { backgroundColor: iconColor + (isActive ? "30" : "18") },
                ]}>
                <MaterialCommunityIcons
                    name={item.icon}
                    size={19}
                    color={iconColor}
                />
            </View>
            <AppText
                variant="body"
                style={{ color, fontWeight: isActive ? "700" : "500" }}>
                {item.label}
            </AppText>
            {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: theme.primaryButton }]} />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: "rgba(0,0,0,0)",
    },
    drawer: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
    },
    drawerHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    logoMark: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    divider: {
        height: 1,
        marginHorizontal: 20,
        marginBottom: 8,
    },
    navSection: {
        paddingHorizontal: 12,
        gap: 2,
    },
    navItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 12,
        paddingVertical: 13,
        borderRadius: 12,
    },
    navIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    activeIndicator: {
        marginLeft: "auto",
        width: 4,
        height: 20,
        borderRadius: 2,
    },
});