import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "../../store/useStore";
import { FlipCounter } from "./FlipCounter";
import { PLATFORM_INFO } from "../../data/mockData";
import { usePlatformRotation } from "../../hooks/usePlatformRotation";
import { useLiveStats } from "../../hooks/useLiveStats";
import type { PlatformKey } from "../../types";

const DWELL_MS = 6000;
const POLL_MS = 15000;

export function PlatformRotation() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialPlatform = searchParams.get("platform") as PlatformKey | null;

  const getCountryById = useDashboardStore((s) => s.getCountryById);
  const getAggregatedStats = useDashboardStore((s) => s.getAggregatedStats);
  const currentPlatformIndex = useDashboardStore((s) => s.currentPlatformIndex);
  const setCurrentPlatformIndex = useDashboardStore((s) => s.setCurrentPlatformIndex);

  // Live stats from platform APIs
  const { platforms: liveStats } = useLiveStats(id ?? null, POLL_MS);

  const country = getCountryById(id ?? "");
  const activePlatforms = useMemo(
    () => (country?.activePlatforms ?? []).filter(
      (p) => (getAggregatedStats(id ?? "", p)?.accountCount ?? 0) > 0
    ) as PlatformKey[],
    [country?.id, country?.activePlatforms, getAggregatedStats]
  );

  // ?platform= is only a STARTING hint — the presentation always cycles
  // through all active platforms for the country.
  const startIdxRef = useRef<number | null>(null);
  if (
    startIdxRef.current === null &&
    initialPlatform &&
    activePlatforms.includes(initialPlatform)
  ) {
    startIdxRef.current = activePlatforms.indexOf(initialPlatform);
    setCurrentPlatformIndex(startIdxRef.current);
  }

  const displayPlatforms = activePlatforms;
  const activePlatform = displayPlatforms[currentPlatformIndex % displayPlatforms.length];
  const platformInfo = activePlatform ? PLATFORM_INFO[activePlatform] : null;
  const liveStat = activePlatform ? liveStats.get(activePlatform) : null;
  const platformStat = liveStat
    ? { followers: liveStat.followers, totalViews: liveStat.totalViews, accountCount: 1, status: "Updated" as const }
    : id && activePlatform ? getAggregatedStats(id, activePlatform) : null;

  const { toggleRotation, isAutoPlaying } = usePlatformRotation(
    id ?? null,
    activePlatforms,
    DWELL_MS
  );

  // Manual controls
  const goTo = useCallback((dir: 1 | -1) => {
    if (displayPlatforms.length <= 1) return;
    const next = (currentPlatformIndex + dir + displayPlatforms.length) % displayPlatforms.length;
    setCurrentPlatformIndex(next);
  }, [currentPlatformIndex, displayPlatforms.length, setCurrentPlatformIndex]);

  const goNext = useCallback(() => goTo(1), [goTo]);
  const goPrev = useCallback(() => goTo(-1), [goTo]);

  // Keyboard controls: arrows + space to toggle autoplay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") { e.preventDefault(); toggleRotation(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, toggleRotation]);

  // Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!country || !platformInfo || !platformStat) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white/50 text-lg">Loading...</p>
      </div>
    );
  }

  const metricLabel = activePlatform === "youtube" ? "Subscribers" : "Followers";
  const showControls = displayPlatforms.length > 1;

  return (
    <div
      className="h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden select-none"
      onClick={showControls ? goNext : undefined}
    >
      {/* Background subtle pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* Branding top-left */}
      <div className="absolute top-6 left-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="text-white/60 text-sm font-medium">Count</span>
      </div>

      {/* Time top-right */}
      <div className="absolute top-6 right-8 text-white/40 text-sm font-mono">
        {time.toLocaleTimeString("en-US", { hour12: false })}
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePlatform}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6 relative z-10"
        >
          {/* Platform logo */}
          <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center bg-transparent">
            <img src={platformInfo.logo} alt={platformInfo.name} className="w-20 h-20 object-contain" />
          </div>

          {/* Platform name */}
          <h1 className="text-white text-4xl font-bold tracking-tight">{platformInfo.name}</h1>

          {/* Metric label */}
          <p className="text-white/50 text-lg uppercase tracking-widest">{metricLabel}</p>

          {/* Mechanical flip counter */}
          <FlipCounter value={liveStat?.followers ?? platformStat?.followers ?? 0} large />
        </motion.div>
      </AnimatePresence>

      {/* Bottom indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-white/60 text-sm font-medium">Live</span>
        </div>

        {/* Auto-refresh */}
        <span className="text-white/30 text-sm">Auto refresh every 15 sec</span>

        {/* Platform dots */}
        {showControls && (
          <div className="flex gap-2">
            {displayPlatforms.map((p, i) => (
              <span
                key={p}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentPlatformIndex % displayPlatforms.length
                    ? "bg-white scale-125"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Control bar (manual cycle) */}
      {showControls && (
        <div
          className="absolute bottom-6 right-8 flex items-center gap-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={goPrev}
            aria-label="Previous platform"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            onClick={toggleRotation}
            aria-label={isAutoPlaying ? "Pause rotation" : "Play rotation"}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            {isAutoPlaying ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button
            onClick={goNext}
            aria-label="Next platform"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      )}

      {/* Country badge */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className={`fi fi-${country.id} text-lg rounded shadow-sm`} />
        <span className="text-white/40 text-sm">{country.name}</span>
      </div>

      {/* Hint */}
      {showControls && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/20 text-xs">
          ← → to cycle · space to pause · click to advance
        </div>
      )}
    </div>
  );
}
