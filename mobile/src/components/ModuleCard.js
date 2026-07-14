import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { FeedbackIcon, CafeteriaIcon, ShuttleIcon, LeaveIcon, ShiftIcon } from './CustomIcons';

export function ModuleCard({ module, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const renderModuleIcon = (key, iconColor) => {
    if (key === 'feedback') return <FeedbackIcon color={iconColor} />;
    if (key === 'cafeteria') return <CafeteriaIcon color={iconColor} />;
    if (key === 'shuttle') return <ShuttleIcon color={iconColor} />;
    if (key === 'leave' || key === 'attendance') return <LeaveIcon color={iconColor} />;
    if (key === 'shifts') return <ShiftIcon color={iconColor} />;
    return null;
  };

  return (
    <TouchableOpacity activeOpacity={0.82} style={styles.moduleCard} onPress={onPress}>
      <View style={styles.moduleIcon}>
        {renderModuleIcon(module.key, colors.primary)}
      </View>
      <View style={styles.moduleTextBlock}>
        <Text style={styles.moduleTitle}>{module.title}</Text>
        <Text style={styles.moduleDescription}>{module.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors) => StyleSheet.create({
  moduleCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  moduleIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTextBlock: {
    flex: 1,
  },
  moduleTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 5,
  },
  moduleDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
