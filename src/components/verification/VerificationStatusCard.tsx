import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import AppText from "../AppText";

interface Props {
    current: number;
    total: number;
}

const SIZE = 60;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function VerificationStatusCard({
    current,
    total,
}: Props) {
    const progress = current / total;
    const offset = CIRCUMFERENCE * (1 - progress);

    return (
        <View style={styles.container}>
            <View style={styles.circle}>
                <Svg
                    width={SIZE}
                    height={SIZE}
                    style={{ transform: [{ rotate: "-90deg" }] }}
                >
                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="#E5E7EB"
                        strokeWidth={STROKE}
                        fill="none"
                    />

                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke="#0A4ABF"
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        fill="none"
                    />
                </Svg>

                <View style={styles.center}>
                    <AppText variant="caption">
                        {current}/{total}
                    </AppText>
                </View>
            </View>

            <View style={styles.badge}>
                <Text style={styles.badgeText}>
                    {Math.round(progress * 100)}% DONE
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
    },

    circle: {
        width: SIZE,
        height: SIZE,
        justifyContent: "center",
        alignItems: "center",
    },

    center: {
        position: "absolute",
    },

    count: {
        fontSize: 15,
        fontWeight: "400",
        color: "#111827",
    },

    badge: {
        marginTop: 10,
        backgroundColor: "#0A4ABF",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },

    badgeText: {
        color: "#fff",
        // fontWeight: "600",
        fontSize: 10,
    },
});