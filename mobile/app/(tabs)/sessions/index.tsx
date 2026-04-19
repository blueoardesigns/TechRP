import { View, Text } from 'react-native';
import { colors } from '../../../lib/theme';

export default function SessionsPlaceholder() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted }}>Sessions coming soon</Text>
    </View>
  );
}
