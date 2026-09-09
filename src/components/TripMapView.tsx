import { useAppTheme } from '@/hooks/useAppTheme';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import MapView, {
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


export interface TripWaypoint {
  latitude: number;
  longitude: number;
  title?: string;
}

interface TripMapViewProps extends Omit<MapViewProps, 'style'> {
  route?: TripWaypoint[];
  origin?: TripWaypoint;
  destination?: TripWaypoint;
  currentPosition?: TripWaypoint;
  showUserLocation?: boolean;
  fitToRoute?: boolean;
  style?: ViewStyle;
}


export default function TripMapView({
  route = [],
  origin,
  destination,
  currentPosition: currentPositionProp,
  showUserLocation = true,
  fitToRoute = true,
  style,
  ...mapProps
}: TripMapViewProps) {
  const theme = useAppTheme();
  const mapRef = useRef<MapView>(null);

  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [userLocation, setUserLocation] =
    useState<TripWaypoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const currentPosition = currentPositionProp ?? userLocation;

  useEffect(() => {
    if (!showUserLocation) return;

    let subscriber: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status, canAskAgain: askable } =
          await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        setCanAskAgain(askable);

        if (status !== Location.PermissionStatus.GRANTED) {
          setLocationError('Location permission denied');
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        });

        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (loc) => {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      } catch (err) {
        setLocationError('Could not get location');
      }
    })();

    return () => {
      subscriber?.remove();
    };
  }, [showUserLocation]);

  const allCoords: TripWaypoint[] = [
    ...(origin ? [origin] : []),
    ...route,
    ...(destination ? [destination] : []),
    ...(currentPosition ? [currentPosition] : []),
  ];

  const handleMapReady = () => {
    setMapReady(true);
    if (!fitToRoute || allCoords.length < 2) {
      return;
    }
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }, 500);
  };

  useEffect(() => {
    if (!mapReady || !fitToRoute || !userLocation) return;
    const coords: TripWaypoint[] = [
      ...(origin ? [origin] : []),
      ...route,
      ...(destination ? [destination] : []),
      userLocation,
    ];
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }, [userLocation?.latitude, userLocation?.longitude, mapReady]);

  const initialRegion =
    allCoords.length > 0
      ? {
          latitude:
            allCoords.reduce((s, c) => s + c.latitude, 0) / allCoords.length,
          longitude:
            allCoords.reduce((s, c) => s + c.longitude, 0) / allCoords.length,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }
      : {
          latitude: 20,
          longitude: 0,
          latitudeDelta: 60,
          longitudeDelta: 60,
        };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={MAP_PROVIDER}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        showsUserLocation={
          showUserLocation &&
          permissionStatus === Location.PermissionStatus.GRANTED
        }
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

        {origin && (
          <Marker 
            coordinate={origin} 
            title={origin.title}
            pinColor="#4A90E2"
          />
        )}

        {destination && (
          <Marker 
            coordinate={destination} 
            title={destination.title}
            pinColor="#EF4444"
          />
        )}

        {currentPositionProp && (
          <Marker
            coordinate={currentPositionProp}
            title="Current Position"
            pinColor="#10B981"
          />
        )}
      </MapView>

      {showUserLocation &&
        permissionStatus === Location.PermissionStatus.GRANTED &&
        !userLocation && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={theme.primaryButton} size="small" />
          </View>
        )}

      {locationError && (
        <View style={[styles.permissionOverlay, { backgroundColor: theme.card }]}>
          <Text style={styles.permissionIcon}>📍</Text>
          <Text style={[styles.permissionTitle, { color: theme.text }]}>
            {canAskAgain ? 'Location Access Needed' : 'Location Access Blocked'}
          </Text>
          <Text style={[styles.permissionDesc, { color: theme.secondaryText }]}>
            {canAskAgain
              ? 'Allow location access to show your position on the map.'
              : 'Location access was permanently denied. Enable it from Settings to see your position on the map.'}
          </Text>
          <Pressable
            onPress={
              canAskAgain
                ? async () => {
                    const { status, canAskAgain: askable } =
                      await Location.requestForegroundPermissionsAsync();
                    setPermissionStatus(status);
                    setCanAskAgain(askable);
                    if (status === Location.PermissionStatus.GRANTED) {
                      setLocationError(null);
                    }
                  }
                : () => Linking.openSettings()
            }
            style={({ pressed }: { pressed: boolean }) => [
              styles.permissionBtn,
              { backgroundColor: theme.primaryButton, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={styles.permissionBtnText}>
              {canAskAgain ? 'Grant Location Access' : 'Open Settings'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function TruckDot({ color }: { color: string }) {
  return (
    <View
      style={[
        styles.truckDot,
        { borderColor: color, backgroundColor: `${color}33` },
      ]}
    >
      <View style={[styles.truckInner, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  truckDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  truckInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  callout: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutText: {
    fontSize: 12,
    fontWeight: '500',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  errorText: {
    fontSize: 12,
  },
  permissionOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 12,
    zIndex: 10,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  permissionBtn: {
    marginTop: 8,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
