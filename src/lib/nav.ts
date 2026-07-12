/**
 * Route registry shared by the sidebar, mobile nav, command palette and sitemap.
 * Kept dependency-free so shell chrome doesn't pull the data bundle.
 */

export interface NavEntry {
  label: string;
  to: string;
  sub: string;
  keywords: string;
}

export const pageEntries: NavEntry[] = [
  { label: "Home", to: "/", sub: "Personalized dashboard", keywords: "dashboard feed home start" },
  { label: "Intelligence", to: "/intelligence", sub: "AI analysis library", keywords: "intelligence articles reports previews best xi analysis library" },
  { label: "Match Center", to: "/matches", sub: "Live scores & analysis", keywords: "live matches scores xg" },
  { label: "News", to: "/news", sub: "AI-summarized football news", keywords: "news articles stories breaking" },
  { label: "Transfer Center", to: "/transfers", sub: "Rumors with probability", keywords: "transfers rumors market fees" },
  { label: "AI Predictions", to: "/predictions", sub: "Match outcome probabilities", keywords: "predictions odds probability betting" },
  { label: "AI Scout", to: "/scout", sub: "Natural-language player search", keywords: "scout search find players nlp" },
  { label: "Compare", to: "/compare", sub: "Head-to-head analysis", keywords: "compare head to head versus h2h" },
  { label: "Similar Players", to: "/similar", sub: "AI similarity engine", keywords: "similar players alike replacements" },
  { label: "Tactical Board", to: "/tactics", sub: "Formation builder", keywords: "tactics formation board drag" },
  { label: "Historical Explorer", to: "/history", sub: "Iconic matches & milestones", keywords: "history iconic classic retro" },
  { label: "Fantasy Assistant", to: "/fantasy", sub: "Captaincy & transfers", keywords: "fantasy fpl captain differentials" },
  { label: "Highlights", to: "/highlights", sub: "Short-form clips", keywords: "highlights clips videos goals" },
  { label: "Profile", to: "/profile", sub: "Preferences & watchlists", keywords: "profile settings account alerts" },
];

export const legalEntries: NavEntry[] = [
  { label: "About", to: "/about", sub: "What FootIQ is", keywords: "about mission company" },
  { label: "Contact", to: "/contact", sub: "Get in touch", keywords: "contact email support feedback" },
  { label: "Privacy Policy", to: "/privacy", sub: "How data is handled", keywords: "privacy policy data gdpr" },
  { label: "Terms of Service", to: "/terms", sub: "Rules of use", keywords: "terms service conditions legal" },
  { label: "Disclaimer", to: "/disclaimer", sub: "Demo & AI notice", keywords: "disclaimer demo ai betting notice" },
];
