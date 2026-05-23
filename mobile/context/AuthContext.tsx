import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const REMEMBER_ME_KEY = 'techrp_remember_me';

export interface UserProfile {
  id: string;
  organization_id: string | null;
  coach_instance_id: string | null;
  app_role: string | null;
  full_name: string | null;
  email: string | null;
}

interface AuthContextValue {
  session: Session | null | undefined;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: undefined,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export async function saveRememberMe(value: boolean) {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, value ? 'true' : 'false');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // If the user previously chose not to remember, clear the persisted session.
      const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (rememberMe === 'false') {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
        await supabase.auth.signOut();
        setSession(null);
        setLoading(false);
        return;
      }

      const { data: { session: existing } } = await supabase.auth.getSession();
      setSession(existing);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, organization_id, coach_instance_id, app_role, full_name, email')
        .eq('auth_user_id', session.user.id)
        .single();
      if (!cancelled) {
        setProfile(data as UserProfile | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
