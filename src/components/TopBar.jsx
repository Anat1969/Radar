import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { DEV_CHAT_URL } from "../lib/config";

const LINKS = [
  ["/", "רדאר"],
  ["/briefing", "תדריך"],
  ["/archive", "ארכיון"],
  ["/saved", "שמורות"],
  ["/topics", "נושאים והגדרות"],
];

export default function TopBar() {
  const { pathname } = useLocation();

  // On narrow screens the nav scrolls sideways; keep the current page in view.
  useEffect(() => {
    document.querySelector(".nav-link.is-active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

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
        {/* A&I logo button: copy link, dev chat, install (https://appofapp-gh.vercel.app/ai-menu.js) */}
        <div className="signature">
          <ai-menu chat={DEV_CHAT_URL} />
        </div>
      </div>
    </header>
  );
}
