import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface InfoRowProps {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    value: string | null | undefined;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
    const theme = useAppTheme();
    return (
        <View
            style={[
                styles.row,
                {
                    backgroundColor: theme.card,
                    borderColor: theme.cardSecondary,
                },
            ]}>
            <View
                style={[
                    styles.iconBox,
                    { backgroundColor: theme.cardSecondary },
                ]}>
                <MaterialCommunityIcons
                    name={icon}
                    size={18}
                    color={theme.primaryButton}
                />
            </View>
            <View style={styles.rowContent}>
                <AppText variant="tiny" style={{ color: theme.secondaryText }}>
                    {label}
                </AppText>
                <AppText
                    variant="label"
                    style={{ color: value ? theme.text : theme.secondaryText }}>
                    {value ?? "—"}
                </AppText>
            </View>
        </View>
    );
}

export default function PersonalInfoScreen() {
    const theme = useAppTheme();
    const { profile, isLoading } = useDriverProfile();

    const fullName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : null;

    // app_drivers has no role system — everyone signing in here is a driver.
    const role = profile ? "Driver" : null;

    return (
        <SafeAreaView
            edges={["top"]}
            style={[styles.screen, { backgroundColor: theme.background }]}>
            <View style={[styles.inner, { backgroundColor: theme.background }]}>
                <NavHeader title="Personal Info" />

                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator
                            size="large"
                            color={theme.primaryButton}
                        />
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}>
                        {/* Avatar */}
                        <View style={styles.avatarSection}>
                            {profile?.profile_picture_url ? (
                                <Image
                                    source={{ uri: profile.profile_picture_url }}
                                    style={styles.avatar}
                                />
                            ) : (
                                <View
                                    style={[
                                        styles.avatar,
                                        styles.avatarPlaceholder,
                                        {
                                            backgroundColor:
                                                theme.cardSecondary,
                                        },
                                    ]}>
                                    <AppText
                                        style={{
                                            fontSize: 32,
                                            color: theme.primaryButton,
                                        }}>
                                        {profile?.first_name
                                            ?.charAt(0)
                                            .toUpperCase() ?? "?"}
                                    </AppText>
                                </View>
                            )}
                            <AppText
                                variant="title"
                                style={{ color: theme.text, marginTop: 12 }}>
                                {fullName ?? "—"}
                            </AppText>
                            {role && (
                                <View
                                    style={[
                                        styles.roleBadge,
                                        {
                                            backgroundColor: "#2563EB18",
                                            borderColor: "#2563EB30",
                                        },
                                    ]}>
                                    <AppText
                                        variant="tiny"
                                        style={{
                                            color: "#2563EB",
                                            fontWeight: "700",
                                            letterSpacing: 0.4,
                                        }}>
                                        {role.toUpperCase()}
                                    </AppText>
                                </View>
                            )}
                        </View>

                        {/* Info rows */}
                        <View style={styles.section}>
                            <AppText
                                variant="caption"
                                style={{
                                    color: theme.secondaryText,
                                    marginBottom: 6,
                                    marginLeft: 4,
                                }}>
                                BASIC DETAILS
                            </AppText>

                            <InfoRow
                                icon="account-outline"
                                label="Name"
                                value={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()}
                            />
                        </View>


                        <InfoRow
                            icon="email-outline"
                            label="Email"
                            value={profile?.email}
                        />
                        <InfoRow
                            icon="phone-outline"
                            label="Phone"
                            value={profile?.phone}
                        />
                       
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    inner: { flex: 1 },
    loader: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 16,
    },
    avatarSection: {
        alignItems: "center",
        paddingVertical: 14,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },
    roleBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
    },
    section: {
        gap: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    rowContent: {
        flex: 1,
        gap: 2,
    },
});
