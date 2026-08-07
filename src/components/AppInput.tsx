import { Fonts } from "@/constants/fonts";
import { useAppTheme } from "@/hooks/useAppTheme";
import { forwardRef, useState } from "react";
import {
    Platform,
    StyleSheet,
    TextInput,
    TextInputProps,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";
import AppText from "./AppText";

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const AppInput = forwardRef<TextInput, AppInputProps>(
  (
    {
      label,
      error,
      containerStyle,
      inputStyle,
      leftIcon,
      rightIcon,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const theme = useAppTheme();
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? theme.err
      : focused
        ? theme.primaryButton
        : theme.cardSecondary;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? <AppText variant="caption">{label}</AppText> : null}

        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: theme.background,
              borderColor,
            },
          ]}
        >
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: theme.text,
                ...Platform.select({
                  android: { includeFontPadding: false },
                }),
              },
              inputStyle,
            ]}
            placeholderTextColor={theme.secondaryText}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            underlineColorAndroid="transparent"
            {...props}
          />

          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>

        {error ? <AppText variant="tiny">{error}</AppText> : null}
      </View>
    );
  },
);

export default AppInput;

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    gap: 6,
  },
 
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12,
    paddingVertical: 0,
  },
  iconLeft: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRight: {
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: "#EF4444",
    marginLeft: 2,
  },
});