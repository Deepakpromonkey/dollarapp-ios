import AppText from "@/components/AppText";
import { PastLoad } from "@/data/loadsData";
import { useAppTheme } from "@/hooks/useAppTheme";
import { StyleSheet, View } from "react-native";

interface Props {
    load: PastLoad;
}

export default function PastLoadCard({ load }: Props) {
    const theme = useAppTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.info}>
                <AppText variant="caption" style={{ color: theme.text }}>
                    {load.route}
                </AppText>
                <AppText
                    variant="tiny"
                    style={{ color: theme.secondaryText, marginTop: 2 }}>
                    {load.loadNumber} · {load.date}
                </AppText>
            </View>

            <View
                style={[
                    styles.statusBadge,
                    { backgroundColor: theme.cardSecondary },
                ]}>
                <AppText
                    variant="tiny"
                    style={{
                        color: theme.secondaryText,
                        fontWeight: "700",
                        letterSpacing: 0.5,
                    }}>
                    {load.status}
                </AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    info: {
        flex: 1,
    },
    statusBadge: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
});
