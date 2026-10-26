import { useAppTheme } from '@/hooks/useAppTheme';
import type { ShipmentStop } from '@/types/shipment';
import { type Coord, stopCoord, toCoord } from '@/utils/geo';
import { destinationStop, orderedStops, originStop, stopTitle } from '@/utils/stops';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import MapView, {
  EdgePadding,
  MapViewProps,
  Marker,
  Polyline,
  PROVIDER_GOOGLE
} from 'react-native-maps';

/*
| Android renders through Google Maps; iOS renders through Apple Maps.
|
| Passing PROVIDER_GOOGLE on iOS pulls in the Google Maps iOS SDK, which needs
| its own billed, iOS-restricted API key. Without one the map view still mounts
| but draws nothing, so the driver sees a blank rectangle where the route
| should be. `undefined` selects the platform default — MapKit — which needs no
| key and supports every marker and polyline this screen draws.
*/
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

type StopRole = 'origin' | 'stop' | 'destination';

const PIN_COLORS: Record<StopRole, string> = {
  origin: '#4A90E2',
  stop: '#F59E0B',
  destination: '#EF4444',
};

const DEFAULT_FIT_PADDING: EdgePadding = { top: 100, right: 100, bottom: 100, left: 100 };

interface TripMapViewProps extends Omit<MapViewProps, 'style'> {
  /** The load's stops, in any order. One without a usable position is left off the map. */
  stops?: ShipmentStop[] | null;
  /**
   * The driver's position, from the trip screen's own watch. The map never
   * asks for location itself: one screen asks, once, instead of three
   * components stacking prompts on top of each other.
   */
  userLocation?: Coord | null;
  /** Location access is granted and switched on, so the blue dot can be drawn. */
  locationEnabled?: boolean;
  /** A short note shown over the map without hiding it, e.g. why the driver's position is missing. */
  notice?: string | null;
  fitToRoute?: boolean;
  /** Room to leave around the route when fitting, for whatever is drawn over the map. */
  fitPadding?: EdgePadding;
  style?: ViewStyle;
}

interface PlacedStop {
  key: string;
  coordinate: Coord;
  title: string;
  description: string;
  role: StopRole;
}

export default function TripMapView({
  stops,
  userLocation: userLocationProp,
  locationEnabled = false,
  notice,
  fitToRoute = true,
  fitPadding = DEFAULT_FIT_PADDING,
  style,
  ...mapProps
}: TripMapViewProps) {
  const theme = useAppTheme();
  const mapRef = useRef<MapView>(null);

  /*
  | Fitting straight after onMapReady can land before the map has its size,
  | and Android refuses bounds on a map with none, so the camera is left
  | alone for a beat first.
  */
  const [cameraReady, setCameraReady] = useState(false);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (readyTimer.current) clearTimeout(readyTimer.current);
    },
    [],
  );
  const handleMapReady = () => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    readyTimer.current = setTimeout(() => setCameraReady(true), 300);
  };

  /*
  | Every coordinate goes through toCoord before it reaches the map. A stop
  | saved without coordinates arrives blank or as the API's "0","0"
  | stand-in: blank used to become NaN, which react-native-maps hands to the
  | native map as null and which crashed the whole app in a release build,
  | and 0,0 drew the route to the Gulf of Guinea and zoomed out to the world.
  */
  const userLocation = userLocationProp
    ? toCoord(userLocationProp.latitude, userLocationProp.longitude)
    : null;

  const placed = useMemo<PlacedStop[]>(() => {
    const ordered = orderedStops(stops);
    const first = originStop(ordered);
    const last = destinationStop(ordered);

    const result: PlacedStop[] = [];
    ordered.forEach((stop, index) => {
      const coordinate = stopCoord(stop);
      if (!coordinate) return;
      const role: StopRole = stop === first ? 'origin' : stop === last ? 'destination' : 'stop';
      result.push({
        key: String(stop.id ?? index),
        coordinate,
        title: stopTitle(stop),
        description: [`Stop ${index + 1} of ${ordered.length}`, stop.stop_type]
          .filter(Boolean)
          .join(' · '),
        role,
      });
    });
    return result;
  }, [stops]);

  const route = useMemo(() => placed.map((p) => p.coordinate), [placed]);
  const routeKey = useMemo(
    () => route.map((c) => `${c.latitude},${c.longitude}`).join('|'),
    [route],
  );

  const fittedWithFix = useRef(false);

  // An effect event: it reads the latest position without every GPS update re-fitting the camera.
  const fitCamera = useEffectEvent(() => {
    if (userLocation) fittedWithFix.current = true;

    const coords = [...route, ...(userLocation ? [userLocation] : [])];
    if (coords.length === 0) return;

    if (coords.length === 1) {
      // Bounds around a single point would zoom all the way in.
      mapRef.current?.animateToRegion(
        { ...coords[0], latitudeDelta: 0.05, longitudeDelta: 0.05 },
        500,
      );
      return;
    }

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: Math.round(fitPadding.top),
        right: Math.round(fitPadding.right),
        bottom: Math.round(fitPadding.bottom),
        left: Math.round(fitPadding.left),
      },
      animated: true,
    });
  });

  /*
  | The camera moves for the driver only when there is something new to
  | frame: the map becoming ready, the route changing (another load, or a
  | stop located since), and the first GPS fix. It used to re-fit on every
  | position update, every few seconds, undoing any pan or zoom.
  */
  useEffect(() => {
    if (cameraReady && fitToRoute) fitCamera();
  }, [cameraReady, fitToRoute, routeKey]);

  const hasFix = !!userLocation;
  useEffect(() => {
    if (cameraReady && fitToRoute && hasFix && !fittedWithFix.current) fitCamera();
  }, [cameraReady, fitToRoute, hasFix]);

  // The map reads this once, at mount; every later move is one of the fits above.
  const [initialRegion] = useState(() => {
    const coords = [...route, ...(userLocation ? [userLocation] : [])];
    return coords.length > 0
      ? {
          latitude: coords.reduce((s, c) => s + c.latitude, 0) / coords.length,
          longitude: coords.reduce((s, c) => s + c.longitude, 0) / coords.length,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }
      : {
          latitude: 20,
          longitude: 0,
          latitudeDelta: 60,
          longitudeDelta: 60,
        };
  });

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={MAP_PROVIDER}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={locationEnabled}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        toolbarEnabled={false}
        mapType="standard"
        {...mapProps}
      >
        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor={theme.primaryButton}
            strokeWidth={4}
          />
        )}

        {placed.map((p) => (
          <Marker
            key={p.key}
            coordinate={p.coordinate}
            title={p.title}
            description={p.description}
            pinColor={PIN_COLORS[p.role]}
          />
        ))}
      </MapView>

      {notice ? (
        <View style={[styles.notice, { backgroundColor: theme.card }]} pointerEvents="none">
          <MaterialCommunityIcons name="map-marker-off" size={16} color="#D97706" />
          <Text style={[styles.noticeText, { color: theme.text }]} numberOfLines={2}>
            {notice}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  // A strip, not a cover: the route and the pins stay visible behind it.
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
});
