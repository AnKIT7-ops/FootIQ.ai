import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import {
  LayoutDashboard, Radio, Newspaper, ArrowLeftRight, Sparkles, Search,
  GitCompareArrows, Users, ClipboardList, Landmark, Trophy, Clapperboard, UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const groups: Array<{ title: string; items: Array<{ to: string; label: string; icon: typeof Radio }> }> = [
  {
    title: "Follow",
    items: [
      { to: "/", label: "Home", icon: LayoutDashboard },
      { to: "/matches", label: "Match Center", icon: Radio },
      { to: "/news", label: "News", icon: Newspaper },
      { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
      { to: "/highlights", label: "Highlights", icon: Clapperboard },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/predictions", label: "Predictions", icon: Sparkles },
      { to: "/scout", label: "AI Scout", icon: Search },
      { to: "/compare", label: "Compare", icon: GitCompareArrows },
      { to: "/similar", label: "Similar Players", icon: Users },
      { to: "/tactics", label: "Tactical Board", icon: ClipboardList },
      { to: "/history", label: "Historical", icon: Landmark },
    ],
  },
  {
    title: "You",
    items: [
      { to: "/fantasy", label: "Fantasy", icon: Trophy },
      { to: "/profile", label: "Profile", icon: UserRound },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-bg-deep/60 backdrop-blur-sm lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2" aria-label="Primary">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="eyebrow mb-1.5 px-3">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
                        isActive ? "text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink-2",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute inset-0 rounded-xl bg-surface-3"
                            transition={{ type: "spring", stiffness: 480, damping: 38 }}
                          />
                        )}
                        <item.icon className={cn("relative z-10 size-4", isActive && "text-accent-ink")} aria-hidden />
                        <span className="relative z-10">{item.label}</span>
                        {isActive && <span className="absolute left-0 top-1/2 z-10 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden />}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line px-5 py-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
            { to: "/privacy", label: "Privacy" },
            { to: "/terms", label: "Terms" },
            { to: "/disclaimer", label: "Disclaimer" },
          ].map((l) => (
            <NavLink key={l.to} to={l.to} className="font-mono text-[9.5px] uppercase tracking-wider text-ink-3 transition-colors hover:text-ink-2">
              {l.label}
            </NavLink>
          ))}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">FootIQ · Beta · Demo data</p>
      </div>
    </aside>
  );
}
