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

        {/* Compact global realtime summary positioned over the undeveloped Africa region */}
        <div className="absolute left-1/2 top-[58%] z-10 w-[min(760px,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <StatsBand />
        </div>
      </div>
    </Layout>
  );
}
