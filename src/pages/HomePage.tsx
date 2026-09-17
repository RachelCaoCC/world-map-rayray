import { Layout } from "../components/layout/Layout";
import { WorldMap } from "../components/home/WorldMap";
import { StatsBand } from "../components/home/StatsBand";
import { usePolling } from "../hooks/usePolling";

export function HomePage() {
  usePolling(15000);

  return (
    <Layout>
      <div className="relative h-full p-4">
        <WorldMap />

        {/* Compact realtime world summary, matching the reference layout */}
        <div className="absolute bottom-10 left-7 z-10 w-72 pointer-events-none">
          <StatsBand />
        </div>
      </div>
    </Layout>
  );
}
