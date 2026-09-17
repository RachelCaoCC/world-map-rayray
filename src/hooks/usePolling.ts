import { useEffect, useRef } from "react";
import { useDashboardStore } from "../store/useStore";
import { onAuthReady } from "./useAuth";

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
