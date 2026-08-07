import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface StepProgressBarProps {
    currentStep: number;
    totalSteps: number;
    onBack?: () => void;
}

export default function StepProgressBar({
    currentStep,
    totalSteps,
    onBack,
}: StepProgressBarProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + 8, backgroundColor: theme.background },
            ]}>
         
            <View style={styles.headerRow}>
                {onBack ? (
                    <Pressable
                        onPress={onBack}
                        hitSlop={12}
                        style={({ pressed }) => [
                            styles.backBtn,
                            { backgroundColor: theme.card },
                            pressed && { opacity: 0.7 },
                        ]}
                        accessibilityLabel="Go back">
                        <AppText
                            style={{
                                fontSize: 18,
                                color: theme.text,
                                lineHeight: 22,
                            }}>
                            ‹
                        </AppText>
                    </Pressable>
                ) : (
                    <View style={styles.backBtn} />
                )}

                <AppText
                    variant="caption"
                    style={{ color: theme.secondaryText }}>
                    Step {currentStep} of {totalSteps}
                </AppText>


                <View style={styles.backBtn} />
            </View>


            <View style={styles.barsRow}>
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const filled = i < currentStep;
                    const active = i === currentStep - 1;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.bar,
                                {
                                    flex: 1,
                                    backgroundColor: filled
                                        ? theme.primaryButton
                                        : theme.cardSecondary,
                                    opacity: active ? 1 : filled ? 1 : 0.45,
                                },
                            ]}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingBottom: 4,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    barsRow: {
        flexDirection: "row",
        gap: 6,
        marginBottom: 8,
    },
    bar: {
        height: 3,
        borderRadius: 2,
    },
});
