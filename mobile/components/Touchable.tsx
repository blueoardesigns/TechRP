import { Platform, Pressable, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

interface Props {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  rippleColor?: string;
  rippleBorderless?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

// Android: Pressable with Material ripple. iOS: opacity feedback.
export function Touchable({
  onPress,
  style,
  rippleColor = colors.accentGlow,
  rippleBorderless = false,
  disabled,
  children,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={
        Platform.OS === 'android'
          ? { color: rippleColor, borderless: rippleBorderless }
          : undefined
      }
      style={({ pressed }) => [
        style,
        Platform.OS !== 'android' && pressed && { opacity: 0.72 },
      ]}
    >
      {children}
    </Pressable>
  );
}
