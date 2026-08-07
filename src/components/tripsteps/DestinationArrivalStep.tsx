import AppButton from '@/components/AppButton';
import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

interface DestinationArrivalStepProps {
  shipmentUuid?: string;
}

export default function DestinationArrivalStep({ shipmentUuid }: DestinationArrivalStepProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <AppText variant="label" style={styles.title}>Complete Delivery</AppText>
        <AppText variant="caption" color="secondaryText">
          Capture POD and get receiver signature
        </AppText>
      </View>

      <AppButton
        title="Complete Delivery"
        onPress={() =>
          router.push({
            pathname: '/trip/complete-delivery-form',
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
