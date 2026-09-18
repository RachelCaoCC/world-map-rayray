import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "../../store/useStore";
import { FlipCounter } from "./FlipCounter";
import { PLATFORM_INFO } from "../../data/mockData";
import { usePlatformRotation } from "../../hooks/usePlatformRotation";
import { useLiveStats } from "../../hooks/useLiveStats";
import type { PlatformKey } from "../../types";

const DWELL_MS = 5000;
const POLL_MS = 10000;

export function PlatformRotation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlatform = searchParams.get("platform") as PlatformKey | null;
  const includeSecondaryByDefault = searchParams.get("metrics") === "both";
  const [metricSelections, setMetricSelections] = useState<
    Partial<Record<PlatformKey, { followers: boolean; secondary: boolean }>>
  >({});

  const getCountryById = useDashboardStore((s) => s.getCountryById);
  const getAggregatedStats = useDashboardStore((s) => s.getAggregatedStats);
  const currentPlatformIndex = useDashboardStore((s) => s.currentPlatformIndex);
  const setCurrentPlatformIndex = useDashboardStore((s) => s.setCurrentPlatformIndex);

  const countries = useDashboardStore((s) => s.countries);

  // With no country in the URL, build one global carousel containing every
  // connected country × platform combination.
  const slides = useMemo(() => {
    const scopedCountries = id
      ? countries.filter((candidate) => candidate.id === id)
      : countries;

    return scopedCountries.flatMap((candidate) =>
      candidate.activePlatforms
        .filter((platform) => (getAggregatedStats(candidate.id, platform)?.accountCount ?? 0) > 0)
        .map((platform) => ({ countryId: candidate.id, platform }))
    );
  }, [countries, getAggregatedStats, id]);

  // ?platform= is only a starting hint for country presentations.
  const startIdxRef = useRef<number | null>(null);
  if (startIdxRef.current === null && initialPlatform && id) {
    const hintedIndex = slides.findIndex(
      (slide) => slide.countryId === id && slide.platform === initialPlatform
    );
    if (hintedIndex >= 0) {
      startIdxRef.current = hintedIndex;
      setCurrentPlatformIndex(hintedIndex);
    }
  }

  const displayPlatforms = slides.map((slide) => slide.platform);
  const activeSlide = slides[currentPlatformIndex % Math.max(slides.length, 1)];
  const country = activeSlide ? getCountryById(activeSlide.countryId) : undefined;
  const activePlatform = activeSlide?.platform;
  const platformInfo = activePlatform ? PLATFORM_INFO[activePlatform] : null;

  // Fetch live data for whichever country is currently on screen.
  const { platforms: liveStats } = useLiveStats(activeSlide?.countryId ?? null, POLL_MS);
  const liveStat = activePlatform ? liveStats.get(activePlatform) : null;
  const platformStat = liveStat
    ? { followers: liveStat.followers, totalViews: liveStat.totalViews, accountCount: 1, status: "Updated" as const }
    : activeSlide
      ? getAggregatedStats(activeSlide.countryId, activeSlide.platform)
      : null;

  const { toggleRotation, isAutoPlaying } = usePlatformRotation(
    id ?? "global",
    displayPlatforms,
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

  const exitPresentation = useCallback(() => {
    navigate("/map");
  }, [navigate]);

  // Keyboard controls: arrows + space to toggle autoplay, Escape to exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitPresentation();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") { e.preventDefault(); toggleRotation(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitPresentation, goNext, goPrev, toggleRotation]);

  // Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!country || !platformInfo || !platformStat) {
    return (
      <div className="flex h-[100dvh] min-h-[100dvh] items-center justify-center bg-slate-900">
        <p className="text-white/50 text-lg">Loading...</p>
      </div>
    );
  }

  const metricLabel = activePlatform === "youtube" ? "Subscribers" : "Followers";
  const secondaryMetricLabel = activePlatform === "facebook"
    ? "People Talking"
    : activePlatform === "instagram"
      ? "Media Published"
      : "Total Views";
  const followerValue = liveStat?.followers ?? platformStat?.followers ?? 0;
  const secondaryMetricValue = liveStat?.totalViews ?? platformStat?.totalViews ?? 0;
  const metricSelection = metricSelections[activePlatform] ?? {
    followers: true,
    secondary: includeSecondaryByDefault,
  };
  const showFollowers = metricSelection.followers;
  const showSecondaryMetric = metricSelection.secondary && secondaryMetricValue > 0;
  const visibleMetricCount = Number(showFollowers) + Number(showSecondaryMetric);
  const updateMetricSelection = (metric: "followers" | "secondary", enabled: boolean) => {
    setMetricSelections((current) => ({
      ...current,
      [activePlatform]: {
        followers: metric === "followers" ? enabled : metricSelection.followers,
        secondary: metric === "secondary" ? enabled : metricSelection.secondary,
      },
    }));
  };
  const showControls = displayPlatforms.length > 1;

  return (
    <div
      className="presentation-screen relative flex h-[100dvh] min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-slate-900 select-none"
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
      <div className="presentation-brand absolute left-8 top-6 z-30 flex items-center gap-2">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="text-white/60 text-sm font-medium">Count</span>
      </div>

      {/* Time and exit top-right */}
      <div
        className="presentation-actions absolute right-8 top-5 z-30 flex items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white/40 text-sm font-mono">
          {time.toLocaleTimeString("en-US", { hour12: false })}
        </span>
        <button
          type="button"
          onClick={exitPresentation}
          aria-label="Exit presentation mode"
          title="Exit presentation mode (Esc)"
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Exit
        </button>
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${country.id}-${activePlatform}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="presentation-main relative z-10 flex w-full flex-col items-center gap-6 px-4"
        >
          {/* Platform logo */}
          <div className="presentation-logo flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
            <img src={platformInfo.logo} alt={platformInfo.name} className="h-20 w-20 object-contain" />
          </div>

          {/* Platform name */}
          <h1 className="presentation-title text-4xl font-bold tracking-tight text-white">{platformInfo.name}</h1>

          <div
            className="flex flex-wrap justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              disabled={showFollowers && !metricSelection.secondary}
              onClick={() => updateMetricSelection("followers", !showFollowers)}
              aria-pressed={showFollowers}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                showFollowers
                  ? "bg-white text-slate-900"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {metricLabel}
            </button>
            <button
              type="button"
              disabled={
                secondaryMetricValue <= 0 ||
                (metricSelection.secondary && !showFollowers)
              }
              onClick={() => updateMetricSelection("secondary", !metricSelection.secondary)}
              aria-pressed={metricSelection.secondary && secondaryMetricValue > 0}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                metricSelection.secondary && secondaryMetricValue > 0
                  ? "bg-white text-slate-900"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {secondaryMetricLabel}
            </button>
          </div>

          <div className={`grid w-full max-w-5xl items-start gap-8 ${
            visibleMetricCount > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}>
            {showFollowers && (
              <div className="flex min-w-0 flex-col items-center gap-4">
                <p className="presentation-metric text-lg uppercase tracking-widest text-white/50">{metricLabel}</p>
                <FlipCounter value={followerValue} large={visibleMetricCount === 1} />
              </div>
            )}
            {showSecondaryMetric && (
              <div className="flex min-w-0 flex-col items-center gap-4">
                <p className="presentation-metric text-lg uppercase tracking-widest text-white/50">
                  {secondaryMetricLabel}
                </p>
                <FlipCounter value={secondaryMetricValue} large={visibleMetricCount === 1} />
              </div>
            )}
          </div>

          {secondaryMetricValue <= 0 && (
            <p className="text-xs text-white/35">{secondaryMetricLabel} is not available for this account.</p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom indicators */}
      <div className="presentation-meta absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-6">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-white/60 text-sm font-medium">Live</span>
        </div>

        {/* Auto-refresh */}
        <span className="presentation-refresh whitespace-nowrap text-sm text-white/30">Auto refresh every 10 sec</span>

        {/* Platform dots */}
        {showControls && (
          <div className="presentation-dots flex max-w-[48vw] gap-2 overflow-hidden">
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
        {showControls && (
          <span className="presentation-slide-count hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
            {(currentPlatformIndex % displayPlatforms.length) + 1} / {displayPlatforms.length}
          </span>
        )}
      </div>

      {/* Control bar (manual cycle) */}
      {showControls && (
        <div
          className="presentation-controls absolute bottom-6 right-8 z-20 flex items-center gap-2"
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
      <div className="presentation-country absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2">
        <span className={`fi fi-${country.id} text-lg rounded shadow-sm`} />
        <span className="text-white/40 text-sm">{country.name}</span>
      </div>

      {/* Hint */}
      {showControls && (
        <div className="presentation-hint absolute bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-white/20">
          ← → to cycle · space to pause · Esc to exit · click to advance
        </div>
      )}
    </div>
  );
}
