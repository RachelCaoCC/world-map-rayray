import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PLATFORM_INFO } from "../../data/mockData";
import { useLiveStats } from "../../hooks/useLiveStats";
import { usePlatformRotation } from "../../hooks/usePlatformRotation";
import { useDashboardStore } from "../../store/useStore";
import type { PlatformKey } from "../../types";
import { FlipCounter } from "./FlipCounter";

const DWELL_MS = 5000;
const POLL_MS = 10000;
const PLATFORMS: PlatformKey[] = ["facebook", "instagram", "youtube", "tiktok"];

type MetricKey = "followers" | "secondary";
type MetricPreferences = Record<PlatformKey, Record<MetricKey, boolean>>;

const SECONDARY_LABELS: Record<PlatformKey, string> = {
  facebook: "People Talking",
  instagram: "Total Views",
  youtube: "Total Views",
  tiktok: "Total Views",
};

function createDefaultPreferences(includeSecondary: boolean): MetricPreferences {
  return {
    facebook: { followers: true, secondary: includeSecondary },
    instagram: { followers: true, secondary: includeSecondary },
    youtube: { followers: true, secondary: includeSecondary },
    tiktok: { followers: true, secondary: includeSecondary },
  };
}

export function PlatformRotation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlatform = searchParams.get("platform") as PlatformKey | null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metricPreferences, setMetricPreferences] = useState<MetricPreferences>(() =>
    createDefaultPreferences(searchParams.get("metrics") === "both")
  );

  const getCountryById = useDashboardStore((state) => state.getCountryById);
  const getAggregatedStats = useDashboardStore((state) => state.getAggregatedStats);
  const currentPlatformIndex = useDashboardStore((state) => state.currentPlatformIndex);
  const setCurrentPlatformIndex = useDashboardStore((state) => state.setCurrentPlatformIndex);
  const countries = useDashboardStore((state) => state.countries);

  const scopedCountries = useMemo(
    () => id ? countries.filter((candidate) => candidate.id === id) : countries,
    [countries, id],
  );

  const availability = useMemo(() => {
    const result: Record<PlatformKey, Record<MetricKey, boolean>> = {
      facebook: { followers: false, secondary: false },
      instagram: { followers: false, secondary: false },
      youtube: { followers: false, secondary: false },
      tiktok: { followers: false, secondary: false },
    };

    for (const candidate of scopedCountries) {
      for (const platform of candidate.activePlatforms) {
        const stat = getAggregatedStats(candidate.id, platform);
        if (!stat || stat.accountCount <= 0) continue;
        if (stat.followers > 0) result[platform].followers = true;
        if (stat.totalViews > 0) result[platform].secondary = true;
      }
    }

    return result;
  }, [getAggregatedStats, scopedCountries]);

  // Each selected platform metric is its own slide. Metrics with no data are
  // omitted, so the carousel never displays a zero-value placeholder.
  const slides = useMemo(() => scopedCountries.flatMap((candidate) =>
    candidate.activePlatforms.flatMap((platform) => {
      const stat = getAggregatedStats(candidate.id, platform);
      if (!stat || stat.accountCount <= 0) return [];

      const platformSlides: Array<{
        countryId: string;
        platform: PlatformKey;
        metric: MetricKey;
      }> = [];

      if (metricPreferences[platform].followers && stat.followers > 0) {
        platformSlides.push({ countryId: candidate.id, platform, metric: "followers" });
      }
      if (metricPreferences[platform].secondary && stat.totalViews > 0) {
        platformSlides.push({ countryId: candidate.id, platform, metric: "secondary" });
      }
      return platformSlides;
    })
  ), [getAggregatedStats, metricPreferences, scopedCountries]);

  const startIndexRef = useRef<number | null>(null);
  if (startIndexRef.current === null && initialPlatform && id) {
    const hintedIndex = slides.findIndex(
      (slide) => slide.countryId === id && slide.platform === initialPlatform
    );
    if (hintedIndex >= 0) {
      startIndexRef.current = hintedIndex;
      setCurrentPlatformIndex(hintedIndex);
    }
  }

  const rotationPlatforms = slides.map((slide) => slide.platform);
  const activeSlide = slides[currentPlatformIndex % Math.max(slides.length, 1)];
  const country = activeSlide ? getCountryById(activeSlide.countryId) : undefined;
  const activePlatform = activeSlide?.platform;
  const platformInfo = activePlatform ? PLATFORM_INFO[activePlatform] : null;
  const storedStat = activeSlide
    ? getAggregatedStats(activeSlide.countryId, activeSlide.platform)
    : null;

  const { platforms: liveStats } = useLiveStats(activeSlide?.countryId ?? null, POLL_MS);
  const liveStat = activePlatform ? liveStats.get(activePlatform) : null;
  const followerValue = (liveStat?.followers ?? 0) > 0
    ? liveStat?.followers ?? 0
    : storedStat?.followers ?? 0;
  const secondaryValue = (liveStat?.totalViews ?? 0) > 0
    ? liveStat?.totalViews ?? 0
    : storedStat?.totalViews ?? 0;
  const metricValue = activeSlide?.metric === "secondary" ? secondaryValue : followerValue;
  const metricLabel = activeSlide?.metric === "secondary"
    ? activePlatform ? SECONDARY_LABELS[activePlatform] : ""
    : activePlatform === "youtube" ? "Subscribers" : "Followers";

  const { toggleRotation, isAutoPlaying } = usePlatformRotation(
    id ?? "global",
    rotationPlatforms,
    DWELL_MS,
  );

  const goTo = useCallback((direction: 1 | -1) => {
    if (slides.length <= 1) return;
    const next = (currentPlatformIndex + direction + slides.length) % slides.length;
    setCurrentPlatformIndex(next);
  }, [currentPlatformIndex, setCurrentPlatformIndex, slides.length]);

  const goNext = useCallback(() => goTo(1), [goTo]);
  const goPrev = useCallback(() => goTo(-1), [goTo]);

  const exitPresentation = useCallback(() => {
    navigate("/map");
  }, [navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else exitPresentation();
      } else if (!settingsOpen && event.key === "ArrowRight") {
        goNext();
      } else if (!settingsOpen && event.key === "ArrowLeft") {
        goPrev();
      } else if (!settingsOpen && event.key === " ") {
        event.preventDefault();
        toggleRotation();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitPresentation, goNext, goPrev, settingsOpen, toggleRotation]);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedAvailableMetricCount = PLATFORMS.reduce((total, platform) =>
    total
    + Number(availability[platform].followers && metricPreferences[platform].followers)
    + Number(availability[platform].secondary && metricPreferences[platform].secondary),
  0);

  const toggleMetric = (platform: PlatformKey, metric: MetricKey) => {
    const currentlySelected = metricPreferences[platform][metric];
    if (currentlySelected && selectedAvailableMetricCount <= 1) return;
    setMetricPreferences((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        [metric]: !currentlySelected,
      },
    }));
  };

  if (!country || !platformInfo || !storedStat || !activeSlide) {
    return (
      <div className="flex h-[100dvh] min-h-[100dvh] items-center justify-center bg-slate-900">
        <p className="text-lg text-white/50">
          No selected metrics contain data. Open Display Settings and choose another metric.
        </p>
      </div>
    );
  }

  const showControls = slides.length > 1;

  return (
    <div
      className="presentation-screen relative flex h-[100dvh] min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-slate-900 select-none"
      onClick={!settingsOpen && showControls ? goNext : undefined}
    >
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="presentation-brand absolute left-8 top-6 z-30 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <span className="text-sm font-bold text-white">C</span>
        </div>
        <span className="text-sm font-medium text-white/60">Count</span>
      </div>

      <div
        className="presentation-actions absolute right-8 top-5 z-30 flex items-center gap-2 sm:gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open display settings"
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <span className="hidden sm:inline">Display Settings</span>
        </button>
        <span className="hidden text-sm font-mono text-white/40 md:inline">
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
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${country.id}-${activePlatform}-${activeSlide.metric}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="presentation-main relative z-10 flex w-full flex-col items-center gap-6 px-4"
        >
          <div className="presentation-logo flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
            <img src={platformInfo.logo} alt={platformInfo.name} className="h-20 w-20 object-contain" />
          </div>
          <h1 className="presentation-title text-4xl font-bold tracking-tight text-white">{platformInfo.name}</h1>
          <p className="presentation-metric text-lg uppercase tracking-widest text-white/50">{metricLabel}</p>
          <FlipCounter value={metricValue} large />
        </motion.div>
      </AnimatePresence>

      <div className="presentation-meta absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-positive" />
          <span className="text-sm font-medium text-white/60">Live</span>
        </div>
        <span className="presentation-refresh whitespace-nowrap text-sm text-white/30">Auto refresh every 10 sec</span>
        {showControls ? (
          <div className="presentation-dots flex max-w-[48vw] gap-2 overflow-hidden">
            {slides.map((slide, index) => (
              <span
                key={`${slide.countryId}-${slide.platform}-${slide.metric}-${index}`}
                className={`h-2 w-2 shrink-0 rounded-full transition-all ${
                  index === currentPlatformIndex % slides.length ? "scale-125 bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        ) : null}
        {showControls ? (
          <span className="presentation-slide-count hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
            {(currentPlatformIndex % slides.length) + 1} / {slides.length}
          </span>
        ) : null}
      </div>

      {showControls ? (
        <div
          className="presentation-controls absolute bottom-6 right-8 z-20 flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={goPrev} aria-label="Previous metric" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button onClick={toggleRotation} aria-label={isAutoPlaying ? "Pause rotation" : "Play rotation"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            {isAutoPlaying ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button onClick={goNext} aria-label="Next metric" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      ) : null}

      <div className="presentation-country absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2">
        <span className={`fi fi-${country.id} text-lg rounded shadow-sm`} />
        <span className="text-sm text-white/40">{country.name}</span>
      </div>

      {showControls ? (
        <div className="presentation-hint absolute bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-white/20">
          ← → to cycle · space to pause · Esc to exit · click to advance
        </div>
      ) : null}

      <AnimatePresence>
        {settingsOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close display settings"
              className="absolute inset-0 z-40 cursor-default bg-black/45"
              onClick={(event) => {
                event.stopPropagation();
                setSettingsOpen(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="absolute inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-white/10 bg-slate-950 p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Display Settings</h2>
                  <p className="mt-1 text-sm leading-5 text-white/45">
                    Choose the data pages included in the carousel. Zero-value metrics are skipped automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {PLATFORMS.map((platform) => {
                  const platformAvailable = availability[platform].followers || availability[platform].secondary;
                  if (!platformAvailable) return null;
                  const info = PLATFORM_INFO[platform];
                  const followerLabel = platform === "youtube" ? "Subscribers" : "Followers";
                  return (
                    <section key={platform} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <img src={info.logo} alt="" className="h-8 w-8 object-contain" />
                        <h3 className="font-semibold text-white">{info.name}</h3>
                      </div>
                      <div className="space-y-2">
                        {([
                          ["followers", followerLabel],
                          ["secondary", SECONDARY_LABELS[platform]],
                        ] as const).map(([metric, label]) => {
                          const hasData = availability[platform][metric];
                          const checked = metricPreferences[platform][metric] && hasData;
                          const isOnlySelection = checked && selectedAvailableMetricCount <= 1;
                          return (
                            <label
                              key={metric}
                              className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                                hasData ? "bg-white/5 text-white/80" : "bg-white/[0.02] text-white/25"
                              }`}
                            >
                              <span className="text-sm">
                                {label}
                                {!hasData ? <span className="ml-2 text-xs">No data</span> : null}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!hasData || isOnlySelection}
                                onChange={() => toggleMetric(platform, metric)}
                                className="h-4 w-4 rounded border-white/30 accent-blue-500"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-400"
              >
                Apply to Carousel ({slides.length} slides)
              </button>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
