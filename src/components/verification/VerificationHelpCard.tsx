import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

export default function VerificationHelpCard() {
    const theme = useAppTheme();

    return (
        <View style={[styles.card, { backgroundColor: "#EEF2FF" }]}>
            <View style={[styles.iconBox, { backgroundColor: "#C7D2FE" }]}>
               <MaterialCommunityIcons name="help-circle" size={20} color={theme.primaryButton} />
            </View>
            <View style={styles.text}>
                <AppText
                    variant="label"
                    style={{ color: "#1E3A8A", fontWeight: "700" }}>
                    Need help?
                </AppText>
                <AppText variant="caption" style={{ color: "#3B4A6B" }}>
                    Having trouble with OCR capture? Ensure you are in a
                    well-lit area with high visibility.
                </AppText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 14,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    text: {
        flex: 1,
        gap: 4,
    },
});
