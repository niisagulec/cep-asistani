import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function LoadingState({ text = 'Bilgiler yükleniyor...' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, text }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  state: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  empty: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.softBlue,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
});
