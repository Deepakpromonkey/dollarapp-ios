import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { StyleSheet, View } from 'react-native';
import { TripWaypoint } from '../TripMapView';

interface TripCardProps {
  origin: TripWaypoint;
  destination: TripWaypoint;
  shipment?: any; // Added this to accept your dynamic Laravel data
}

export default function TripCard({
  origin,
  destination,
  shipment,
}: TripCardProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      {/* 1. The Route Map Header */}
      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <AppText variant="caption" color="secondaryText">ORIGIN</AppText>
          <AppText variant="label" style={{ color: theme.text }}>{origin.title}</AppText>
        </View>

        <View style={styles.routeMiddle}>
          <View style={[styles.routeLine, { backgroundColor: theme.cardSecondary }]} />
          <View style={[styles.transitBadge, { backgroundColor: theme.primaryButton + '18' }]}>
            <AppText variant="tiny" style={{ color: theme.primaryButton, fontWeight: '600' }}>
               IN TRANSIT
            </AppText>
          </View>
          <View style={[styles.routeLine, { backgroundColor: theme.cardSecondary }]} />
        </View>

        <View style={styles.routePoint}>
          <AppText variant="caption" color="secondaryText" style={{ textAlign: 'right' }}>DEST</AppText>
          <AppText variant="label" style={{ color: theme.text, textAlign: 'right' }}>{destination.title}</AppText>
        </View>
      </View>

      {/* 2. Divider Line */}
      <View style={[styles.divider, { backgroundColor: theme.cardSecondary }]} />

      {/* 3. The Dynamic Shipment Data Section */}
      <View style={styles.statsRow}>
        <View style={[styles.stat, { alignItems: 'flex-start' }]}>
          <AppText variant="caption" color="secondaryText">PRO NO.</AppText>
          <AppText variant="label" style={{ color: theme.text }}>
            {shipment?.pro_number ?? '-nAn-'}
          </AppText>
        </View>

        <View style={[styles.stat, { alignItems: 'center' }]}>
          <AppText variant="caption" color="secondaryText">TRUCK / TRL</AppText>
          <AppText variant="label" style={{ color: theme.text }}>
            {shipment?.truck_number ?? '--'} / {shipment?.trailer_number ?? '--'}
          </AppText>
        </View>

        <View style={[styles.stat, { alignItems: 'flex-end' }]}>
           <AppText variant="caption" color="secondaryText">CARRIER</AppText>
           <AppText variant="label" style={{ color: theme.text }} numberOfLines={1}>
             {shipment?.carrier_name ?? '--'}
           </AppText>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 14,
    gap: 12, // Increased gap slightly for better breathing room
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePoint: {
    flex: 1,
    gap: 2,
  },
  routeMiddle: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeLine: {
    flex: 1,
    height: 1.5,
  },
  transitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    gap: 2,
  },
});