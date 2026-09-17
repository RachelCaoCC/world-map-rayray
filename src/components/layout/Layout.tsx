import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "./TopBar";
import { useAuth } from "../../hooks/useAuth";
import { LoginPage } from "../../pages/LoginPage";

interface LayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
}

export function Layout({ children, showBack, backTo }: LayoutProps) {
  const { user, loading, isAdmin } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-4">
            You don't have permission to access this dashboard. Please contact an administrator.
          </p>
          <button
            onClick={() => {
              import("../../lib/supabase").then(({ supabase }) => supabase.auth.signOut());
            }}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Sign out and try another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col bg-slate-100">
      <TopBar showBack={showBack} backTo={backTo} />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      <footer className="hidden bg-white border-t border-slate-200 px-6 py-3 sm:block">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
