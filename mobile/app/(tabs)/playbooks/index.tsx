import { View, Text } from 'react-native';
import { colors } from '../../../lib/theme';

export default function PlaybooksPlaceholder() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted }}>Playbooks coming soon</Text>
    </View>
  );
}
