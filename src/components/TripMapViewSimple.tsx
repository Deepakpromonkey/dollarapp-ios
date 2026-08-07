import { useAppTheme } from '@/hooks/useAppTheme';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface TripMapViewSimpleProps {
  style?: ViewStyle;
}

export default function TripMapViewSimple({ style }: TripMapViewSimpleProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, style, { backgroundColor: theme.cardSecondary }]}>
      <Text style={[styles.text, { color: theme.secondaryText }]}>
        Map View
      </Text>
      <Text style={[styles.subtext]}>
        Configure Google Maps API key to see map
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
  },
});
