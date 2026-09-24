import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CountryDashboard } from "./pages/CountryDashboard";
import { PresentationMode } from "./pages/PresentationMode";
import { PlatformManager } from "./pages/PlatformManager";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { GlobalReport } from "./pages/GlobalReport";
import { CountryReport } from "./pages/CountryReport";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./hooks/useAuth";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-600">Checking admin access…</div>;
  return isAdmin ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

function AdminLoginRoute() {
  const { loading, isAdmin } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-600">Checking session…</div>;
  return isAdmin ? <Navigate to="/admin/platforms" replace /> : <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PresentationMode />} />
        <Route path="/map" element={<HomePage />} />
        <Route path="/report" element={<GlobalReport />} />
        <Route path="/country/:id" element={<CountryDashboard />} />
        <Route path="/country/:id/report" element={<CountryReport />} />
        <Route path="/present" element={<PresentationMode />} />
        <Route path="/country/:id/present" element={<PresentationMode />} />
        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route path="/admin/platforms" element={<AdminRoute><PlatformManager /></AdminRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
      </Routes>
    </BrowserRouter>
  );
}
