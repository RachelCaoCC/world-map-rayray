import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { useDashboardStore } from "../../store/useStore";
import { HoverCard } from "./HoverCard";
import type { Country } from "../../types";
import { MANUAL_ACCOUNT_SNAPSHOTS } from "../../data/manualSnapshots";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const HOVER_CLOSE_DELAY = 3000; // Keep the hovercard open for 3 seconds

// Separate very close Southeast Asian markers so each dot remains clickable.
const MARKER_OFFSETS: Record<string, [number, number]> = {
  my: [-3, 1.5],
  sg: [3.5, -1.5],
  th: [0.5, 1],
};

const COUNTRY_NAME_TO_ID: Record<string, string> = {
  "United States of America": "us",
  "China": "cn",
  "Taiwan": "tw",
  "Japan": "jp",
  "South Korea": "kr",
  "United Kingdom": "gb",
  "Germany": "de",
  "France": "fr",
  "Australia": "au",
  "Brazil": "br",
  "India": "in",
  "Singapore": "sg",
  "Mexico": "mx",
  "Indonesia": "id",
  "Thailand": "th",
  "Canada": "ca",
};

// Related geographies that highlight together (e.g. Taiwan as part of China)
const RELATED_IDS: Record<string, string[]> = {
  cn: ["cn", "tw"],
  tw: ["tw", "cn"],
};
function relatedIds(id: string | null | undefined): Set<string> {
  if (!id) return new Set();
  return new Set(RELATED_IDS[id] ?? [id]);
}


