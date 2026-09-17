import { useEffect, useRef, useCallback } from "react";
import { useDashboardStore } from "../store/useStore";
import type { PlatformKey } from "../types";

// Robust auto-rotation keyed on country id (stable) rather than the
// activePlatforms array, which is recreated on every live poll and would
// otherwise reset the index and kill the cycle.
export function usePlatformRotation(
  countryId: string | null,
  activePlatforms: PlatformKey[],
  dwellMs: number = 6000
) {
  const nextPlatform = useDashboardStore((s) => s.nextPlatform);
  const setCurrentPlatformIndex = useDashboardStore((s) => s.setCurrentPlatformIndex);
  const isAutoPlaying = useDashboardStore((s) => s.isAutoPlaying);
  const setIsAutoPlaying = useDashboardStore((s) => s.setIsAutoPlaying);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const platformsKey = activePlatforms.join(",");

  // Reset to first platform only when the country changes.
  useEffect(() => {
    setCurrentPlatformIndex(0);
  }, [countryId, setCurrentPlatformIndex]);

  const startRotation = useCallback(() => {
    setIsAutoPlaying(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activePlatforms.length <= 1) return;
    intervalRef.current = setInterval(() => {
      nextPlatform(activePlatforms);
    }, dwellMs);
  }, [activePlatforms, dwellMs, nextPlatform, setIsAutoPlaying]);

  const stopRotation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsAutoPlaying(false);
  }, [setIsAutoPlaying]);

  const toggleRotation = useCallback(() => {
    if (isAutoPlaying) stopRotation();
    else startRotation();
  }, [isAutoPlaying, startRotation, stopRotation]);

  // Auto-run while playing; restart when dwell or platform set changes.
  useEffect(() => {
    if (!isAutoPlaying) return;
    startRotation();
    return stopRotation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlaying, dwellMs, platformsKey]);

  // Cleanup on unmount.
  useEffect(() => () => stopRotation(), [stopRotation]);

  return { startRotation, stopRotation, toggleRotation, isAutoPlaying };
}
