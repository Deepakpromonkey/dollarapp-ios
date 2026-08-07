import { useAppTheme } from "@/hooks/useAppTheme";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface SectionHeaderProps {
    label: string;
    right?: ReactNode;
    dot?: "accent" | "default";
}

export default function SectionHeader({ label, right, dot }: SectionHeaderProps) {
    const theme = useAppTheme();

    const dotColor =
        dot === "accent" ? theme.primaryButton : theme.secondaryText;

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                {dot && (
                    <View
                        style={[styles.dot, { backgroundColor: dotColor }]}
                    />
                )}
                <AppText
                    variant="caption"
                    style={{
                        color: dot === "accent"
                            ? theme.primaryButton
                            : theme.secondaryText,
                        
                       
                        textTransform: "uppercase",
                    }}>
                    {label}
                </AppText>
            </View>
            {right ? <View>{right}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        // paddingHorizontal: 20,
        marginBottom: 12,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
});
