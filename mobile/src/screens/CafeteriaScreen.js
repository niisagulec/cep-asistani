import { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState, LoadingState } from '../components/ScreenStates';
import { getApiErrorMessage } from '../services/api';
import { getWeeklyMenu, peekMobileCache } from '../services/mobileService';
import { useTheme } from '../context/ThemeContext';

function formatDate(value) {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(`${value}T12:00:00`));
}

function getMonday(value = new Date()) {
  const date = new Date(value);
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  date.setDate(date.getDate() - dayIndex);
  return date;
}

function toYmdString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekRange(monday) {
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  
  const mondayStr = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(monday);
  const fridayStr = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(friday);
  return `${mondayStr} - ${fridayStr}`;
}

export function CafeteriaScreen({ refreshToken = 0, onRefreshComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [selectedMonday, setSelectedMonday] = useState(() => getMonday(new Date()));
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentMondayYmd = toYmdString(getMonday(new Date()));
  const selectedMondayYmd = toYmdString(selectedMonday);
  const isCurrentWeek = selectedMondayYmd === currentMondayYmd;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    getWeeklyMenu(selectedMondayYmd, refreshToken > 0)
      .then((data) => {
        if (isMounted) {
          setMenus(data || []);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          onRefreshComplete?.();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMondayYmd, refreshToken]);

  const handlePrevWeek = () => {
    const nextDate = new Date(selectedMonday);
    nextDate.setDate(nextDate.getDate() - 7);
    setSelectedMonday(nextDate);
  };

  const handleNextWeek = () => {
    const nextDate = new Date(selectedMonday);
    nextDate.setDate(nextDate.getDate() + 7);
    setSelectedMonday(nextDate);
  };

  const handleResetWeek = () => {
    setSelectedMonday(getMonday(new Date()));
  };

  return (
    <View style={styles.container}>
      {/* Premium Week Selector Header */}
      <View style={styles.weekSelector}>
        <TouchableOpacity activeOpacity={0.7} style={styles.arrowButton} onPress={handlePrevWeek}>
          <Text style={styles.arrowText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.weekLabelContainer}>
          <Text style={styles.weekRangeText}>{formatWeekRange(selectedMonday)}</Text>
          {!isCurrentWeek && (
            <TouchableOpacity activeOpacity={0.7} style={styles.todayBadge} onPress={handleResetWeek}>
              <Text style={styles.todayBadgeText}>Bu Hafta</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity activeOpacity={0.7} style={styles.arrowButton} onPress={handleNextWeek}>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState text="Menü yükleniyor..." />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !menus.length ? (
        <EmptyState title="Menü bulunamadı" text="Seçilen hafta için henüz menü girilmemiş." />
      ) : (
        <View style={styles.list}>
          {menus.map((menu) => (
            <View key={menu.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{formatDate(menu.menu_date)}</Text>
                {menu.total_calories != null && (
                  <View style={styles.calorieBadge}>
                    <Text style={styles.calories}>{menu.total_calories} kcal</Text>
                  </View>
                )}
              </View>
              {menu.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.dot} />
                  <Text style={styles.itemText}>{item.name}</Text>
                </View>
              ))}
              {!!menu.note && <Text style={styles.note}>{menu.note}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 12,
    marginBottom: 16,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  weekLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekRangeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  list: { gap: 12 },
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  date: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900', textTransform: 'capitalize' },
  calorieBadge: {
    borderRadius: 14,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  calories: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  itemText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  note: { marginTop: 8, color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 20 },
});
