import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabBar } from './src/components/BottomTabBar';
import { bottomTabs, modules } from './src/constants/navigation';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ForcePasswordChangeScreen } from './src/screens/ForcePasswordChangeScreen';
import { ModuleScreen } from './src/screens/ModuleScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { getCurrentUser, logout } from './src/services/authService';
import { clearMobileCache, prefetchMobileData } from './src/services/mobileService';
import { clearAccessToken, getAccessToken } from './src/services/tokenStorage';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [searchText, setSearchText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);
  const screenTransition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const token = await getAccessToken();

        if (!token) {
          return;
        }

        const user = await getCurrentUser();

        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        await clearAccessToken();
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser && !currentUser.must_change_password) {
      prefetchMobileData();
    }
  }, [currentUser]);

  const filteredModules = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('tr-TR');

    if (!query) {
      return modules;
    }

    return modules.filter((module) => {
      const searchableText = `${module.title} ${module.description}`.toLocaleLowerCase('tr-TR');
      return searchableText.includes(query);
    });
  }, [searchText]);

  async function handleLogout() {
    await logout();
    clearMobileCache();
    setCurrentUser(null);
    setActiveTab('home');
    setSearchText('');
    setSelectedModule(null);
  }

  async function refreshCurrentUser() {
    try {
      const updatedUser = await getCurrentUser();
      setCurrentUser((current) => {
        if (JSON.stringify(current) === JSON.stringify(updatedUser)) return current;
        return updatedUser;
      });
    } catch {
      // Ekran geçişini ağ hatası nedeniyle engelleme; mevcut oturum verisi kullanılır.
    }
  }

  function animateScreenChange(changeScreen) {
    screenTransition.stopAnimation();
    screenTransition.setValue(0);
    requestAnimationFrame(changeScreen);
  }

  function handleTabPress(tabKey) {
    if (!selectedModule && activeTab === tabKey) {
      if (tabKey === 'profile') refreshCurrentUser();
      return;
    }
    const changeTab = () => {
      setSelectedModule(null);
      setActiveTab(tabKey);
    };
    if (selectedModule) animateScreenChange(changeTab);
    else requestAnimationFrame(changeTab);
    if (tabKey === 'profile') refreshCurrentUser();
  }

  function handleOpenModule(module) {
    animateScreenChange(() => setSelectedModule(module));
    if (module.key === 'leave' || module.key === 'shifts') refreshCurrentUser();
  }

  const activeScreenKey = selectedModule?.key || 'main-tabs';

  useEffect(() => {
    screenTransition.setValue(0);
    Animated.timing(screenTransition, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeScreenKey, screenTransition]);

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (isSessionLoading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.loadingText}>Oturum kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoginScreen
          onLoginSuccess={({ currentUser: loggedInUser }) => {
            setCurrentUser(loggedInUser);
            setActiveTab('home');
            setSelectedModule(null);
          }}
        />
      </>
    );
  }

  if (currentUser.must_change_password) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ForcePasswordChangeScreen
          onPasswordChanged={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
          onLogout={handleLogout}
        />
      </>
    );
  }

  return (
    <View style={styles.appShell}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Animated.View
        style={[
          styles.activeScreen,
          {
            opacity: screenTransition,
            transform: [{
              translateY: screenTransition.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            }],
          },
        ]}
      >
        {selectedModule ? (
          <ModuleScreen
            key={selectedModule.key}
            module={selectedModule}
            currentUser={currentUser}
            onBack={() => animateScreenChange(() => setSelectedModule(null))}
          />
        ) : null}
        <View style={[styles.tabScreen, (selectedModule || activeTab !== 'home') && styles.hiddenTab]}>
          <HomeScreen currentUser={currentUser} onOpenModule={handleOpenModule} />
        </View>
        <View style={[styles.tabScreen, (selectedModule || activeTab !== 'discover') && styles.hiddenTab]}>
          <DiscoverScreen
            modules={filteredModules}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            onOpenModule={handleOpenModule}
          />
        </View>
        <View style={[styles.tabScreen, (selectedModule || activeTab !== 'profile') && styles.hiddenTab]}>
          <ProfileScreen currentUser={currentUser} onLogout={handleLogout} />
        </View>
      </Animated.View>

      <BottomTabBar tabs={bottomTabs} activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  activeScreen: {
    flex: 1,
  },
  tabScreen: {
    flex: 1,
  },
  hiddenTab: {
    display: 'none',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    gap: 14,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
