"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User, Provider } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "./supabase";

type AuthState = {
  /** Whether Supabase is configured (env vars present). */
  enabled: boolean;
  /** Whether we're still loading the initial session. */
  loading: boolean;
  /** The current session, or null if signed out. */
  session: Session | null;
  /** The current user, convenience. */
  user: User | null;
  /** Sign in with email + password. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Sign up with email + password. */
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  /** Sign in with an OAuth provider (Google, GitHub). */
  signInWithOAuth: (provider: Provider) => Promise<void>;
  /** Sign out and clear the local session. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const enabled = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);

  // Subscribe to auth state changes + load the initial session.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    // Live updates
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [enabled]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
        },
      });
      if (error) throw error;
      // If email confirmation is required, session is null and user
      // must click the link in the email before signing in.
      return {
        needsEmailConfirmation: !data.session,
      };
    },
    []
  );

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase not configured");
    const redirectTo = `${window.location.origin}/account`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value: AuthState = {
    enabled,
    loading,
    session,
    user: session?.user ?? null,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
