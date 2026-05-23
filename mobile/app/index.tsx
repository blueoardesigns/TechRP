import { View } from 'react-native';
import { colors } from '../lib/theme';

// The root layout's AuthGate handles all routing:
//   - logged in  → /(tabs)/train
//   - logged out → /(auth)/login
// This screen renders only briefly during the auth check.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
