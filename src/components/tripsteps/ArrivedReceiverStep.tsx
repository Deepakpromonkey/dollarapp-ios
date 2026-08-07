import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/lib/api';
import * as ExpoLocation from 'expo-location';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

interface ArrivedReceiverStepProps {
  onArrive: () => void;
  distanceToDestination: number;
  canArrive: boolean;
  shipmentUuid?: string;
}

export default function ArrivedReceiverStep({
  onArrive,
  distanceToDestination,
  canArrive,
  shipmentUuid,
}: ArrivedReceiverStepProps) {
  const theme = useAppTheme();
  const [submitting, setSubmitting] = useState(false);

  const handleArrive = async () => {
    if (!shipmentUuid) {
      Alert.alert('Error', 'Shipment ID missing.');
      return;
    }

    setSubmitting(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== ExpoLocation.PermissionStatus.GRANTED) {
        Alert.alert('Location Required', 'Allow location access to mark arrival.');
        setSubmitting(false);
        return;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });

      await api.post(`/shipments/${shipmentUuid}/journey/arrived-receiver`, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      onArrive();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to mark arrival. Please try again.';
      Alert.alert('Arrival Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <AppText variant="label" style={styles.title}>
          Arrived at Receiver
        </AppText>
        <AppText variant="caption" color="secondaryText">
          {canArrive
            ? 'You are within 500m radius'
            : `${Math.round(distanceToDestination)}m away — move closer to enable`}
        </AppText>
      </View>

      <Pressable
        onPress={handleArrive}
        disabled={!canArrive || submitting}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor:
              !canArrive || submitting
                ? theme.cardSecondary
                : theme.primaryButton,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <AppText
          variant="label1"
          style={{
            color: !canArrive || submitting ? theme.secondaryText : '#fff',
            fontWeight: '600',
            textAlign: 'center',
          }}>
          {submitting ? 'Marking Arrival...' : 'Arrived at Receiver'}
        </AppText>
      </Pressable>

      {!canArrive && (
        <AppText variant="tiny" color="secondaryText" style={styles.hint}>
          Get within 500m of destination to activate this step
        </AppText>
      )}
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
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
    marginTop: -4,
  },
});
