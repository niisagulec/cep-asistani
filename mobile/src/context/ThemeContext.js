import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../constants/colors';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@cep_asistani_theme_mode';

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' or 'dark'
  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'
  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode) {
          setThemeMode(storedMode);
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      }
    }
    loadStoredTheme();
  }, []);

  async function updateThemeMode(newMode) {
    try {
      setThemeMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  }

  // Determine actual theme ('light' or 'dark')
  const actualTheme = themeMode === 'system' ? (systemScheme || 'light') : themeMode;
  const isDark = actualTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  function toggleTheme() {
    const nextMode = isDark ? 'light' : 'dark';
    updateThemeMode(nextMode);
  }

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode: updateThemeMode,
        isDark,
        colors,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
