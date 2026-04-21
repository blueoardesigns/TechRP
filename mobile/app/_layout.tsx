import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined || loading) return; // still resolving
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/train');
    }
  }, [session, loading, segments, router]);

  // Blank dark screen while auth state resolves
  if (session === undefined) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
