import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as analytics from '../lib/analytics';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const checkAndTrackSignUp = (currentUser: User) => {
  try {
    const signUpTrackedKey = `signUpTracked_${currentUser.id}`;
    if (!localStorage.getItem(signUpTrackedKey)) {
      const createdAt = new Date(currentUser.created_at).getTime();
      const lastSignIn = new Date(currentUser.last_sign_in_at || '').getTime();
      if (Math.abs(lastSignIn - createdAt) < 10000) {
        localStorage.setItem(signUpTrackedKey, 'true');
        analytics.track('user_signed_up', {
          provider: currentUser.app_metadata?.provider || 'google',
        }).catch(() => {});
      }
    }
  } catch (e) {
    // ignore
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        const newUserId = currentSession?.user?.id ?? null;

        // Always update the session (contains fresh tokens)
        setSession(currentSession);

        // Only update user state if the user identity actually changed.
        // This prevents unnecessary re-renders on TOKEN_REFRESHED events
        // that happen every time the browser tab regains focus.
        if (newUserId !== userIdRef.current) {
          userIdRef.current = newUserId;
          setUser(currentSession?.user ?? null);
        }

        setLoading(false);
        if (currentSession?.user) {
          checkAndTrackSignUp(currentSession.user);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      const newUserId = currentSession?.user?.id ?? null;

      setSession(currentSession);

      if (newUserId !== userIdRef.current) {
        userIdRef.current = newUserId;
        setUser(currentSession?.user ?? null);
      }

      setLoading(false);

      // Track last activity on app open
      if (currentSession?.user) {
        checkAndTrackSignUp(currentSession.user);
        supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', currentSession.user.id)
          .then();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const signInAsDemo = async (password: string) => {
    const { data: sessionData, error: funcError } = await supabase.functions.invoke('predefined-login', {
      method: 'POST',
      body: { account: 'demo', password },
    });

    if (funcError) throw funcError;
    if (!sessionData) throw new Error('Failed to retrieve session from login.');

    const { error } = await supabase.auth.setSession({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInAsDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
