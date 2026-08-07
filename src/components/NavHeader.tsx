import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface NavHeaderProps {
    title: string;
    hideBack?: boolean;
    onBack?: () => void;
    right?: ReactNode;
    border?: boolean;
}

export default function NavHeader({
    title,
    hideBack = false,
    onBack,
    right,
    border = true,
}: NavHeaderProps) {
    const theme = useAppTheme();

    return (
        <View
            style={[
                styles.container,
                border && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.cardSecondary,
                },
            ]}>
            <View style={styles.side}>
                {!hideBack && (
                    <Pressable
                        onPress={onBack ?? (() => router.back())}
                        hitSlop={12}
                        style={styles.backBtn}>
                       <MaterialCommunityIcons name="arrow-left" color={theme.text} size={20} />
                    </Pressable>
                )}
            </View>

            <AppText
                variant="title"
                style={{ color: theme.text, textAlign: "center" }}>
                {title}
            </AppText>

            <View style={[styles.side, styles.rightSide]}>
                {right ?? null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    side: {
        width: 40,
    },
    rightSide: {
        alignItems: "flex-end",
    },
    backBtn: {
        width: 32,
    },
});
