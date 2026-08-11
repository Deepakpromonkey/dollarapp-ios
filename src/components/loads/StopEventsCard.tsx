import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { loadApi } from "@/lib/loadApi";
import type { StopEvent } from "@/types/shipment";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

interface Props {
    shipmentUuid: string;
    stopId: number;
    /** Shown above the questions, e.g. "Pickup · Detroit Yard". */
    title?: string;
    /** Called after a successful save, so the parent can re-check gating. */
    onSaved?: (outstanding: number) => void;
}

type LocalImage = { uri: string; name: string; type: string };

/**
 * The broker's questions for one stop, and the driver's answers.
 *
 * The broker adds these while building the trip sheet, and the driver cannot
 * mark the stop loaded or delivered until the required ones are filled in — so
 * this is a blocking step, not a nicety, and it says so.
 */
export default function StopEventsCard({
    shipmentUuid,
    stopId,
    title,
    onSaved,
}: Props) {
    const theme = useAppTheme();

    const [events, setEvents] = useState<StopEvent[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [images, setImages] = useState<Record<string, LocalImage>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await loadApi.getStopEvents(shipmentUuid, stopId);
            const list = res.data?.data?.events ?? [];
            setEvents(list);

            // Seed the inputs with whatever was answered before, so re-opening
            // the form shows the driver what they already said.
            setValues(
                Object.fromEntries(
                    list
                        .filter((e) => e.answer_value != null)
                        .map((e) => [e.id, String(e.answer_value)]),
                ),
            );
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Could not load questions",
            );
        } finally {
            setLoading(false);
        }
    }, [shipmentUuid, stopId]);

    useEffect(() => {
        load();
    }, [load]);

    const pickImage = async (eventId: string) => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        // Falling back to the library rather than dead-ending: a driver who has
        // denied the camera can still have a photo of the paperwork.
        const result = permission.granted
            ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
            : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];

        setImages((prev) => ({
            ...prev,
            [eventId]: {
                uri: asset.uri,
                name: asset.fileName ?? `event-${eventId}.jpg`,
                type: asset.mimeType ?? "image/jpeg",
            },
        }));
    };

    const missingRequired = events.filter((event) => {
        if (!event.required) return false;
        if (event.answer_type === "image_upload") {
            return !images[event.id] && !event.answer_image_url;
        }
        return !values[event.id]?.trim() && !event.answer_value;
    });

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            // Best effort: the answer is still worth recording without a fix.
            let coords: { latitude: number; longitude: number } | null = null;
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.granted) {
                    const position = await Location.getCurrentPositionAsync({});
                    coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                }
            } catch {
                coords = null;
            }

            const res = await loadApi.saveStopEvents(
                shipmentUuid,
                stopId,
                values,
                images,
                coords,
            );

            const outstanding = res.data?.data?.outstanding ?? 0;
            setEvents(res.data?.data?.events ?? []);
            setImages({});
            onSaved?.(outstanding);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not save answers");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <ActivityIndicator color={theme.primaryButton} />
            </View>
        );
    }

    if (events.length === 0) {
        return null;
    }

    return (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.header}>
                <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={18}
                    color={theme.primaryButton}
                />
                <AppText
                    variant="label"
                    style={{ color: theme.text, fontWeight: "700", flex: 1 }}>
                    {title ?? "Questions from your broker"}
                </AppText>
            </View>

            <AppText
                variant="caption"
                style={{ color: theme.secondaryText, marginBottom: 14 }}>
                {missingRequired.length > 0
                    ? `${missingRequired.length} answer${missingRequired.length === 1 ? "" : "s"} still needed before you can continue.`
                    : "All required answers are in."}
            </AppText>

            {events.map((event) => (
                <View key={event.id} style={styles.field}>
                    <View style={styles.labelRow}>
                        <AppText
                            variant="label1"
                            style={{ color: theme.text, flex: 1 }}>
                            {event.question}
                            {event.required ? (
                                <AppText variant="label1" style={{ color: theme.err }}>
                                    {" *"}
                                </AppText>
                            ) : null}
                        </AppText>
                        {event.answered && (
                            <MaterialCommunityIcons
                                name="check-circle"
                                size={16}
                                color={theme.secondaryButton}
                            />
                        )}
                    </View>

                    {event.answer_type === "yes_no" ? (
                        <View style={styles.yesNoRow}>
                            {["yes", "no"].map((option) => {
                                const selected =
                                    (values[event.id] ?? event.answer_value) === option;
                                return (
                                    <Pressable
                                        key={option}
                                        onPress={() =>
                                            setValues((prev) => ({
                                                ...prev,
                                                [event.id]: option,
                                            }))
                                        }
                                        style={[
                                            styles.yesNoButton,
                                            {
                                                backgroundColor: selected
                                                    ? theme.primaryButton
                                                    : theme.cardSecondary,
                                            },
                                        ]}>
                                        <AppText
                                            variant="label1"
                                            style={{
                                                color: selected
                                                    ? "#FFFFFF"
                                                    : theme.text,
                                            }}>
                                            {option === "yes" ? "Yes" : "No"}
                                        </AppText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : event.answer_type === "image_upload" ? (
                        <Pressable
                            onPress={() => pickImage(event.id)}
                            style={[
                                styles.imagePicker,
                                { backgroundColor: theme.cardSecondary },
                            ]}>
                            {images[event.id] || event.answer_image_url ? (
                                <Image
                                    source={{
                                        uri:
                                            images[event.id]?.uri ??
                                            event.answer_image_url!,
                                    }}
                                    style={styles.preview}
                                />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name="camera-plus-outline"
                                        size={22}
                                        color={theme.secondaryText}
                                    />
                                    <AppText
                                        variant="caption"
                                        style={{ color: theme.secondaryText }}>
                                        Take or choose a photo
                                    </AppText>
                                </>
                            )}
                        </Pressable>
                    ) : (
                        <TextInput
                            value={values[event.id] ?? ""}
                            onChangeText={(text) =>
                                setValues((prev) => ({ ...prev, [event.id]: text }))
                            }
                            placeholder={
                                event.answer_type === "number"
                                    ? "Enter a number"
                                    : "Type your answer"
                            }
                            placeholderTextColor={theme.secondaryText}
                            keyboardType={
                                event.answer_type === "number" ? "numeric" : "default"
                            }
                            multiline={event.answer_type === "textarea"}
                            style={[
                                styles.input,
                                {
                                    backgroundColor: theme.cardSecondary,
                                    color: theme.text,
                                },
                                event.answer_type === "textarea" && styles.textarea,
                            ]}
                        />
                    )}
                </View>
            ))}

            {error && (
                <AppText
                    variant="caption"
                    style={{ color: theme.err, marginBottom: 10 }}>
                    {error}
                </AppText>
            )}

            <AppButton
                title={saving ? "Saving..." : "Save answers"}
                onPress={submit}
                loading={saving}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
    },
    field: {
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },
    textarea: {
        minHeight: 88,
        textAlignVertical: "top",
    },
    yesNoRow: {
        flexDirection: "row",
        gap: 10,
    },
    yesNoButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 11,
        alignItems: "center",
    },
    imagePicker: {
        borderRadius: 10,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    preview: {
        width: "100%",
        height: 160,
        borderRadius: 8,
        resizeMode: "cover",
    },
});
