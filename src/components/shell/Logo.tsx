import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="FootIQ home">
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden className="transition-transform duration-300 group-hover:rotate-90">
        <rect width="64" height="64" rx="16" fill="var(--surface-3)" />
        <circle cx="32" cy="32" r="17" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <path d="M32 15v10M32 39v10M15 32h10M39 32h10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="32" r="5.5" fill="var(--iq)" />
      </svg>
      {!compact && (
        <span className="display text-lg font-black tracking-tight text-ink">
          Foot<span className="text-accent-ink">IQ</span>
        </span>
      )}
    </Link>
  );
}
