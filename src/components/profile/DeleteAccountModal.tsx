import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { friendlyError } from "@/lib/loadApi";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

/*
| Asking for the account to be deleted.
|
| Deletion is not immediate: the API schedules it 15 days out and signs the
| driver out on every phone, and logging in again before then cancels it. The
| wording below says exactly that, because a driver who expects their data gone
| today, or who expects to be able to undo it next month, is being misled.
*/

/* Keep in step with the API's grace period (config driver.deletion_grace_days). */
const GRACE_DAYS = 15;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/*
| The date the driver is told to log in by, worked out the same way as the
| server's email: the UTC calendar date of the moment 36 hours before the
| purge. The purge runs at the exact moment 15 days after the request, so the
| plain date of that moment is a day late in some time zones (dated in
| Kolkata, the email told a Chicago driver "29 Oct" for an account purged on
| the 28th). The whole of the earlier date falls before the purge in every
| time zone, so logging in by then is always in time, and the screen and the
| email name the same day.
*/
const DEADLINE_MARGIN_MS = 36 * HOUR_MS;

const DANGER = "#EF4444";
const WARNING = "#F59E0B";

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/*
| "28 Oct 2026" for a purge at `purgeAt` (ms). Built by hand from the UTC
| parts, so it reads the same on every phone whatever its time zone or Intl
| support.
*/
function deadlineFor(purgeAt: number): string {
    const day = new Date(purgeAt - DEADLINE_MARGIN_MS);
    return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

/* The purge moment the API sent, or null when it is missing or unreadable. */
function purgeTime(iso?: string | null): number | null {
    if (!iso) return null;
    const time = new Date(iso).getTime();
    return Number.isNaN(time) ? null : time;
}

interface DeleteAccountModalProps {
    visible: boolean;
    /** When it was opened (ms), stamped by the tap that opened it. */
    openedAt: number;
    onClose: () => void;
    /** The driver is on a load right now; deleting stops its tracking. */
    hasActiveLoad?: boolean;
}

export default function DeleteAccountModal({
    visible,
    openedAt,
    onClose,
    hasActiveLoad = false,
}: DeleteAccountModalProps) {
    const theme = useAppTheme();
    const { requestAccountDeletion, signOutLocally } = useAuth();

    const [confirmed, setConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The date the API will state, counted from when the dialog was opened.
    const deleteBy = deadlineFor(openedAt + GRACE_DAYS * DAY_MS);

    /* Reset on the way out, so the next time it opens the box starts unticked. */
    const close = () => {
        if (submitting) return;
        setConfirmed(false);
        setError(null);
        onClose();
    };

    const handleDelete = async () => {
        if (!confirmed || submitting) return;
        setSubmitting(true);
        setError(null);

        let confirmedDate: string;
        try {
            const result = await requestAccountDeletion();
            /*
            | The server's own date, word for word what its email says. An
            | older API build sends only the purge moment: the same rule is
            | applied to that here, and to now + 15 days if even that is missing.
            */
            confirmedDate =
                result?.deletion_date?.trim() ||
                deadlineFor(
                    purgeTime(result?.deletion_scheduled_for) ??
                        Date.now() + GRACE_DAYS * DAY_MS,
                );
        } catch (err) {
            setError(friendlyError(err, "Something went wrong. Please try again."));
            setSubmitting(false);
            return;
        }

        /*
        | The account's tokens are already revoked, so the driver is signed out
        | whatever happens to the alert. The alert is the native dialog and
        | stays up while the app moves to the login screen underneath it.
        */
        try {
            onClose();
            Alert.alert(
                "Deletion scheduled",
                `Your account will be deleted on ${confirmedDate}. To keep it, just log in again before then.`,
            );
        } finally {
            void signOutLocally();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={close}>
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        bounces={false}>
                        <View style={styles.iconCircle}>
                            <MaterialCommunityIcons
                                name="account-remove-outline"
                                size={26}
                                color={DANGER}
                            />
                        </View>

                        <AppText
                            variant="title"
                            style={{ color: theme.text, textAlign: "center" }}>
                            Delete your account?
                        </AppText>

                        <AppText variant="label1" style={{ color: theme.text }}>
                            {"If you don't log in again by "}
                            <AppText variant="label" style={{ color: theme.text }}>
                                {deleteBy}
                            </AppText>
                            , we will permanently delete your DollarTraq account
                            and the data linked to your phone number: your
                            profile, phone number, email, CDL photos, profile
                            photo and location history.
                        </AppText>

                        <AppText variant="label1" style={{ color: theme.text }}>
                            You will be signed out on all devices now.
                        </AppText>

                        <AppText variant="label1" style={{ color: theme.text }}>
                            Changed your mind? Just log in before {deleteBy} and
                            nothing is deleted.
                        </AppText>

                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText }}>
                            Your broker keeps the loads you already drove,
                            including the messages you sent on them (with your
                            name) and the phone number they entered for those
                            loads.
                        </AppText>

                        {hasActiveLoad && (
                            <View style={styles.warning}>
                                <MaterialCommunityIcons
                                    name="alert-outline"
                                    size={18}
                                    color={WARNING}
                                />
                                <AppText
                                    variant="caption"
                                    style={{ color: theme.text, flex: 1 }}>
                                    You have an active load. Deleting your
                                    account stops location tracking for it, so
                                    tell your dispatcher first.
                                </AppText>
                            </View>
                        )}

                        <Pressable
                            onPress={() => setConfirmed((v) => !v)}
                            disabled={submitting}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: confirmed }}
                            hitSlop={6}
                            style={styles.checkRow}>
                            <MaterialCommunityIcons
                                name={
                                    confirmed
                                        ? "checkbox-marked"
                                        : "checkbox-blank-outline"
                                }
                                size={24}
                                color={confirmed ? DANGER : theme.secondaryText}
                            />
                            <AppText
                                variant="label1"
                                style={{ color: theme.text, flex: 1 }}>
                                I understand my account will be deleted after{" "}
                                {GRACE_DAYS} days
                            </AppText>
                        </Pressable>

                        {error ? (
                            <View style={styles.errorBox}>
                                <AppText variant="caption" style={{ color: DANGER }}>
                                    {error}
                                </AppText>
                            </View>
                        ) : null}
                    </ScrollView>

                    <View style={styles.actions}>
                        <AppButton
                            title="Delete account"
                            onPress={handleDelete}
                            disabled={!confirmed}
                            loading={submitting}
                            style={styles.deleteButton}
                        />
                        <AppButton
                            title="Keep my account"
                            variant="secondary"
                            onPress={close}
                            disabled={submitting}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        borderRadius: 20,
        maxHeight: "90%",
        overflow: "hidden",
    },
    content: {
        padding: 20,
        gap: 12,
    },
    iconCircle: {
        alignSelf: "center",
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#EF444418",
        justifyContent: "center",
        alignItems: "center",
    },
    warning: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F59E0B40",
        backgroundColor: "#F59E0B18",
    },
    checkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4,
    },
    errorBox: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#EF444440",
        backgroundColor: "#EF444418",
        padding: 12,
    },
    actions: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 4,
        gap: 10,
    },
    deleteButton: {
        backgroundColor: DANGER,
    },
});
