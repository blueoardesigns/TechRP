import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceAlt,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tabs.Screen name="train" options={{ title: 'Train', tabBarIcon: () => null, tabBarLabel: '🎙️  Train' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarIcon: () => null, tabBarLabel: '📋  Sessions' }} />
      <Tabs.Screen name="playbooks" options={{ title: 'Playbooks', tabBarIcon: () => null, tabBarLabel: '📖  Playbooks' }} />
    </Tabs>
  );
}
