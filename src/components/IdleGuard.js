import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

// Verrouillage sur inactivité (hors compte tablette) : après 15 min sans
// activité on demande « Êtes-vous toujours là ? » ; sans réponse sous 1 min 30 la
// session est fermée et la connexion est redemandée.
const IDLE_MS = 15 * 60 * 1000;
const GRACE_S = 90;
const KEY = "pav_last_activity";
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

const readLast = () => {
  try { return Number(localStorage.getItem(KEY)) || Date.now(); } catch (e) { return Date.now(); }
};
const writeLast = (t) => {
  try { localStorage.setItem(KEY, String(t)); } catch (e) { /* ignore */ }
};

export default function IdleGuard() {
  const { logout } = useAuth();
  const [left, setLeft] = useState(null); // secondes restantes, null = pas d'alerte
  const warnedRef = useRef(false);
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    writeLast(Date.now());
    let lastWrite = 0;
    const touch = () => {
      if (warnedRef.current) return; // une fois l'alerte affichée, seul le bouton compte
      const now = Date.now();
      if (now - lastWrite > 2000) { lastWrite = now; writeLast(now); }
    };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const lock = () => {
      warnedRef.current = false;
      setLeft(null);
      logoutRef.current();
    };
    const tick = () => {
      const idle = Date.now() - readLast();
      if (idle >= IDLE_MS + GRACE_S * 1000) { lock(); return; }
      if (idle >= IDLE_MS) {
        warnedRef.current = true;
        setLeft(Math.max(0, Math.ceil((IDLE_MS + GRACE_S * 1000 - idle) / 1000)));
      }
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, []);

  const stay = () => {
    warnedRef.current = false;
    writeLast(Date.now());
    setLeft(null);
  };

  if (left === null) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
        <p className="text-lg font-semibold">Êtes-vous toujours là ?</p>
        <p className="text-sm text-muted-foreground">
          Sans réponse, la session sera verrouillée dans {left >= 60 ? `${Math.floor(left / 60)} min ${String(left % 60).padStart(2, "0")} s` : `${left} s`}.
        </p>
        <button
          onClick={stay}
          className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium w-full"
        >
          Je suis là
        </button>
      </div>
    </div>
  );
}
