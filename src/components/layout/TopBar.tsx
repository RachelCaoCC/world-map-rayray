import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

export function TopBar({ showBack, backTo }: { showBack?: boolean; backTo?: string }) {
  const location = useLocation();
  const isHome = location.pathname === "/map";
  const isReport = location.pathname === "/report";
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "A";
  const userName = user?.email?.split("@")[0] ?? "Admin";

  return (
    <header className="h-16 bg-primary flex items-center justify-between px-6 shadow-lg z-50">
      <div className="flex items-center gap-3">
        {showBack && backTo && (
          <Link
            to={backTo}
            className="text-white/70 hover:text-white transition-colors text-sm mr-2"
          >
            ← Back
          </Link>
        )}
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <h1 className="text-white font-semibold text-lg">
          {isHome ? "Global Social Media Dashboard" : isReport ? "Global Report" : "Accounts Dashboard"}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {isHome && (
          <Link
            to="/report"
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            title="Open global analysis report"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
            </svg>
            Global Report
          </Link>
        )}

        {isHome && (
          <Link
            to="/present"
            className="text-white/70 hover:text-white transition-colors"
            title="Start global live presentation"
            aria-label="Start global live presentation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
            </svg>
          </Link>
        )}

        <Link
          to="/admin/platforms"
          className="text-white/70 hover:text-white transition-colors"
          title="Platform Management"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        <button className="text-white/70 hover:text-white transition-colors relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-negative rounded-full" />
        </button>

        <div className="relative group">
          <button className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-accent-dark rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-medium">{userInitial}</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-white text-sm font-medium">{userName}</p>
              <p className="text-white/60 text-xs">Administrator</p>
            </div>
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
