import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import AnimatedSplash from './src/components/AnimatedSplash';
import DashboardScreen from './src/screens/DashboardScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS } from './src/theme';

// Keep the native splash visible until our animated JS splash mounts, so there's
// no white flash between them. AnimatedSplash calls hideAsync() once it renders.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard: 'grid',
  Analytics: 'bar-chart-2',
  Settings: 'sliders',
};

// Rendered inside SafeAreaProvider so it can read the device's safe-area insets.
// The bottom inset (home indicator on iOS, gesture/nav bar on Android) is added
// to the tab bar height + padding so the tab labels are never hidden behind the
// system navigation area.
function AppTabs() {
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color }) => (
            <Feather name={TAB_ICONS[route.name]} size={20} color={color} />
          ),
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.text3,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 60 + insets.bottom,
              paddingBottom: insets.bottom + 6,
            },
          ],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" backgroundColor={COLORS.surface} />
        <AppTabs />
        {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabItem: {
    paddingVertical: 4,
  },
});
