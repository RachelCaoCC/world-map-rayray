import { useDashboardStore } from "../../store/useStore";
import type { ContinentFilter } from "../../types";

const CONTINENTS: ContinentFilter[] = ["All", "Asia", "Europe", "North America", "Oceania"];

export function CountryList() {
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery);
  const continentFilter = useDashboardStore((s) => s.continentFilter);
  const setContinentFilter = useDashboardStore((s) => s.setContinentFilter);
  const selectedCountryId = useDashboardStore((s) => s.selectedCountryId);
  const setSelectedCountry = useDashboardStore((s) => s.setSelectedCountry);
  const filteredCountries = useDashboardStore((s) => s.filteredCountries);

  const countries = filteredCountries();

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-base">Select a Country or Region</h2>
        <p className="text-xs text-slate-500 mt-1">Choose a market to view its social media follower data</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search countries or regions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          />
        </div>
      </div>

      {/* Continent chips */}
      <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
        {CONTINENTS.map((c) => (
          <button
            key={c}
            onClick={() => setContinentFilter(c)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              continentFilter === c
                ? "bg-accent text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Country list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {countries.map((country) => (
          <button
            key={country.id}
            onClick={() => setSelectedCountry(country.id)}
            className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all border-b border-slate-50 ${
              selectedCountryId === country.id
                ? "bg-accent/5 border-l-3 border-l-accent"
                : "hover:bg-slate-50"
            }`}
          >
            <span className={`fi fi-${country.id} text-xl rounded shadow-sm`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">{country.name}</span>
                {selectedCountryId === country.id && (
                  <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {country.totalFollowers >= 1_000_000
                  ? `${(country.totalFollowers / 1_000_000).toFixed(1)}M followers`
                  : country.totalFollowers >= 1_000
                  ? `${(country.totalFollowers / 1_000).toFixed(0)}K followers`
                  : `${country.totalFollowers} followers`}
              </span>
            </div>
            <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}

        {/* Global / All Markets pinned at bottom */}
        <button
          onClick={() => setSelectedCountry(null)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left bg-slate-50 border-t border-slate-200 sticky bottom-0 ${
            selectedCountryId === null ? "ring-2 ring-accent/30" : ""
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-800">Global / All Markets</span>
            <p className="text-xs text-slate-500">View aggregated global overview</p>
          </div>
        </button>
      </div>
    </div>
  );
}
