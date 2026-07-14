import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { HomeIcon, DiscoverIcon, ProfileIcon } from './CustomIcons';

export function BottomTabBar({ tabs, activeTab, onTabPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const renderTabIcon = (tabKey, isActive) => {
    const iconColor = isActive ? colors.primary : colors.muted;
    if (tabKey === 'home') return <HomeIcon color={iconColor} />;
    if (tabKey === 'discover') return <DiscoverIcon color={iconColor} />;
    if (tabKey === 'profile') return <ProfileIcon color={iconColor} />;
    return null;
  };

  return (
    <View style={styles.bottomBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.75}
            onPress={() => onTabPress(tab.key)}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
          >
            <View style={styles.tabIconWrapper}>
              {renderTabIcon(tab.key, isActive)}
            </View>
            <Text style={[styles.bottomTabText, isActive && styles.bottomTabTextActive]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  bottomBar: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomTab: {
    flex: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomTabActive: {
    backgroundColor: colors.softBlue,
  },
  tabIconWrapper: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bottomTabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  bottomTabTextActive: {
    color: colors.primary,
  },
});
