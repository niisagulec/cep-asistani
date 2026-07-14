import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function MenuCard({ items, calories }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const hasItems = items.length > 0;

  return (
    <View style={styles.menuCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.eyebrow}>GÜNÜN MENÜSÜ</Text>
          <Text style={styles.cardTitle}>Bugünkü yemek listesi</Text>
        </View>

        {!!calories && (
          <View style={styles.calorieBadge}>
            <Text style={styles.calorieText}>{calories} kcal</Text>
          </View>
        )}
      </View>

      <View style={styles.menuList}>
        {hasItems ? (
          items.map((item) => (
            <View key={item} style={styles.menuItem}>
              <View style={styles.menuDot} />
              <Text style={styles.menuText}>{item}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyMenuText}>
            Bugünün menüsü henüz yüklenmedi.
          </Text>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  menuCard: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 26,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  calorieBadge: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  menuList: {
    marginTop: 18,
    gap: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.purple,
  },
  menuText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyMenuText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
});
