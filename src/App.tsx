import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig, motion } from "motion/react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { MobileNav } from "@/components/shell/MobileNav";
import { ChatDock } from "@/components/shell/ChatDock";
import { Onboarding, shouldShowOnboarding } from "@/components/shell/Onboarding";
import { useHotkey, usePrefersReducedMotion } from "@/lib/hooks";
import { EASE_OUT } from "@/lib/motion";
import { trackPageView } from "@/lib/analytics";
import { bump } from "@/lib/metrics";
import { AuthProvider, RequireAuth } from "@/lib/auth/AuthContext";

const Home = lazy(() => import("@/pages/Home"));
const Intelligence = lazy(() => import("@/pages/Intelligence"));
const IntelligenceArticle = lazy(() => import("@/pages/IntelligenceArticle"));
const Manager = lazy(() => import("@/pages/Manager"));
const PredictionDetail = lazy(() => import("@/pages/PredictionDetail"));
const HistoryMoment = lazy(() => import("@/pages/HistoryMoment"));
const Insights = lazy(() => import("@/pages/Insights"));
const Matches = lazy(() => import("@/pages/Matches"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const MatchCenter = lazy(() => import("@/pages/MatchCenter"));
const News = lazy(() => import("@/pages/News"));
const PlayerPage = lazy(() => import("@/pages/Player"));
const SimilarPlayers = lazy(() => import("@/pages/SimilarPlayers"));
const Compare = lazy(() => import("@/pages/Compare"));
const TeamPage = lazy(() => import("@/pages/Team"));
const Transfers = lazy(() => import("@/pages/Transfers"));
const Predictions = lazy(() => import("@/pages/Predictions"));
const Scout = lazy(() => import("@/pages/Scout"));
const TacticalBoard = lazy(() => import("@/pages/TacticalBoard"));
const Fantasy = lazy(() => import("@/pages/Fantasy"));
const History = lazy(() => import("@/pages/History"));
const Profile = lazy(() => import("@/pages/Profile"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Disclaimer = lazy(() => import("@/pages/Disclaimer"));
const NotFound = lazy(() => import("@/pages/NotFound"));
// palette carries the search index (players/teams/news) — load it on first open, not at boot
const CommandPalette = lazy(() => import("@/components/shell/CommandPalette").then((m) => ({ default: m.CommandPalette })));

function Shell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = usePrefersReducedMotion();
  useHotkey("k", true, () => openSearch());

  // first visit: open the tour once the page has settled; afterwards any part
  // of the app can re-launch it via the "footiq:tour" event (TopBar ?, /about)
  useEffect(() => {
    const openTour = () => setTourOpen(true);
    window.addEventListener("footiq:tour", openTour);
    const timer = shouldShowOnboarding() ? setTimeout(openTour, 900) : undefined;
    return () => {
      window.removeEventListener("footiq:tour", openTour);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const openSearch = () => {
    setPaletteMounted(true);
    setSearchOpen(true);
  };

  // new page starts at the top; instant to stay out of the route transition's way
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
    bump("entity_view", location.pathname);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-skip focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-ui focus:font-semibold focus:text-[#04110c]"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="lg:pl-60">
        <TopBar onOpenSearch={openSearch} />
        <Suspense
          fallback={
            <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
              <div className="size-8 animate-[spin-slow_1.1s_linear_infinite] rounded-full border-2 border-line-strong border-t-accent" />
            </div>
          }
        >
          {/* enter-only fade: no exit, so the previous page never blanks out first */}
          <motion.main
            id="main"
            tabIndex={-1}
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: EASE_OUT }}
            className="mx-auto max-w-7xl px-4 pb-32 pt-6 outline-none md:px-6 lg:pb-16"
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/match/:id" element={<MatchCenter />} />
              <Route path="/matches/:id" element={<MatchCenter />} />
              <Route path="/news" element={<News />} />
              {/* Demo articles (invented quotes about real people) are retired; old links land on real news. */}
              <Route path="/news/:id" element={<Navigate to="/news" replace />} />
              <Route path="/player/:id" element={<PlayerPage />} />
              <Route path="/players/:id" element={<PlayerPage />} />
              <Route path="/similar" element={<SimilarPlayers />} />
              <Route path="/similar/:id" element={<SimilarPlayers />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/team/:id" element={<TeamPage />} />
              <Route path="/teams/:id" element={<TeamPage />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/predictions/:slug" element={<PredictionDetail />} />
              <Route path="/scout" element={<Scout />} />
              <Route path="/tactics" element={<TacticalBoard />} />
              <Route path="/fantasy" element={<Fantasy />} />
              <Route path="/highlights" element={<Navigate to="/" replace />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:slug" element={<HistoryMoment />} />
              <Route path="/intelligence" element={<Intelligence />} />
              <Route path="/intelligence/:slug" element={<IntelligenceArticle />} />
              <Route path="/managers/:slug" element={<Manager />} />
              <Route path="/insights" element={<Insights />} />
              {/* Protected when auth is configured; open in demo mode. */}
              <Route
                path="/profile"
                element={
                  <RequireAuth fallback={<Navigate to="/signin?next=/profile" replace />}>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.main>
        </Suspense>
      </div>
      <MobileNav />
      <ChatDock />
      <Onboarding open={tourOpen} onClose={() => setTourOpen(false)} />
      {paletteMounted && (
        <Suspense fallback={null}>
          <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* reducedMotion="user" drops transform/layout animation; opacity fades still need their own guard */}
        <MotionConfig reducedMotion="user">
          <Shell />
        </MotionConfig>
      </BrowserRouter>
    </AuthProvider>
  );
}
