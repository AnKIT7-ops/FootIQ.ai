import { Link } from "react-router-dom";

// The kickoff mark: the centre circle split by the halfway line. Emerald half = what was
// measured, amber half = what the model inferred. Keep public/favicon.svg and scripts/og.mjs in sync.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="FootIQ home">
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="16" fill="var(--surface-3)" />
        <path d="M32 14a18 18 0 0 0 0 36" fill="none" stroke="var(--accent)" strokeWidth="6" />
        <path d="M32 14a18 18 0 0 1 0 36" fill="none" stroke="var(--iq)" strokeWidth="6" />
        <path d="M32 0v64" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="32" cy="32" r="4.5" fill="var(--ink)" />
      </svg>
      {!compact && (
        <span className="display text-lg font-black tracking-tight text-ink">
          Foot<span className="text-iq-ink">IQ</span>
        </span>
      )}
    </Link>
  );
}
