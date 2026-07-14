import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ModuleCard } from '../components/ModuleCard';
import { useTheme } from '../context/ThemeContext';

export function DiscoverScreen({ modules, searchText, onSearchTextChange, onOpenModule }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageEyebrow}>KEŞFET</Text>
        <Text style={styles.pageTitle}>Hizmetler</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={onSearchTextChange}
            placeholder="Ara..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.moduleList}>
          {modules.map((module) => (
            <ModuleCard
              key={module.key}
              module={module}
              onPress={() => onOpenModule(module)}
            />
          ))}
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
    paddingTop: 24,
    paddingBottom: 24,
  },
  pageEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 10,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
    marginBottom: 18,
  },
  searchBox: {
    height: 56,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  moduleList: {
    gap: 12,
  },
});
