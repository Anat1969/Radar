import { AnimatePresence, motion } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import Toast from "./components/Toast";
import Home from "./pages/Home";
import Topic from "./pages/Topic";
import Briefing from "./pages/Briefing";
import Archive from "./pages/Archive";
import Saved from "./pages/Saved";
import Topics from "./pages/Topics";
import NotFound from "./pages/NotFound";
import { useRadar } from "./lib/data";

export default function App() {
  const location = useLocation();
  const { error, load } = useRadar();
  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <TopBar />
      <main className="main">
        {error && (
          <div className="state state-error" role="alert">
            <span className="mono">שגיאת חיבור</span>
            <p>לא הצלחתי לטעון את הנתונים: {error}</p>
            <button className="btn" onClick={load}>נסיון נוסף</button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/topic/:id" element={<Topic />} />
              <Route path="/briefing" element={<Briefing />} />
              <Route path="/archive" element={<Archive />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/topics" element={<Topics />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Toast />
    </div>
  );
}
