import AppText from "@/components/AppText";
import NavHeader from "@/components/NavHeader";
import { useAppTheme } from "@/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useShipmentChat } from "@/hooks/useShipmentChat";
import {
    ActivityIndicator,
    Animated,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TextStyle,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

/** Wall-clock time for a bubble, from the servers ISO timestamp. */
function bubbleTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ""
        : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export default function ChatScreen() {
    const theme = useAppTheme();

    // Which load's conversation this is. The chat is per shipment, so without
    // a uuid there is nothing to show.
    const { uuid, title } = useLocalSearchParams<{
        uuid?: string;
        title?: string;
    }>();

    const { messages, shipmentNo, loading, sending, error, send } =
        useShipmentChat(uuid);

    const [input, setInput] = useState("");
    const scrollRef = useRef<ScrollView>(null);
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSub = Keyboard.addListener(showEvent, (e) => {
            const height = e.endCoordinates.height;
            Animated.timing(translateY, {
                toValue: -height + (Platform.OS === "ios" ? 20 : 0),
                duration: Platform.OS === "ios" ? e.duration || 250 : 200,
                useNativeDriver: true,
            }).start(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            });
        });

        const hideSub = Keyboard.addListener(hideEvent, (e) => {
            Animated.timing(translateY, {
                toValue: 0,
                duration: Platform.OS === "ios" ? e.duration || 250 : 200,
                useNativeDriver: true,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || sending) return;

        // Cleared up front so the field feels responsive, and put back if the
        // send fails — retyping a message the app appeared to accept is worse
        // than seeing it return to the box.
        setInput("");

        try {
            await send(trimmed);
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch {
            setInput(trimmed);
        }
    };

    return (
        <SafeAreaView
            style={[styles.screen, { backgroundColor: theme.card }]}
            edges={["top"]}>
            <StatusBar backgroundColor={theme.card} barStyle="dark-content" />

            <NavHeader title="Chat Inbox" />

            <View style={[styles.loadTag, { backgroundColor: theme.cardSecondary }]}>
                <MaterialCommunityIcons
                    name="truck-outline"
                    size={14}
                    color={theme.primaryButton}
                />
                <AppText
                    variant="tiny"
                    style={{ color: theme.primaryButton, marginLeft: 4 }}>
                    {title || shipmentNo || "Load"}
                </AppText>
            </View>

            {error && (
                <View style={styles.noticeRow}>
                    <AppText variant="caption" style={{ color: theme.err }}>
                        {error}
                    </AppText>
                </View>
            )}

            <KeyboardAwareScrollView
                ref={scrollRef as any}
                style={styles.messageArea}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                enableOnAndroid
                enableAutomaticScroll={false} 
                extraScrollHeight={0}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() =>
                    scrollRef.current?.scrollToEnd({ animated: false })
                }>
                {loading && messages.length === 0 && (
                    <View style={styles.noticeRow}>
                        <ActivityIndicator color={theme.primaryButton} />
                    </View>
                )}

                {!loading && messages.length === 0 && (
                    <View style={styles.noticeRow}>
                        <AppText
                            variant="caption"
                            style={{ color: theme.secondaryText, textAlign: "center" }}>
                            No messages yet. Send your dispatcher a note about this load.
                        </AppText>
                    </View>
                )}

                {messages.map((item) => {
                    const isMe = item.sender_type === "driver";
                    return (
                        <View
                            key={item.uuid}
                            style={[
                                styles.bubbleRow,
                                isMe ? styles.bubbleRowMe : styles.bubbleRowThem,
                            ]}>
                            {!isMe && (
                                <View
                                    style={[
                                        styles.avatar,
                                        { backgroundColor: theme.primaryButton },
                                    ]}>
                                    <AppText variant="tiny" style={{ color: "#fff" }}>
                                        D
                                    </AppText>
                                </View>
                            )}
                            <View style={styles.bubbleWrap}>
                                <View
                                    style={[
                                        styles.bubble,
                                        isMe
                                            ? { backgroundColor: theme.primaryButton }
                                            : { backgroundColor: theme.card },
                                    ]}>
                                    <AppText
                                        variant="body"
                                        style={{
                                            color: isMe ? "#fff" : theme.text,
                                            lineHeight: 20,
                                        }}>
                                        {item.body}
                                    </AppText>
                                </View>
                                <AppText
                                    variant="tiny"
                                    style={[
                                        styles.timeLabel,
                                        { color: theme.secondaryText },
                                        isMe
                                            ? ({ textAlign: "right" } as TextStyle)
                                            : ({} as TextStyle),
                                    ]}>
                                    {bubbleTime(item.created_at)}
                                </AppText>
                            </View>
                        </View>
                    );
                })}
            </KeyboardAwareScrollView>

            <Animated.View
                style={[
                    styles.inputBar,
                    {
                        backgroundColor: theme.card,
                        transform: [{ translateY }],
                    },
                ]}>
                <SafeAreaView edges={["bottom"]} style={styles.inputBarInner}>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.cardSecondary,
                                color: theme.text,
                            },
                        ]}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.secondaryText}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        returnKeyType="send"
                        onSubmitEditing={sendMessage}
                    />
                    <Pressable
                        onPress={sendMessage}
                        style={[styles.sendBtn, { backgroundColor: theme.primaryButton }]}>
                        <MaterialCommunityIcons name="send" size={18} color="#fff" />
                    </Pressable>
                </SafeAreaView>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    headerWrap: { zIndex: 10 },
    noticeRow: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    loadTag: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 2,
    },
    messageArea: { flex: 1 },
    messageList: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
        gap: 12,
    },
    bubbleRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },
    bubbleRowMe: { justifyContent: "flex-end" },
    bubbleRowThem: { justifyContent: "flex-start" },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    bubbleWrap: { maxWidth: "75%", gap: 2 },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    timeLabel: { fontSize: 10, marginHorizontal: 4 },
    inputBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0,0,0,0.1)",
    },
    inputBarInner: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 10,
    },
    input: {
        flex: 1,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        maxHeight: 100,
        fontFamily: "Poppins-Regular",
    },
    sendBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
    },
});