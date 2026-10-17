import { useEffect, useState } from "react";
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
        <div className="bar-actions">
          {installEvt && <button className="chip chip-accent" onClick={install}>התקנת האפליקציה</button>}
          <button className="chip" onClick={copy}>העתקת קישור</button>
          <a className="chip" href={DEV_CHAT_URL} target="_blank" rel="noreferrer">שיחת הפיתוח</a>
        </div>
      </div>
    </header>
  );
}
