import { useEffect, useRef, useState } from "react";

interface LivePlatformStat {
  platform: string;
  accountName: string;
  followers: number;
  totalViews: number;
}

interface UseLiveStatsResult {
  platforms: Map<string, LivePlatformStat>;
  isLoading: boolean;
}

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function useLiveStats(countryId: string | null, intervalMs: number = 15000): UseLiveStatsResult {
  const [platforms, setPlatforms] = useState<Map<string, LivePlatformStat>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = async () => {
    if (!countryId) return;
    try {
      const res = await fetch(`${FUNC_URL}/get-live-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ countryId }),
      });
      const data = await res.json();
      if (data.ok && data.platforms) {
        const map = new Map<string, LivePlatformStat>();
        for (const p of data.platforms) {
          map.set(p.platform, p);
        }
        setPlatforms(map);
      }
    } catch (err) {
      console.error("useLiveStats fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear the previous country immediately so the UI falls back to its
    // latest saved database snapshot while the live request is pending.
    setPlatforms(new Map());
    setIsLoading(true);
    fetchStats();
    intervalRef.current = setInterval(fetchStats, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [countryId, intervalMs]);

  return { platforms, isLoading };
}
