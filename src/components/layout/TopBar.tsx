import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export function TopBar({ showBack, backTo }: { showBack?: boolean; backTo?: string }) {
  const location = useLocation();
  const isHome = location.pathname === "/map";
  const isReport = location.pathname === "/report";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="min-h-14 bg-primary flex items-center justify-between gap-2 px-3 py-2 shadow-lg z-50 sm:h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {showBack && backTo && (
          <Link
            to={backTo}
            className="shrink-0 text-white/70 hover:text-white transition-colors text-xs sm:mr-2 sm:text-sm"
          >
            ← Back
          </Link>
        )}
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent sm:flex">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <h1 className="truncate text-sm font-semibold text-white sm:text-lg">
          {isHome ? "Global Social Media Dashboard" : isReport ? "Global Report" : "Accounts Dashboard"}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {isHome && (
          <Link
            to="/report"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-2 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:px-3"
            title="Open global analysis report"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
            </svg>
            <span className="hidden md:inline">Global Report</span>
          </Link>
        )}

        {isHome && (
          <Link
            to="/present"
            className="hidden text-white/70 transition-colors hover:text-white sm:block"
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
          className="text-white/70 transition-colors hover:text-white"
          title="Platform Management"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        <button className="relative hidden text-white/70 transition-colors hover:text-white sm:block" aria-label="Notifications">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-negative rounded-full" />
        </button>

        <div className="relative group">
          <button className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10">
            <span>Admin</span>
            <svg className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          <div className="invisible absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-slate-200 bg-white py-1 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
