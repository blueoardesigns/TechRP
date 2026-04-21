import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function PlaybooksLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceAlt },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Playbooks & Training Materials' }} />
    </Stack>
  );
}
