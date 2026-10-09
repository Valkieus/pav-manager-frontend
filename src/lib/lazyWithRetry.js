import { lazy } from "react";

// Après chaque déploiement Netlify, les fichiers JS « chunks » d'une page
// changent de nom. Un onglet resté ouvert (ou un cache de service worker)
// qui tente de charger l'ancien chunk obtient « Loading chunk … failed » et
// la page plante. Ces utilitaires détectent ce cas précis et rechargent
// l'application une seule fois (sans boucle) pour récupérer la nouvelle version.
const KEY = "pav_chunk_reload_at";
const COOLDOWN_MS = 30000;

export function isChunkError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  return (
    err.name === "ChunkLoadError" ||
    /Loading (CSS )?chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

// Renvoie true si un rechargement vient d'être lancé, false si on en a déjà
// fait un il y a moins de 30 s (on laisse alors l'erreur s'afficher plutôt que
// de boucler indéfiniment).
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (e) {
    // sessionStorage indisponible : on tente quand même un seul rechargement
  }
  const done = () => window.location.reload();
  const clean = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const names = await window.caches.keys();
        await Promise.all(names.map((n) => window.caches.delete(n)));
      }
    } catch (e) {
      // best effort
    }
  };
  Promise.race([clean(), new Promise((r) => setTimeout(r, 1500))]).then(done, done);
  return true;
}

export default function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkError(err) && reloadForNewVersion()) {
        // Reste sur l'écran de chargement le temps du rechargement.
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
