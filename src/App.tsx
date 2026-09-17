import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CountryDashboard } from "./pages/CountryDashboard";
import { PresentationMode } from "./pages/PresentationMode";
import { PlatformManager } from "./pages/PlatformManager";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { GlobalReport } from "./pages/GlobalReport";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PresentationMode />} />
        <Route path="/map" element={<HomePage />} />
        <Route path="/report" element={<GlobalReport />} />
        <Route path="/country/:id" element={<CountryDashboard />} />
        <Route path="/present" element={<PresentationMode />} />
        <Route path="/country/:id/present" element={<PresentationMode />} />
        <Route path="/admin/platforms" element={<PlatformManager />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
      </Routes>
    </BrowserRouter>
  );
}
