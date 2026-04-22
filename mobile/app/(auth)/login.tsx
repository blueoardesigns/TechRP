import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../lib/theme';

const SIGNUP_URL = `${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://techrp.com'}/signup`;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
    }
    // On success, root layout auth gate redirects to /(tabs)/train automatically
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo / wordmark */}
        <View style={styles.logoBlock}>
          <Text style={styles.logoIcon}>🎙️</Text>
          <Text style={styles.title}>TechRP</Text>
          <Text style={styles.subtitle}>Voice AI Training Platform</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing In…' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign up CTA */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => Linking.openURL(SIGNUP_URL)}>
            <Text style={styles.link}>Sign up at techrp.com</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },

  // Logo
  logoBlock: { alignItems: 'center', gap: spacing.sm },
  logoIcon: { fontSize: 48, marginBottom: spacing.xs },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Form
  form: { gap: spacing.sm },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  forgotButton: { alignSelf: 'center', paddingVertical: spacing.sm },
  link: { color: colors.accentLight, fontSize: 14, fontWeight: '500' },

  // Sign up row
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  signupText: { color: colors.textMuted, fontSize: 14 },
});
