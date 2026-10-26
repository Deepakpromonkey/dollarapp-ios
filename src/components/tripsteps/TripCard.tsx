import AppText from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { Shipment, ShipmentStop } from '@/types/shipment';
import { stopSubtitle, stopTitle } from '@/utils/stops';
import type { TripBadge } from '@/utils/tripStatus';
import { StyleSheet, View } from 'react-native';

interface TripCardProps {
  /** The first pickup (or first stop). */
  origin?: ShipmentStop;
  /** The final delivery (or last stop). */
  destination?: ShipmentStop;
  /** How many stops the load has, so the ones in between can be counted. */
  stopCount: number;
  badge: TripBadge;
  shipment?: Shipment | null;
}

/*
| Drawn from the stops themselves, not from map waypoints. A stop without
| coordinates cannot go on the map, but it still has a name, and gating this
| card on coordinates used to hide it, PRO, truck and carrier included,
| whenever one stop had not been located.
*/
export default function TripCard({
  origin,
  destination,
  stopCount,
  badge,
  shipment,
}: TripCardProps) {
  const theme = useAppTheme();

  const badgeColor =
    badge.tone === 'success' ? '#16A34A' : badge.tone === 'neutral' ? theme.secondaryText : theme.primaryButton;

  const between = Math.max(0, stopCount - 2);
  const originSubtitle = stopSubtitle(origin);
  const destinationSubtitle = stopSubtitle(destination);

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      {/* 1. The Route Map Header */}
      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <AppText variant="caption" color="secondaryText">ORIGIN</AppText>
          <AppText variant="label" style={{ color: theme.text }} numberOfLines={1}>
            {stopTitle(origin)}
          </AppText>
          {originSubtitle ? (
            <AppText variant="tiny" color="secondaryText" numberOfLines={1}>
              {originSubtitle}
            </AppText>
          ) : null}
        </View>

        <View style={styles.routeMiddle}>
          <View style={styles.badgeRow}>
            <View style={[styles.routeLine, { backgroundColor: theme.cardSecondary }]} />
            <View style={[styles.transitBadge, { backgroundColor: badgeColor + '18' }]}>
              <AppText variant="tiny" style={{ color: badgeColor, fontWeight: '600' }}>
                {badge.label}
              </AppText>
            </View>
            <View style={[styles.routeLine, { backgroundColor: theme.cardSecondary }]} />
          </View>
          {between > 0 ? (
            <AppText variant="tiny" color="secondaryText">
              +{between} {between === 1 ? 'stop' : 'stops'}
            </AppText>
          ) : null}
        </View>

        <View style={styles.routePoint}>
          <AppText variant="caption" color="secondaryText" style={{ textAlign: 'right' }}>DEST</AppText>
          <AppText variant="label" style={{ color: theme.text, textAlign: 'right' }} numberOfLines={1}>
            {stopTitle(destination)}
          </AppText>
          {destinationSubtitle ? (
            <AppText variant="tiny" color="secondaryText" style={{ textAlign: 'right' }} numberOfLines={1}>
              {destinationSubtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* 2. Divider Line */}
      <View style={[styles.divider, { backgroundColor: theme.cardSecondary }]} />

      {/* 3. The Dynamic Shipment Data Section */}
      <View style={styles.statsRow}>
        <View style={[styles.stat, { alignItems: 'flex-start' }]}>
          <AppText variant="caption" color="secondaryText">PRO NO.</AppText>
          <AppText variant="label" style={{ color: theme.text }} numberOfLines={1}>
            {shipment?.pro_number || '--'}
          </AppText>
        </View>

        <View style={[styles.stat, { alignItems: 'center' }]}>
          <AppText variant="caption" color="secondaryText">TRUCK / TRL</AppText>
          <AppText variant="label" style={{ color: theme.text }} numberOfLines={1}>
            {shipment?.truck_number || '--'} / {shipment?.trailer_number || '--'}
          </AppText>
        </View>

        <View style={[styles.stat, { alignItems: 'flex-end' }]}>
           <AppText variant="caption" color="secondaryText">CARRIER</AppText>
           <AppText variant="label" style={{ color: theme.text }} numberOfLines={1}>
             {shipment?.carrier_name || '--'}
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
  // minWidth 0 lets a long name truncate instead of pushing the pill aside.
  routePoint: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  routeMiddle: {
    flexShrink: 0,
    alignItems: 'center',
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeLine: {
    width: 12,
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
    gap: 8,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
