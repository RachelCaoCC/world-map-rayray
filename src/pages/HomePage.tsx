import { Layout } from "../components/layout/Layout";
import { WorldMap } from "../components/home/WorldMap";
import { StatsBand } from "../components/home/StatsBand";
import { usePolling } from "../hooks/usePolling";

export function HomePage() {
  usePolling(15000);

  return (
    <Layout>
      <div className="relative h-full p-2 sm:p-4">
        <WorldMap />

        {/* Compact realtime world summary, matching the reference layout */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-[calc(100%-1.5rem)] max-w-72 sm:bottom-10 sm:left-7">
          <StatsBand />
        </div>
      </div>
    </Layout>
  );
}
