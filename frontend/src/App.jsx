import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import FeatureGate from "./components/FeatureGate";
import SplashScreen from "./components/SplashScreen";
import ErrorBoundary from "./components/ErrorBoundary";
const Home = lazy(() => import("./pages/public/Home"));
const Login = lazy(() => import("./pages/public/Login"));
const Register = lazy(() => import("./pages/public/Register"));
const SurahList = lazy(() => import("./pages/quran/SurahList"));
const SurahReader = lazy(() => import("./pages/quran/SurahReader"));
const QuranRange = lazy(() => import("./pages/quran/QuranRange"));
const HadithCollections = lazy(() => import("./pages/hadith/HadithCollections"));
const HadithBooks = lazy(() => import("./pages/hadith/HadithBooks"));
const HadithList = lazy(() => import("./pages/hadith/HadithList"));
const HadithSearch = lazy(() => import("./pages/hadith/HadithSearch"));
const DuaCategories = lazy(() => import("./pages/duas/DuaCategories"));
const DuaList = lazy(() => import("./pages/duas/DuaList"));
const Qibla = lazy(() => import("./pages/qibla/Qibla"));
const Tasbeeh = lazy(() => import("./pages/tasbeeh/Tasbeeh"));
const Dashboard = lazy(() => import("./pages/user/Dashboard"));
const Prayer = lazy(() => import("./pages/user/Prayer"));
const Bookmarks = lazy(() => import("./pages/user/Bookmarks"));
const Progress = lazy(() => import("./pages/user/Progress"));
const Tafseer = lazy(() => import("./pages/tafseer/Tafseer"));
const Calendar = lazy(() => import("./pages/calendar/Calendar"));
const Search = lazy(() => import("./pages/search/Search"));
const Ramadan = lazy(() => import("./pages/ramadan/Ramadan"));
const Recitation = lazy(() => import("./pages/recitation/Recitation"));
const LiveRecitation = lazy(() => import("./pages/recitation/LiveRecitation"));
const Goals = lazy(() => import("./pages/user/Goals"));
const Notifications = lazy(() => import("./pages/user/Notifications"));
const Profile = lazy(() => import("./pages/user/Profile"));
const AdminPanel = lazy(() => import("./pages/admin/AdminPanel"));
const InfoPages = lazy(() => import("./pages/public/InfoPages"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Topics = lazy(() => import("./pages/topics/Topics"));
const Assistant = lazy(() => import("./pages/assistant/Assistant"));
const Feedback = lazy(() => import("./pages/feedback/Feedback"));

// Each page is loaded only when visited (code splitting = faster first load).
// MainLayout has its own Suspense around the page so the navbar stays visible while a page loads.

export default function App() {
  return (
    <Suspense fallback={<p role="status" className="text-center py-24 text-noor-textMuted">Loading…</p>}>
    {/* 3D logo loading screen (first visit of a page load). A crash in it must never block the site. */}
    <ErrorBoundary fallback={null} onError={() => { delete document.documentElement.dataset.splash; }}><SplashScreen /></ErrorBoundary>
    <Routes>
      <Route path="/admin" element={<div dir="ltr" lang="en" className="en-reset"><AdminPanel /></div>} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/quran" element={<SurahList />} />
        <Route path="/quran/:surahNumber" element={<SurahReader />} />
        <Route path="/quran/:type/:number" element={<QuranRange />} />

        <Route path="/hadith" element={<HadithCollections />} />
        <Route path="/hadith/search" element={<HadithSearch />} />
        <Route path="/hadith/:collection" element={<HadithBooks />} />
        <Route path="/hadith/:collection/:bookNumber" element={<HadithList />} />

        <Route path="/duas" element={<DuaCategories />} />
        <Route path="/duas/:category" element={<DuaList />} />
        <Route path="/qibla" element={<Qibla />} />
        <Route path="/tasbeeh" element={<Tasbeeh />} />
        <Route path="/prayer" element={<Prayer />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/progress" element={<Progress />} />

        <Route path="/goals" element={<Goals />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/ramadan" element={<FeatureGate feature="ramadanEnabled" name="Ramadan" nameKey="footer.ramadan"><Ramadan /></FeatureGate>} />
        <Route path="/recitation" element={<Recitation />} />
        <Route path="/recitation/live" element={<LiveRecitation />} />

        <Route path="/tafseer" element={<Tafseer />} />
        <Route path="/tafseer/:surah/:ayah" element={<Tafseer />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/search" element={<Search />} />
        <Route path="/about" element={<InfoPages />} />
        <Route path="/privacy" element={<InfoPages />} />
        <Route path="/terms" element={<InfoPages />} />
        <Route path="/contact" element={<InfoPages />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
