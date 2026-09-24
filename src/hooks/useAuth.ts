import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes — this fires after Supabase hydrates from storage
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = user?.app_metadata?.role === "admin";

  return { user, loading, isAdmin };
}

// Global flag: set to true after first onAuthStateChange fires
let _authResolved = false;
let _authCallbacks: (() => void)[] = [];

export function onAuthReady(cb: () => void) {
  if (_authResolved) { cb(); return; }
  _authCallbacks.push(cb);
}

supabase.auth.onAuthStateChange(() => {
  if (!_authResolved) {
    _authResolved = true;
    _authCallbacks.forEach(cb => cb());
    _authCallbacks = [];
  }
});

export function isAuthResolved() {
  return _authResolved;
}
