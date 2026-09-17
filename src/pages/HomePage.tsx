import { Layout } from "../components/layout/Layout";
import { CountryList } from "../components/home/CountryList";
import { WorldMap } from "../components/home/WorldMap";
import { StatsBand } from "../components/home/StatsBand";
import { usePolling } from "../hooks/usePolling";

export function HomePage() {
  usePolling(15000);

  return (
    <Layout>
      <div className="flex h-full overflow-auto">
        {/* Sidebar */}
        <CountryList />

        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {/* Map */}
          <div className="flex-1 p-4">
            <WorldMap />
          </div>

          {/* Bottom stats */}
          <StatsBand />
        </div>
      </div>
    </Layout>
  );
}
