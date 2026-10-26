import AppButton from "@/components/AppButton";
import AppText from "@/components/AppText";
import PhotoCaptureModal from "@/components/PhotoCaptureModal";
import RetryNotice from "@/components/loads/RetryNotice";
import { useAppTheme } from "@/hooks/useAppTheme";
import { invalidate } from "@/lib/invalidate";
import { friendlyError, loadApi } from "@/lib/loadApi";
import type { StopEvent } from "@/types/shipment";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { getPositionWithin } from "@/utils/currentPosition";
import { shrinkPhoto } from "@/utils/photos";
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
    /* The question the in-app camera is open for, or null. */
    const [cameraFor, setCameraFor] = useState<string | null>(null);
    /* Picked photos still being shrunk; saving now would leave them out. */
    const [preparing, setPreparing] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    /* Fetching the questions failed: replaces the form, with a retry. */
    const [loadError, setLoadError] = useState<string | null>(null);
    /* Saving failed: shown under the answers, which stay as typed. */
    const [error, setError] = useState<string | null>(null);

    /*
    | Another stop: start again from a spinner. Adjusted while rendering, so
    | the fetch effect below only has to start the request.
    */
    const stopKey = `${shipmentUuid}:${stopId}`;
    const [shownStop, setShownStop] = useState(stopKey);
    if (shownStop !== stopKey) {
        setShownStop(stopKey);
        setLoading(true);
        setLoadError(null);
        setError(null);
    }

    /* The request itself: state changes only once it settles. */
    const fetchEvents = useCallback(
        () =>
            loadApi
                .getStopEvents(shipmentUuid, stopId)
                .then((res) => {
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
                })
                .catch((err: unknown) => {
                    // Rendering nothing here left a driver blocked by questions they could not see.
                    setEvents([]);
                    setLoadError(friendlyError(err, "Could not load the questions."));
                })
                .finally(() => setLoading(false)),
        [shipmentUuid, stopId],
    );

    /* Try again, from the error card. */
    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        setError(null);
        await fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        void fetchEvents();
    }, [fetchEvents]);

    /*
    | Photos are taken with the in-app camera (PhotoCaptureModal): the phone's
    | camera app discarded a shot when the driver swiped back instead of
    | tapping ✓, without a word. A photo taken earlier can still be picked.
    | "Compatible" has iOS hand over a JPEG instead of the HEIC it stores, which
    | the server rejects. The system picker needs no photo-library permission.
    */
    const choosePhoto = async (eventId: string) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                quality: 0.6,
                preferredAssetRepresentationMode:
                    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            });
            if (result.canceled || !result.assets?.length) return;

            const asset = result.assets[0];
            setPreparing((n) => n + 1);
            const uri = await shrinkPhoto(asset.uri).finally(() =>
                setPreparing((n) => n - 1),
            );
            setImages((prev) => ({
                ...prev,
                [eventId]: {
                    uri,
                    name: `event-${eventId}.jpg`,
                    type: "image/jpeg",
                },
            }));
        } catch (err: unknown) {
            setError(friendlyError(err, "Could not open your photos."));
        }
    };

    const missingRequired = events.filter((event) => {
        if (!event.required) return false;
        if (event.answer_type === "image_upload") {
            return !images[event.id] && !event.answer_image_url;
        }
        return !values[event.id]?.trim() && !event.answer_value;
    });

    const submit = async () => {
        if (preparing > 0) return;
        // Only what goes out now is cleared afterwards; anything added meanwhile stays.
        const sent = images;
        setSaving(true);
        setError(null);
        try {
            // Best effort: the answer is still worth recording without a fix.
            let coords: { latitude: number; longitude: number } | null = null;
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.granted) {
                    const position = await getPositionWithin(Location.Accuracy.Balanced);
                    coords = position
                        ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
                        : null;
                }
            } catch {
                coords = null;
            }

            const res = await loadApi.saveStopEvents(
                shipmentUuid,
                stopId,
                values,
                sent,
                coords,
            );

            const outstanding = res.data?.data?.outstanding ?? 0;
            setEvents(res.data?.data?.events ?? []);
            setImages((current) =>
                Object.fromEntries(
                    Object.entries(current).filter(
                        ([eventId, image]) => sent[eventId]?.uri !== image.uri,
                    ),
                ),
            );
            onSaved?.(outstanding);
            // Answers gate the stop's next step, wherever the trip is showing it.
            invalidate("trip");
        } catch (err: unknown) {
            setError(friendlyError(err, "Could not save your answers."));
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

    if (loadError) {
        return (
            <RetryNotice
                title="Couldn't load the questions"
                message={loadError}
                onRetry={load}
                style={styles.notice}
            />
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
                        <>
                            <Pressable
                                onPress={() => setCameraFor(event.id)}
                                // Locked while saving: the save clears photos when it lands.
                                disabled={saving}
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
                                            Take a photo
                                        </AppText>
                                    </>
                                )}
                            </Pressable>
                            <Pressable
                                onPress={() => choosePhoto(event.id)}
                                disabled={saving}
                                hitSlop={8}
                                style={[styles.photosLink, saving && { opacity: 0.4 }]}>
                                <AppText
                                    variant="caption"
                                    style={{ color: theme.primaryButton, fontWeight: "600" }}>
                                    {images[event.id] || event.answer_image_url
                                        ? "Retake by tapping the photo, or choose from your photos"
                                        : "or choose from your photos"}
                                </AppText>
                            </Pressable>
                        </>
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
                disabled={preparing > 0}
            />

            <PhotoCaptureModal
                visible={cameraFor !== null}
                title="Photo for your broker"
                onCaptured={(photo) => {
                    const eventId = cameraFor;
                    setCameraFor(null);
                    if (!eventId) return;
                    setImages((prev) => ({
                        ...prev,
                        [eventId]: {
                            uri: photo.uri,
                            name: `event-${eventId}.jpg`,
                            type: "image/jpeg",
                        },
                    }));
                }}
                onClose={() => setCameraFor(null)}
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
    notice: {
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
    photosLink: {
        alignSelf: "center",
        marginTop: 8,
    },
});
