// components/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: any;
  role: string | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuth = async () => {
    try {
      setLoading(true);

      // 1. まずSupabaseのセッションがあるか確認
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('web_role, game_id')
          .eq('id', currentUser.id)
          .single();

        if (profile?.web_role) {
          setRole(profile.web_role);
          setLoading(false);
          return;
        }
      }

      // 2. セッションがない場合、ゲームID（localStorage）のログインを確認
      const savedGameId = typeof window !== 'undefined' ? localStorage.getItem('logged_in_game_id') : null;
      if (savedGameId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('web_role')
          .eq('game_id', savedGameId)
          .single();

        if (profile?.web_role) {
          setRole(profile.web_role);
          setLoading(false);
          return;
        }
      }

      setRole('member');
    } catch (err) {
      console.error('Auth fetch error:', err);
      setRole('member');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      fetchAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshAuth: fetchAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);