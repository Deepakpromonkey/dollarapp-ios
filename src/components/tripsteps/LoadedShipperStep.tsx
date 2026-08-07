import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

interface LoadedShipperStepProps {
  onComplete: () => void;
  shipmentUuid?: string;
}

export default function LoadedShipperStep({ onComplete, shipmentUuid }: LoadedShipperStepProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <AppText variant="label" style={styles.title}>Loaded at Shipper</AppText>
        <AppText variant="caption" color="secondaryText">
          Manual check-in with shipper OTP required
        </AppText>
      </View>

      <AppButton
        title="Enter Shipper OTP"
        onPress={() =>
          router.push({
            pathname: '/trip/loaded-shipper-form',
            params: shipmentUuid ? { uuid: shipmentUuid } : {},
          })
        }
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
  },
});
