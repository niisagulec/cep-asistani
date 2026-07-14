import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function QuickActionCard({ action, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity activeOpacity={0.82} style={styles.actionCard} onPress={onPress}>
      <Text style={styles.actionIcon}>{action.icon}</Text>
      <View style={styles.actionTextArea}>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={styles.actionDescription}>{action.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors) => StyleSheet.create({
  actionCard: {
    width: '48.2%',
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    fontSize: 25,
  },
  actionTextArea: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  actionDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
