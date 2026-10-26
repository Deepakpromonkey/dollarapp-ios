import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import MaterialIcons from '@expo/vector-icons/build/MaterialIcons';
import * as Location from 'expo-location';
import {
  ensureForegroundLocation,
  getPositionWithin,
  NO_POSITION_MESSAGE,
  type LocationAccess,
} from '@/utils/currentPosition';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

/*
| Why arrival could not use the driver's location. A refused permission is
| final (App Review 5.1.1(iv)): static text and a Settings button the driver
| can use or ignore, never an alert or an automatic trip to Settings.
*/
const LOCATION_ISSUE_TEXT: Record<Exclude<LocationAccess, 'ok'>, string> = {
  denied: 'Location access is required to mark arrival. Enable it in Settings to continue.',
  services_off: 'Location Services are off. Turn them on in Settings to mark arrival.',
};

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
  const [locationIssue, setLocationIssue] = useState<Exclude<LocationAccess, 'ok'> | null>(null);

  const handleArrive = async () => {
    if (!shipmentUuid) {
      Alert.alert('Error', 'Shipment ID missing.');
      return;
    }

    setSubmitting(true);
    setLocationIssue(null);
    try {
      // Asks only when needed, and never for "Always": one fix is all this takes.
      const access = await ensureForegroundLocation();
      if (access !== 'ok') {
        setLocationIssue(access);
        return;
      }

      const location = await getPositionWithin(Location.Accuracy.High);
      if (!location) {
        throw new Error(NO_POSITION_MESSAGE);
      }

      const payload = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      await api.post(`/shipments/${shipmentUuid}/journey/arrived-shipper`, payload);

      onArrive();
      invalidate('trip', 'shipments');
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
                    // Shown only for a load My Trip already knows is activated.
                    params: shipmentUuid ? { uuid: shipmentUuid, activated: "1" } : {},
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

      {/* Equipment can be photographed anywhere; only arriving needs the 500 m. */}
      {!equipmentVerified ? (
        <AppText variant="tiny" color="secondaryText" style={styles.hint}>
          Complete equipment verification first
        </AppText>
      ) : !canArrive ? (
        <AppText variant="tiny" color="secondaryText" style={styles.hint}>
          Get within 500m of origin to activate this step
        </AppText>
      ) : null}

      {locationIssue ? (
        <View style={styles.locationIssue}>
          <AppText variant="caption" style={{ color: theme.err }}>
            {LOCATION_ISSUE_TEXT[locationIssue]}
          </AppText>
          <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
            <AppText variant="caption" style={{ color: theme.primaryButton, fontWeight: '600' }}>
              Open Settings
            </AppText>
          </Pressable>
        </View>
      ) : null}
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
  locationIssue: {
    alignItems: 'center',
    gap: 6,
  },
});

