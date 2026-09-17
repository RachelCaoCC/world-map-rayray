import { useState, useRef, useEffect, useCallback } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { useDashboardStore } from "../../store/useStore";
import { HoverCard } from "./HoverCard";
import type { Country } from "../../types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const HOVER_CLOSE_DELAY = 3000; // Keep the hovercard open for 3 seconds

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
  const setSelectedCountry = useDashboardStore((s) => s.setSelectedCountry);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [hoveredMarkerCountryId, setHoveredMarkerCountryId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Map<string, SVGGElement>>(new Map());
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerClickedRef = useRef(false);

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
    if (markerClickedRef.current) {
      markerClickedRef.current = false;
      return;
    }
    setSelectedCountry(null);
    setHoveredCountry(null);
  }, [setSelectedCountry, setHoveredCountry]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-slate-50 rounded-xl overflow-hidden"
      onClick={closeView}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 130,
          center: [20, 20],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
             geographies.map((geo) => {
               const countryId = COUNTRY_NAME_TO_ID[geo.properties.name];
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
                    hover: { fill: isSelectedGeo ? "#2563eb" : "#94a3b8", outline: "none", cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>


        {/* Country markers */}
        {countries.filter(c => c.activePlatforms.length > 0).map((country) => {
          const isSelected = selectedCountryId === country.id;
          const isActive = isGlobalView || isSelected;

          return (
            <Marker
              key={country.id}
              coordinates={[country.lng, country.lat]}
              onClick={() => {
                markerClickedRef.current = true;
                setSelectedCountry(country.id);
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                setHoveredCountry(country);
              }}
              onMouseEnter={() => {
                markerClickedRef.current = true;
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
                ref={(el) => {
                  if (el) markerRefs.current.set(country.id, el);
                  else markerRefs.current.delete(country.id);
                }}
              >
                {/* Invisible large hit area */}
                <circle r={30} fill="transparent" />
                {/* Pulse ring for selected */}
                {isSelected && (
                  <circle r={16} fill="#3b82f6" opacity={0.2}>
                    <animate attributeName="r" from="8" to="20" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  r={isSelected ? 8 : isGlobalView ? 6 : 4}
                  fill={isActive ? "#3b82f6" : "#94a3b8"}
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
      </ComposableMap>

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
