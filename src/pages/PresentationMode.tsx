import { PlatformRotation } from "../components/presentation/PlatformRotation";
import { usePolling } from "../hooks/usePolling";

export function PresentationMode() {
  // Load the latest saved database snapshot and keep it fresh while presenting.
  // The carousel can therefore render even when a live platform API is unavailable.
  usePolling(10000);

  return <PlatformRotation />;
}
