import { useEffect, useState, useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState, LoadingState } from '../components/ScreenStates';
import { getApiErrorMessage } from '../services/api';
import { getShuttleRoutes, peekMobileCache } from '../services/mobileService';
import { useTheme } from '../context/ThemeContext';

function shortTime(value) {
  return value?.slice(0, 5) || '--:--';
}

export function ShuttleScreen({ refreshToken = 0, onRefreshComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const cachedRoutes = peekMobileCache('shuttleRoutes');
  const [routes, setRoutes] = useState(cachedRoutes || []);
  const [loading, setLoading] = useState(cachedRoutes === null);
  const [error, setError] = useState('');

  useEffect(() => {
    getShuttleRoutes(refreshToken > 0)
      .then(setRoutes)
      .catch((requestError) => setError(getApiErrorMessage(requestError)))
      .finally(() => {
        setLoading(false);
        onRefreshComplete?.();
      });
  }, [refreshToken]);

  if (loading) return <LoadingState text="Servis güzergâhları yükleniyor..." />;
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!routes.length) {
    return <EmptyState title="Aktif servis yok" text="Henüz aktif bir servis rotası tanımlanmamış." />;
  }

  return (
    <View style={styles.list}>
      {routes.map((route) => (
        <View key={route.id} style={styles.card}>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.evening}>Akşam kalkış: {shortTime(route.evening_departure_time)}</Text>
          {(route.driver_name || route.driver_phone) && (
            <View style={styles.driverBox}>
              <Text style={styles.driverText}>Şoför: {route.driver_name || 'Belirtilmedi'}</Text>
              {!!route.driver_phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${route.driver_phone}`)}>
                  <Text style={styles.phone}>{route.driver_phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.stopList}>
            {route.stops.map((stop) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.orderCircle}>
                  <Text style={styles.orderText}>{stop.morning_order}</Text>
                </View>
                <Text style={styles.stopName}>{stop.name}</Text>
                <Text style={styles.stopTime}>{shortTime(stop.morning_time)}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  list: { gap: 14 },
  card: { padding: 19, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  routeName: { color: colors.text, fontSize: 20, fontWeight: '900' },
  evening: { color: colors.primary, fontSize: 14, fontWeight: '900', marginTop: 5 },
  driverBox: { marginTop: 13, padding: 12, borderRadius: 16, backgroundColor: colors.softBlue },
  driverText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  phone: { color: colors.primary, fontSize: 13, fontWeight: '900', marginTop: 5 },
  stopList: { marginTop: 16, gap: 10 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderCircle: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  orderText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  stopName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  stopTime: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 20 },
});
