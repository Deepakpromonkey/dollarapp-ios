import AppText from "@/components/AppText";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useEffect, useRef, useState } from "react";
import {
    Keyboard,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

const OTP_LENGTH = 6;

interface OtpInputProps {
    value: string[];
    onChange: (otp: string[]) => void;
    hasError?: boolean;
    autoFocus?: boolean;
}

const Cursor = ({ theme }: { theme: ReturnType<typeof useAppTheme> }) => {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <Animated.View
            style={[
                styles.cursor,
                { backgroundColor: theme.secondaryText },
                style,
            ]}
        />
    );
};

export default function OtpInput({
    value,
    onChange,
    hasError = false,
    autoFocus = true,
}: OtpInputProps) {
    const theme = useAppTheme();
    const inputRef = useRef<TextInput>(null);

    const textValue = value.join("");

    const focusedIndex =
        textValue.length === OTP_LENGTH ? OTP_LENGTH - 1 : textValue.length;
    const [isFocused, setIsFocused] = useState(autoFocus);

    const shakeX = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));

    useEffect(() => {
        const keyboardDidHideListener = Keyboard.addListener(
            "keyboardDidHide",
            () => {
                inputRef.current?.blur();
                setIsFocused(false);
            },
        );

        return () => {
            keyboardDidHideListener.remove();
        };
    }, []);

    useEffect(() => {
        if (hasError) {
            shakeX.value = withSequence(
                withTiming(-8, { duration: 60 }),
                withTiming(8, { duration: 60 }),
                withTiming(-6, { duration: 60 }),
                withTiming(6, { duration: 60 }),
                withTiming(0, { duration: 60 }),
            );
        }
    }, [hasError, shakeX]);

    useEffect(() => {
        if (autoFocus) {
            const t = setTimeout(() => {
                inputRef.current?.focus();
                setIsFocused(true);
            }, 400);
            return () => clearTimeout(t);
        }
    }, [autoFocus]);

    const handleChangeText = (text: string) => {
        const numeric = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
        const newOtp = Array(OTP_LENGTH).fill("");
        for (let i = 0; i < numeric.length; i++) {
            newOtp[i] = numeric[i];
        }
        onChange(newOtp);
    };

    const handlePress = () => {
        if (inputRef.current?.isFocused()) {
            inputRef.current.blur();

            setTimeout(() => {
                inputRef.current?.focus();
                setIsFocused(true);
            }, 50);
        } else {
            inputRef.current?.focus();
            setIsFocused(true);
        }
    };

    return (
        <View>
            <TextInput
                ref={inputRef}
                value={textValue}
                onChangeText={handleChangeText}
                style={styles.hiddenInput}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus={autoFocus}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                caretHidden={true}
                autoComplete="one-time-code"
            />
            <TouchableOpacity
                style={styles.boxesContainer}
                onPress={handlePress}
                activeOpacity={1}>
                <Animated.View style={[styles.row, shakeStyle]}>
                    {Array(OTP_LENGTH)
                        .fill(0)
                        .map((_, i) => {
                            const digit = value[i] || "";
                            const isCurrentFocus =
                                isFocused && focusedIndex === i;
                            const filled = digit !== "";

                            let borderColor: any = theme.cardSecondary;
                            if (hasError) borderColor = theme.err;
                            else if (isCurrentFocus || filled)
                                borderColor = theme.primaryButton;

                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.boxWrapper,
                                        {
                                            borderColor: borderColor as any,
                                        },
                                    ]}>
                                    {digit ? (
                                        <AppText
                                            style={[
                                                { color: theme.text as any },
                                            ]}>
                                            {digit}
                                        </AppText>
                                    ) : isCurrentFocus ? (
                                        <Cursor theme={theme} />
                                    ) : null}
                                </View>
                            );
                        })}
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    hiddenInput: {
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
    },
    boxesContainer: {
        width: "100%",
    },
    row: {
        flexDirection: "row",
        gap: 10,
    },
    boxWrapper: {
        flex: 1,
        height: 62,
        borderRadius: 14,
        borderWidth: 1.5,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },

    cursor: {
        width: 2,
        height: 24,

        borderRadius: 1,
    },
});
