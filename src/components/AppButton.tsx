import { useAppTheme } from '@/hooks/useAppTheme';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle
} from 'react-native';
import AppText from './AppText';

type ButtonVariant = 'primary' | 'secondary';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: AppButtonProps) {
  const theme = useAppTheme();
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? theme.primaryButton : theme.secondaryButton;
  const textColor = isPrimary ? '#FFFFFF' : theme.primaryButton;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor },
        isDisabled && styles.disabled,
        Platform.OS === 'ios' && pressed && styles.pressedIOS,
        style,
      ]}
      android_ripple={{
        color: isPrimary ? 'rgba(255,255,255,0.2)' : 'rgba(32,138,239,0.15)',
        borderless: false,
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <AppText variant="label1" color='textCommon'>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
   
  },
  disabled: {
    opacity: 0.5,
  },
  pressedIOS: {
    opacity: 0.85,
  },
});
