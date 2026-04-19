import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function TrainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceAlt },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
