"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CommandPaletteTrigger } from "@/components/CommandPaletteTrigger";
import {
  Sparkles,
  LayoutDashboard,
  Database,
  ArrowLeftRight,
  BookOpen,
  Shield,
  Menu,
  X,
  Compass,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Advisor", icon: Sparkles },
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/explorer", label: "Explorer", icon: Compass },
  { href: "/models", label: "Models", icon: Database },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
  { href: "/methodology", label: "How it works", icon: BookOpen },
  { href: "/privacy", label: "Privacy", icon: Shield },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = pathname === "/";

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="hidden lg:flex lg:w-[240px] lg:shrink-0 lg:flex-col relative">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-violet-500/30 via-white/[0.04] to-transparent" />

        <div className="flex h-full flex-col bg-[#08081a]/90 backdrop-blur-xl">
          {/* Logo */}
          <div className="px-5 pt-6 pb-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-1 ring-white/10">
                  <span className="text-[13px] font-black text-white">N</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#08081a]" />
              </div>
              <div>
                <p className="text-[15px] font-black text-white tracking-tight">NexusRoute</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400/60">AI Routing</p>
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? "bg-violet-500/12 text-white border border-violet-500/20"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
                  }`}>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    active ? "bg-violet-500/20" : "bg-white/[0.03] group-hover:bg-white/[0.06]"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"}`} />
                  </div>
                  {item.label}
                  {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4">
            <div className="rounded-xl bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/10 p-3 text-center">
              <p className="text-[10px] font-bold text-zinc-400">Free &middot; No keys &middot; 100% local</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MOBILE ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-full w-[260px] flex-col bg-[#08081a]">
            <div className="flex h-14 items-center justify-between px-4">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white">N</div>
                <span className="text-sm font-black text-white">NexusRoute</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${active ? "bg-violet-500/12 text-white" : "text-zinc-500"}`}>
                    <Icon className={`h-4 w-4 ${active ? "text-violet-400" : "text-zinc-600"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* ── MAIN ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-white/[0.04] bg-[#050510]/80 backdrop-blur-2xl px-4 lg:px-6">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-zinc-400 hover:text-white lg:hidden"><Menu className="h-5 w-5" /></button>
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white">N</div>
            <span className="text-[13px] font-black text-white">NexusRoute</span>
          </Link>
          <div className="flex-1" />
          <CommandPaletteTrigger />
          <Link href="/"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-[11px] font-bold text-white shadow-lg shadow-violet-600/20 ring-1 ring-white/10 hover:brightness-110 transition-all">
            <Sparkles className="h-3.5 w-3.5" /> Try Advisor
          </Link>
        </header>

        <main className="flex-1">
          <div className={`mx-auto px-5 py-10 sm:px-6 lg:px-10 ${isHome ? "max-w-[1400px]" : "max-w-[1200px]"}`}>
            {children}
          </div>
        </main>

        <footer className="border-t border-white/[0.04] py-5">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 text-[11px] text-zinc-600">
            <span>NexusRoute &copy; {new Date().getFullYear()}</span>
            <div className="flex gap-4">
              <Link href="/methodology" className="hover:text-violet-400 transition-colors">Methodology</Link>
              <Link href="/privacy" className="hover:text-violet-400 transition-colors">Privacy</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
