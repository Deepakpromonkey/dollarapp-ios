import AppText from "@/components/AppText";
import { UpcomingLoad } from "@/data/loadsData";
import { useAppTheme } from "@/hooks/useAppTheme";
import { StyleSheet, View } from "react-native";

interface Props {
    load: UpcomingLoad;
    isActive?: boolean;
}

export default function UpcomingLoadCard({ load, isActive = false }: Props) {
    const theme = useAppTheme();

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: theme.card },
                isActive && styles.activeCard,
            ]}>
            <View style={styles.header}>
                <AppText variant="body" style={{ color: theme.text }}>
                    {load.loadNumber}
                </AppText>
                <View
                    style={[
                        styles.statusBadge,
                        { borderColor: theme.primaryButton },
                    ]}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: theme.primaryButton },
                        ]}
                    />
                    <AppText
                        variant="tiny"
                        style={{
                            color: theme.primaryButton,
                        }}>
                        {load.status}
                    </AppText>
                </View>
            </View>

            <View style={styles.routeRow}>
                <View style={styles.timelineCol}>
                    <View
                        style={[
                            styles.dotEmpty,
                            { borderColor: theme.secondaryText },
                        ]}
                    />
                    <View
                        style={[
                            styles.line,
                            { backgroundColor: theme.primaryButton },
                        ]}
                    />
                    <View
                        style={[
                            styles.dotFilled,
                            { backgroundColor: theme.primaryButton },
                        ]}
                    />
                </View>

                <View style={styles.routeTextCol}>
                    <View style={styles.routeStop}>
                        <AppText variant="label1" style={{ color: theme.text }}>
                            {load.pickupCity}
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            {load.pickupTime}
                        </AppText>
                    </View>

                    <View style={styles.routeStop}>
                        <AppText variant="label1" style={{ color: theme.text }}>
                            {load.dropoffCity}
                        </AppText>
                        <AppText
                            variant="caption"
                            style={{ color: theme.primaryButton }}>
                            {load.dropoffLabel}
                        </AppText>
                    </View>
                </View>
            </View>

            <View
                style={[
                    styles.divider,
                    { backgroundColor: theme.cardSecondary },
                ]}
            />

            <View style={styles.infoRow}>
                <View
                    style={[
                        styles.infoBox,
                        { backgroundColor: theme.cardSecondary },
                    ]}>
                    <AppText
                        variant="tiny"
                        style={{
                            color: theme.secondaryText,
                            letterSpacing: 0.8,
                            textTransform: "uppercase",
                        }}>
                        Equipment
                    </AppText>
                    <AppText
                        variant="label1"
                        style={{ color: theme.text, marginTop: 4 }}>
                        {load.equipment}
                    </AppText>
                </View>
                <View
                    style={[
                        styles.infoBox,
                        { backgroundColor: theme.cardSecondary },
                    ]}>
                    <AppText
                        variant="tiny"
                        style={{
                            color: theme.secondaryText,
                            letterSpacing: 0.8,
                            textTransform: "uppercase",
                        }}>
                        Distance
                    </AppText>
                    <AppText
                        variant="label1"
                        style={{ color: theme.text, marginTop: 4 }}>
                        {load.distance}
                    </AppText>
                </View>
            </View>

            <View style={styles.footer}>
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}>
                    STATUS:{" "}
                    <AppText variant="caption" style={{ color: theme.err }}>
                        {load.tripStatus}
                    </AppText>
                </AppText>
                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}>
                    {load.stages}/{load.totalStages} STAGES
                </AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    activeCard: {
        borderWidth: 1.5,
        borderColor: "#2563EB22",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    routeRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    timelineCol: {
        alignItems: "center",
        paddingTop: 4,
        width: 14,
    },
    dotEmpty: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    line: {
        width: 2,
        flex: 1,
        marginVertical: 4,
        minHeight: 28,
    },
    dotFilled: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    routeTextCol: {
        flex: 1,
        gap: 20,
    },
    routeStop: {
        gap: 2,
    },
    divider: {
        height: 1,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
    },
    infoBox: {
        flex: 1,
        borderRadius: 10,
        padding: 10,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
});
