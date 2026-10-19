import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useRadar } from "../lib/data";
import { DEV_CHAT_URL } from "../lib/config";

const LINKS = [
  ["/", "רדאר"],
  ["/briefing", "תדריך"],
  ["/archive", "ארכיון"],
  ["/saved", "שמורות"],
  ["/topics", "נושאים והגדרות"],
];

export default function TopBar() {
  const { notify } = useRadar();
  const [installEvt, setInstallEvt] = useState(null);
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // On narrow screens the nav scrolls sideways; keep the current page in view.
  useEffect(() => {
    document.querySelector(".nav-link.is-active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("הקישור הועתק", "ok");
      setMenuOpen(false);
    } catch {
      notify("לא הצלחתי להעתיק", "error");
    }
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    setInstallEvt(null);
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label="רדאר, לדף הבית">
          <img src="/icons/icon.svg" alt="" width="30" height="30" />
          <span className="brand-name">רדאר</span>
          <span className="brand-tag mono">אקטואליה</span>
        </Link>
        <nav className="nav" aria-label="ניווט ראשי">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        {/* System buttons live behind Anat's signature logo. */}
        <div className="signature" ref={menuRef}>
          <button
            className={`signature-btn${menuOpen ? " is-open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="signature-text">
              <span className="signature-title mono">אד׳</span>
              <span className="signature-name">ענת שטיבלמן</span>
            </span>
            <span className="signature-mark" aria-hidden="true">עש</span>
            {installEvt && <span className="signature-dot" aria-hidden="true" />}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="signature-menu glass"
                role="menu"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18 }}
              >
                <div className="signature-menu-head">
                  <span className="signature-mark signature-mark-lg" aria-hidden="true">עש</span>
                  <div>
                    <div className="signature-menu-name">אד׳ ענת שטיבלמן</div>
                    <div className="mono muted">רדאר · אקטואליה</div>
                  </div>
                </div>
                <button role="menuitem" className="menu-item" onClick={copy}>העתקת קישור</button>
                <a role="menuitem" className="menu-item" href={DEV_CHAT_URL} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>שיחת הפיתוח</a>
                {installEvt && <button role="menuitem" className="menu-item menu-item-accent" onClick={install}>התקנת האפליקציה</button>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