export function WorldMap() {
  const countries = useDashboardStore((s) => s.countries);
  const selectedCountryId = useDashboardStore((s) => s.selectedCountryId);
  const platformConnections = useDashboardStore((s) => s.platformConnections);
  const setSelectedCountry = useDashboardStore((s) => s.setSelectedCountry);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [hoveredMarkerCountryId, setHoveredMarkerCountryId] = useState<string | null>(null);
  const [mapPosition, setMapPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 0],
    zoom: 1,
  });

  const dataSourceByCountry = useMemo(() => {
    const result = new Map<string, "api" | "manual" | "mixed">();
    for (const country of countries) {
      const connectedPlatforms = new Set(
        platformConnections
          .filter((connection) => connection.countryId === country.id && connection.status === "connected")
          .map((connection) => connection.platform),
      );
      const hasManualFallback = MANUAL_ACCOUNT_SNAPSHOTS.some(
        (snapshot) =>
          snapshot.countryId === country.id &&
          !connectedPlatforms.has(snapshot.platform as "facebook" | "instagram" | "youtube" | "tiktok"),
      );
      if (connectedPlatforms.size > 0 && hasManualFallback) result.set(country.id, "mixed");
      else if (connectedPlatforms.size > 0) result.set(country.id, "api");
      else if (hasManualFallback) result.set(country.id, "manual");
    }
    return result;
  }, [countries, platformConnections]);

  const containerRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Map<string, SVGGElement>>(new Map());
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomFrameRef = useRef<number | null>(null);

  const animateZoom = useCallback((targetZoom: number, targetCoordinates = mapPosition.coordinates) => {
    if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
    const from = mapPosition;
    const startedAt = performance.now();
    const duration = 220;
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setMapPosition({
        coordinates: [
          from.coordinates[0] + (targetCoordinates[0] - from.coordinates[0]) * eased,
          from.coordinates[1] + (targetCoordinates[1] - from.coordinates[1]) * eased,
        ],
        zoom: from.zoom + (targetZoom - from.zoom) * eased,
      });
      if (progress < 1) zoomFrameRef.current = requestAnimationFrame(step);
    };
    zoomFrameRef.current = requestAnimationFrame(step);
  }, [mapPosition]);

  useEffect(() => () => {
    if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
  }, []);

  const isGlobalView = selectedCountryId === null;

  // Position the card at the marker's rendered location
  const positionCard = useCallback((countryId: string) => {
    const markerEl = markerRefs.current.get(countryId);
    const container = containerRef.current;
    if (!markerEl || !container) return;

    const markerRect = markerEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setHoveredPos({
      x: markerRect.left - containerRect.left + markerRect.width / 2,
      y: markerRect.top - containerRect.top,
    });
  }, []);

  useEffect(() => {
    if (hoveredCountry) {
      positionCard(hoveredCountry.id);
    }
  }, [hoveredCountry, positionCard]);

  // Synchronize selectedCountryId to hoveredCountry so that clicking a list item opens the card
  useEffect(() => {
    if (selectedCountryId) {
      const match = countries.find((c) => c.id === selectedCountryId);
      if (match) {
        if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        setHoveredCountry(match);
      }
    } else {
      setHoveredCountry(null);
    }
  }, [selectedCountryId, countries]);


  const closeView = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setSelectedCountry(null);
    setHoveredCountry(null);
    setHoveredMarkerCountryId(null);
  }, [setSelectedCountry]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full flex-1 overflow-hidden rounded-xl bg-slate-50 touch-none"
      onClick={closeView}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 108,
          center: [10, 8],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={mapPosition.coordinates}
          zoom={mapPosition.zoom}
          minZoom={1}
          maxZoom={6}
          onMoveEnd={({ coordinates, zoom }) => setMapPosition({ coordinates, zoom })}
        >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
             geographies.map((geo) => {
               const countryId = COUNTRY_NAME_TO_ID[geo.properties.name];
               const country = countryId ? countries.find((item) => item.id === countryId) : undefined;
               const selectedSet = relatedIds(selectedCountryId);
               const hoveredSet = relatedIds(hoveredMarkerCountryId);
               const isHoveredFromMarker = countryId && hoveredSet.has(countryId);
               const isSelectedGeo = countryId && selectedSet.has(countryId);

               let fillVal = "#e2e8f0";
               if (isSelectedGeo) {
                 fillVal = "#3b82f6";
               } else if (isHoveredFromMarker) {
                 fillVal = "#94a3b8";
               }

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillVal}
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none", transition: "fill 0.2s" },
                    hover: { fill: isSelectedGeo ? "#2563eb" : "#94a3b8", outline: "none", cursor: country ? "pointer" : "default" },
                    pressed: { outline: "none" },
                  }}
                  onClick={(event) => {
                    if (!country || country.activePlatforms.length === 0) return;
                    event.stopPropagation();
                    setSelectedCountry(country.id);
                    setHoveredCountry(country);
                  }}
                />
              );
            })
          }
        </Geographies>


        {/* Country markers */}
        {countries.filter(c => c.activePlatforms.length > 0).map((country) => {
          const offset = MARKER_OFFSETS[country.id] ?? [0, 0];
          const markerCoordinates: [number, number] = [
            country.lng + offset[0],
            country.lat + offset[1],
          ];
          const isSelected = selectedCountryId === country.id;
          const isActive = isGlobalView || isSelected;
          const dataSource = dataSourceByCountry.get(country.id) ?? "api";
          const markerColor = dataSource === "manual"
            ? "#f59e0b"
            : dataSource === "mixed"
              ? "#8b5cf6"
              : "#3b82f6";

          return (
            <Marker
              key={country.id}
              coordinates={markerCoordinates}
              onMouseEnter={() => {
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                setHoveredMarkerCountryId(country.id);
                if (country.id === selectedCountryId) {
                  setHoveredCountry(country);
                }
              }}
              onMouseLeave={() => {
                setHoveredMarkerCountryId(null);
                if (country.id === selectedCountryId) {
                  leaveTimerRef.current = setTimeout(() => setHoveredCountry(null), HOVER_CLOSE_DELAY);
                }
              }}
            >
              <g
                role="button"
                tabIndex={0}
                aria-label={`Open ${country.name} dashboard`}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  setSelectedCountry(country.id);
                  setHoveredCountry(country);
                  setHoveredMarkerCountryId(country.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  setSelectedCountry(country.id);
                  setHoveredCountry(country);
                  setHoveredMarkerCountryId(country.id);
                }}
                ref={(el) => {
                  if (el) markerRefs.current.set(country.id, el);
                  else markerRefs.current.delete(country.id);
                }}
              >
                <title>{`Open ${country.name} dashboard`}</title>
                {/* Only the visible marker receives pointer events so nearby Southeast Asian dots cannot steal the click. */}
                {/* Pulse ring for selected */}
                {isSelected && (
                  <circle r={16} fill="#3b82f6" opacity={0.2}>
                    <animate attributeName="r" from="8" to="20" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  r={isSelected ? 8 : isGlobalView ? 6 : 4}
                  fill={isActive ? markerColor : "#94a3b8"}
                  stroke="#fff"
                  strokeWidth={2}
                  opacity={isActive ? 1 : 0.4}
                />
                {isSelected && (
                  <foreignObject x={-9} y={-30} width={18} height={18}>
                    <span className={`fi fi-${country.flagCode} text-base rounded shadow-sm`} />
                  </foreignObject>
                )}
              </g>
            </Marker>
          );
        })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Data source legend */}
      <div
        className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-3.75rem)] flex-wrap gap-2 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-2 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm sm:left-4 sm:top-4 sm:gap-3 sm:px-3 sm:text-[11px]"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />API</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />API + Manual</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Manual</span>
      </div>

      {/* Map zoom controls */}
      <div
        className="absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:right-4 sm:top-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => animateZoom(Math.min(mapPosition.zoom * 1.35, 6))}
          className="flex h-9 w-9 items-center justify-center text-xl font-medium text-slate-700 hover:bg-slate-100 sm:h-10 sm:w-10"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => animateZoom(Math.max(mapPosition.zoom / 1.35, 1))}
          className="flex h-9 w-9 items-center justify-center border-t border-slate-200 text-xl font-medium text-slate-700 hover:bg-slate-100 sm:h-10 sm:w-10"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset map"
          title="Reset map"
          onClick={() => animateZoom(1, [0, 0])}
          className="flex h-9 w-9 items-center justify-center border-t border-slate-200 text-slate-600 hover:bg-slate-100 sm:h-10 sm:w-10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5.1 15a8 8 0 0 0 13.2 2M18.9 9A8 8 0 0 0 5.7 7" />
          </svg>
        </button>
      </div>

      {/* Global view helper */}
      {isGlobalView && (
        <div className="absolute bottom-4 right-4 hidden rounded-lg border border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm sm:block">
          <p className="text-sm font-medium text-slate-700">🌍 Global View — Select a country for details</p>
        </div>
      )}

      {/* Hover card — anchored to country marker position */}
      {hoveredCountry && (
        <HoverCard
          key={hoveredCountry.id}
          country={hoveredCountry}
          position={hoveredPos}
          onMouseEnter={() => {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
          }}
          onMouseLeave={() => {
            leaveTimerRef.current = setTimeout(() => setHoveredCountry(null), HOVER_CLOSE_DELAY);
          }}

        />
      )}

    </div>
  );
}
