import { useEffect, useState, useMemo } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { quickActions } from '../constants/navigation';
import { getTodayMenu, peekMobileCache } from '../services/mobileService';
import { useTheme } from '../context/ThemeContext';
import { FeedbackIcon, CafeteriaIcon, ShuttleIcon, LeaveIcon } from '../components/CustomIcons';

function getGreetingName(currentUser) {
  if (currentUser?.first_name) {
    return currentUser.first_name;
  }

  const emailPrefix = currentUser?.email?.split('@')?.[0];
  return emailPrefix || 'çalışan';
}

function getFormattedDate() {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
}

export function HomeScreen({ currentUser, onOpenModule }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const greetingName = getGreetingName(currentUser);
  const cachedMenu = peekMobileCache('todayMenu');
  const [menuItems, setMenuItems] = useState(
    cachedMenu?.items?.map((item) => item.name) || [],
  );
  const [calories, setCalories] = useState(cachedMenu?.total_calories ?? null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTodayMenu(force = false) {
    const menu = await getTodayMenu(force);
    if (menu) {
      setMenuItems(menu.items.map((item) => item.name));
      setCalories(menu.total_calories);
    }
  }

  useEffect(() => {
    let isMounted = true;

    loadTodayMenu().catch((error) => {
      if (isMounted) console.error('Yemek listesi çekilemedi:', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadTodayMenu(true);
    } catch (error) {
      console.error('Yemek listesi yenilenemedi:', error);
    } finally {
      setRefreshing(false);
    }
  }

  const renderActionIcon = (key, iconColor) => {
    if (key === 'feedback') return <FeedbackIcon color={iconColor} />;
    if (key === 'cafeteria') return <CafeteriaIcon color={iconColor} />;
    if (key === 'shuttle') return <ShuttleIcon color={iconColor} />;
    if (key === 'attendance') return <LeaveIcon color={iconColor} />;
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.homeContent}
        refreshControl={(
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Premium Header & Greeting */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.dateText}>{getFormattedDate()}</Text>
          <Text style={styles.welcomeGreeting}>Merhaba, {greetingName}!</Text>
          <View style={styles.greetingAccent} />
          <Text style={styles.welcomeSubtitle}>
            Bugün senin için hazırlanan yemek menüsü ve hızlı işlemler:
          </Text>
        </View>

        {/* Quick Actions Asymmetric Grid */}
        <Text style={styles.sectionHeader}>Hızlı İşlemler</Text>
        <View style={styles.gridContainer}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              activeOpacity={0.8}
              style={styles.gridActionCard}
              onPress={() => onOpenModule(action)}
            >
              <View style={styles.actionCardTop}>
                <View style={styles.actionIconContainer}>
                  {renderActionIcon(action.key, colors.primary)}
                </View>
                <Text style={styles.actionChevron}>→</Text>
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDesc}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Premium Food Menu Timeline Widget */}
        <Text style={styles.sectionHeader}>Mutfaktan Bugün</Text>
        <View style={styles.menuWidget}>
          <View style={styles.menuHeaderRow}>
            <Text style={styles.menuTitleText}>Günün Menüsü</Text>
            {!!calories && (
              <View style={styles.calorieBadge}>
                <Text style={styles.calorieText}>⚡ {calories} kcal</Text>
              </View>
            )}
          </View>

          {menuItems.length > 0 ? (
            <View style={styles.timelineContainer}>
              <View style={styles.timelineVerticalLine} />
              {menuItems.map((item, index) => (
                <View key={item} style={styles.timelineItem}>
                  <View style={styles.timelineDot}>
                    {renderActionIcon('cafeteria', colors.primary)}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineItemText}>{item}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyMenuText}>
              Bugünün yemek listesi henüz sisteme eklenmemiş.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  homeContent: {
    paddingBottom: 36,
  },
  welcomeBanner: {
    paddingHorizontal: 22,
    paddingTop: 32,
    paddingBottom: 18,
  },
  dateText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  welcomeGreeting: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '950',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  greetingAccent: { width: '100%', height: 4, borderRadius: 2, backgroundColor: colors.primary, marginBottom: 12 },
  welcomeSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sectionHeader: {
    marginHorizontal: 22,
    marginTop: 12,
    marginBottom: 16,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  gridContainer: {
    marginHorizontal: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  gridActionCard: {
    width: '48.1%',
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 126,
    shadowColor: '#0F172A',
    shadowOpacity: isDark ? 0.2 : 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  actionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChevron: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  actionDesc: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  menuWidget: {
    marginHorizontal: 22,
    padding: 22,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuTitleText: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  calorieBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.softBlue,
  },
  calorieText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  timelineContainer: {
    paddingLeft: 14,
    position: 'relative',
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 21,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: colors.border,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineContent: {
    marginLeft: 16,
    flex: 1,
  },
  timelineItemText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyMenuText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
