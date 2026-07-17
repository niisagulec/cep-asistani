import { useMemo, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CafeteriaScreen } from './CafeteriaScreen';
import { AttendanceScreen } from './AttendanceScreen';
import { FeedbackScreen } from './FeedbackScreen';
import { LeaveScreen } from './LeaveScreen';
import { ShuttleScreen } from './ShuttleScreen';
import { NotificationScreen } from './NotificationScreen';
import { useTheme } from '../context/ThemeContext';
import { FeedbackIcon, CafeteriaIcon, ShuttleIcon, LeaveIcon, ShiftIcon, BellIcon } from '../components/CustomIcons';
import { modules } from '../constants/navigation';

function formatShiftTime(value) {
  return value ? value.slice(0, 5) : '--:--';
}

function ModuleContent({ module, currentUser, refreshToken, onRefreshComplete, onBack, onOpenModule }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (module.key === 'cafeteria') return <CafeteriaScreen refreshToken={refreshToken} onRefreshComplete={onRefreshComplete} />;
  if (module.key === 'shuttle') return <ShuttleScreen refreshToken={refreshToken} onRefreshComplete={onRefreshComplete} />;
  if (module.key === 'feedback') return <FeedbackScreen refreshToken={refreshToken} onRefreshComplete={onRefreshComplete} module={module} />;
  if (module.key === 'attendance') return <AttendanceScreen refreshToken={refreshToken} onRefreshComplete={onRefreshComplete} module={module} />;
  if (module.key === 'leave') {
    return <LeaveScreen currentUser={currentUser} refreshToken={refreshToken} onRefreshComplete={onRefreshComplete} module={module} />;
  }
  if (module.key === 'shifts') {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoEyebrow}>AKTİF VARDİYAN</Text>
        <Text style={styles.infoTitle}>{currentUser?.shift_name || 'Vardiya atanmamış'}</Text>
        {currentUser?.shift_name ? (
          <View style={styles.shiftTimeCard}>
            <Text style={styles.shiftTimeLabel}>Çalışma saatleri</Text>
            <Text style={styles.shiftTimeValue}>
              {formatShiftTime(currentUser.shift_start_time)} – {formatShiftTime(currentUser.shift_end_time)}
            </Text>
          </View>
        ) : (
          <Text style={styles.infoText}>Henüz hesabına tanımlanmış bir vardiya bulunmuyor.</Text>
        )}
      </View>
    );
  }
  if (module.key === 'notifications') {
    return (
      <NotificationScreen
        currentUser={currentUser}
        onNavigate={(screen, targetId) => {
          const screenToModuleKey = {
            leave: 'leave',
            attendance: 'attendance',
            feedback: 'feedback',
            shifts: 'shifts',
          };
          const moduleKey = screenToModuleKey[screen];
          if (moduleKey && onOpenModule) {
            const targetModule = modules.find((m) => m.key === moduleKey);
            if (targetModule) {
              onOpenModule({ ...targetModule, targetId });
            }
          }
        }}
        onRefreshComplete={onRefreshComplete}
      />
    );
  }
  return null;
}

export function ModuleScreen({ module, currentUser, onBack, onOpenModule }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleRefresh() {
    setRefreshing(true);
    if (module.key === 'shifts') {
      setRefreshing(false);
      return;
    }
    setRefreshToken((current) => current + 1);
  }

  const renderHeaderIcon = (key, iconColor) => {
    if (key === 'feedback') return <FeedbackIcon color={iconColor} />;
    if (key === 'cafeteria') return <CafeteriaIcon color={iconColor} />;
    if (key === 'shuttle') return <ShuttleIcon color={iconColor} />;
    if (key === 'leave' || key === 'attendance') return <LeaveIcon color={iconColor} />;
    if (key === 'shifts') return <ShiftIcon color={iconColor} />;
    if (key === 'notifications') return <BellIcon color={iconColor} />;
    return null;
  };

  if (module.key === 'notifications') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.headerRow, { paddingHorizontal: 18, paddingTop: 12 }]}>
          <TouchableOpacity activeOpacity={0.75} style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Geri</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <View style={styles.iconWrapper}>
              {renderHeaderIcon(module.key, colors.primary)}
            </View>
            <Text style={styles.headerTitle}>{module.title}</Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ModuleContent
            module={module}
            currentUser={currentUser}
            onRefreshComplete={() => setRefreshing(false)}
            refreshToken={refreshToken}
            onBack={onBack}
            onOpenModule={onOpenModule}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
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
        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.75} style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Geri</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <View style={styles.iconWrapper}>
              {renderHeaderIcon(module.key, colors.primary)}
            </View>
            <Text style={styles.headerTitle}>{module.title}</Text>
          </View>
        </View>

        <View style={styles.moduleContent}>
          <ModuleContent
            module={module}
            currentUser={currentUser}
            onRefreshComplete={() => setRefreshing(false)}
            refreshToken={refreshToken}
            onBack={onBack}
            onOpenModule={onOpenModule}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 48,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 6,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '950',
    letterSpacing: -0.5,
  },
  infoCard: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  infoEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  infoText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 23,
  },
  shiftTimeCard: { marginTop: 10, padding: 18, borderRadius: 20, backgroundColor: colors.softBlue, borderWidth: 1, borderColor: colors.border },
  shiftTimeLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  shiftTimeValue: { color: colors.primary, fontSize: 27, fontWeight: '900', letterSpacing: 0.5, marginTop: 6 },
  moduleContent: {
    marginTop: 6,
  },
});
