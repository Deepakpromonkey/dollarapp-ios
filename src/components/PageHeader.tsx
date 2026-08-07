import { useAppTheme } from "@/hooks/useAppTheme";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "./AppText";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    right?: ReactNode;
}


export default function PageHeader({ title, subtitle, right }: PageHeaderProps) {
    const theme = useAppTheme();

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <View style={styles.textBlock}>
                    <AppText variant="label1" style={{ color: theme.text }}>
                        {title}
                    </AppText>
                    {subtitle ? (
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText, marginTop: 2 }}>
                            {subtitle}
                        </AppText>
                    ) : null}
                </View>
                {right ? <View style={styles.rightSlot}>{right}</View> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical:20,
        // paddingHorizontal: 20,
        paddingBottom: 16,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    textBlock: {
        flex: 1,
    },
    rightSlot: {
        paddingTop: 4,
    },
});
