import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/lib/api';
import MaterialIcons from '@expo/vector-icons/build/MaterialIcons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

interface ArrivedShipperStepProps {
  onArrive: () => void;
  distanceToOrigin: number;
  canArrive: boolean;
  equipmentVerified: boolean;
  shipmentUuid?: string;
}

export default function ArrivedShipperStep({
  onArrive,
  distanceToOrigin,
  canArrive,
  equipmentVerified,
  shipmentUuid,
}: ArrivedShipperStepProps) {
  const theme = useAppTheme();
  const [submitting, setSubmitting] = useState(false);

  const handleArrive = async () => {
    if (!shipmentUuid) {
      Alert.alert('Error', 'Shipment ID missing.');
      return;
    }

    setSubmitting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Allow location access to mark arrival.');
        setSubmitting(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const payload = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      await api.post(`/shipments/${shipmentUuid}/journey/arrived-shipper`, payload);

      onArrive();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark arrival. Please try again.';
      Alert.alert('Arrival Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={[styles.stepRow, { backgroundColor: theme.primaryButton, borderRadius: 10 }]}>
        {!equipmentVerified && (
          <Pressable
            onPress={() =>
                router.push({
                    pathname: "/trip/equipment-verification",
                    params: shipmentUuid ? { uuid: shipmentUuid } : {},
                })
            }
            hitSlop={8}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <MaterialIcons
              name="verified"
              size={20}
              color="#fff"
            />
            <AppText
              variant="label1"
              style={{
                color: "#fff",
                fontWeight: "600",
              }}
            >
              Verify Equipment
            </AppText>
          </Pressable>
        )}
        
        {equipmentVerified && (
          <Pressable
            onPress={handleArrive}
            disabled={!canArrive || !equipmentVerified || submitting}
            style={{
              flex: 1,
              backgroundColor: theme.primaryButton,
              gap: 6,
              justifyContent: "center",
              alignItems: "center",
              opacity: (!canArrive || submitting) ? 0.5 : 1,
            }}
          >
            <AppText
              variant="label1"
              style={{
                color: "#fff",
                fontWeight: "600",
              }}
            >
              {submitting ? 'Marking Arrival...' : 'Arrived at Shipper'}
            </AppText>
          </Pressable>
        )}
      </View>

      {!canArrive && (
        <AppText variant="tiny" color="secondaryText" style={styles.hint}>
          Get within 500m of origin to activate this step
        </AppText>
      )}
      {canArrive && !equipmentVerified && (
        <AppText variant="tiny" color="secondaryText" style={styles.hint}>
          Complete equipment verification first
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
  stepRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
  },
  stepNumBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineBtn: {
    paddingHorizontal: 20,
    paddingVertical: 0,
    minHeight: 34,
  },
  doneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
  },
  button: {
    marginTop: 4,
  },
  hint: {
    textAlign: 'center',
    marginTop: -4,
  },
});

