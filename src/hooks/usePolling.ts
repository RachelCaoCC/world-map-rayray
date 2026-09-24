import { useEffect, useRef } from "react";
import { useDashboardStore } from "../store/useStore";
import { onAuthReady } from "./useAuth";
import { supabase } from "../lib/supabase";

export function usePolling(intervalMs: number = 15000) {
  const fetchAll = useDashboardStore((s) => s.fetchAll);
  const isLoaded = useDashboardStore((s) => s.isLoaded);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial fetch — wait for auth to be resolved first
  useEffect(() => {
    if (!isLoaded) {
      onAuthReady(() => {
        fetchAll();
      });
    }
  }, [isLoaded, fetchAll]);

  // Refresh immediately after login/logout so guest and admin see the right connections.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // Avoid a Supabase auth call inside its callback to prevent auth lock deadlocks.
        queueMicrotask(() => { void fetchAll(); });
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchAll]);

  // Polling — only starts after initial load
  useEffect(() => {
    if (!isLoaded) return;

    intervalRef.current = setInterval(() => {
      fetchAll();
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [intervalMs, fetchAll, isLoaded]);
}
