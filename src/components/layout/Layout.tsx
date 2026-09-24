import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
}

export function Layout({ children, showBack, backTo }: LayoutProps) {
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
