'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase-browser';

export type UserRole = 'individual' | 'company_admin' | 'coach' | 'superuser';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AppUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  scenarioAccess: string[];
  coachInstanceId: string | null;
  organizationId: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ['/', '/login', '/signup', '/pending'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserSupabase();

  const loadUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { data: profile } = await (supabase as any)
      .from('users')
      .select('id, auth_user_id, email, name, full_name, app_role, status, scenario_access, coach_instance_id, organization_id')
      .eq('auth_user_id', authUser.id)
      .single();

    if (!profile) {
      setUser(null);
      setLoading(false);
      return;
    }

    const appUser: AppUser = {
      id: profile.id,
      authUserId: authUser.id,
      email: (profile as any).email ?? authUser.email ?? '',
      fullName: (profile as any).full_name ?? (profile as any).name ?? '',
      role: ((profile as any).app_role ?? 'individual') as UserRole,
      status: ((profile as any).status ?? 'pending') as UserStatus,
      scenarioAccess: (profile as any).scenario_access ?? [],
      coachInstanceId: (profile as any).coach_instance_id ?? null,
      organizationId: (profile as any).organization_id ?? null,
    };

    // Superusers are never blocked
    if (appUser.role === 'superuser') {
      setUser(appUser);
      setLoading(false);
      return;
    }

    setUser(appUser);
    setLoading(false);

    // Redirect pending users away from protected pages
    if (appUser.status === 'pending' && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/pending');
    }
    // Redirect rejected users to /pending (shows different UI there)
    if (appUser.status === 'rejected' && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/pending');
    }
    // Redirect suspended users to /pending (shows limit-reached UI)
    if (appUser.status === 'suspended' && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/pending');
    }
  }, [pathname, router]);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN') loadUser();
      if (event === 'SIGNED_OUT') {
        setUser(null);
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}
