import { useNavigate } from "react-router-dom";
import type { Country } from "../../types";

interface HoverCardProps {
  country: Country;
  position: { x: number; y: number };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function HoverCard({ country, position, onMouseEnter, onMouseLeave }: HoverCardProps) {
  const navigate = useNavigate();

  const formatFollowers = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="absolute z-50 pointer-events-auto hover-card-enter"
      style={{
        left: position.x,
        top: position.y - 10,
        transform: "translate(-50%, -100%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-64">
        <div className="flex items-center gap-2 mb-3">
          <span className={`fi fi-${country.id} text-xl rounded shadow-sm`} />
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">{country.name}</h3>
            <p className="text-xs text-slate-500">{country.region}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Total Followers</span>
            <span className="font-medium text-slate-800">{formatFollowers(country.totalFollowers)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Active Platforms</span>
            <span className="font-medium text-slate-800">{country.activePlatforms.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Last Updated</span>
            <span className="font-medium text-slate-800 text-xs">{formatDate(country.lastUpdated)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/country/${country.id}`)}
          className="mt-3 w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors"
        >
          Open Dashboard →
        </button>
      </div>
    </div>
  );
}
