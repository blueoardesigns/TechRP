import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { colors } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceAlt,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="train"
        options={{ title: 'Train', tabBarIcon: () => null, tabBarLabel: '🎙️  Train' }}
      />
      <Tabs.Screen
        name="sessions"
        options={{ title: 'Sessions', tabBarIcon: () => null, tabBarLabel: '📋  Sessions' }}
      />
      <Tabs.Screen
        name="playbooks"
        options={{ title: 'Playbooks', tabBarIcon: () => null, tabBarLabel: '📖  Playbooks' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Account', tabBarIcon: () => null, tabBarLabel: '👤  Account' }}
      />
    </Tabs>
  );
}
