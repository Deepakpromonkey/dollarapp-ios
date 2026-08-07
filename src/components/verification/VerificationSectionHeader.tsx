import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { StyleSheet, View } from "react-native";

interface VerificationSectionHeaderProps {
    title: string;
}

export default function VerificationSectionHeader({
    title,
}: VerificationSectionHeaderProps) {
    const theme = useAppTheme();

    return (
        <View style={styles.container}>
            <AppText
                variant="caption"
                style={[ { color: theme.secondaryText }]}>
                {title}
            </AppText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 4,
        paddingBottom: 4,
        paddingTop: 8,
    },
   
});
