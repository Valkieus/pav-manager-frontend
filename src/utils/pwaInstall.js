// Installation de l'app (PWA) — "ajouter à l'écran d'accueil" côté
// utilisateur. Sur Chrome/Edge/Android (desktop ET mobile), le navigateur
// émet un événement `beforeinstallprompt` qu'on intercepte ici et qu'on
// garde en mémoire pour pouvoir déclencher l'installation en un clic plus
// tard, depuis n'importe quel composant (le bouton dans Layout.js).
// L'événement peut arriver avant que React ne soit monté, donc ce module
// s'enregistre au chargement (importé tôt dans index.js) plutôt que dans un
// useEffect qui pourrait le manquer.
//
// Safari (iOS et macOS) ne supporte pas `beforeinstallprompt` du tout — il
// n'existe aucune API pour déclencher l'installation par code là-bas ; on
// ne peut qu'afficher les étapes manuelles ("Partager" > "Sur l'écran
// d'accueil" sur iOS, "Fichier" > "Ajouter au Dock" sur macOS Sonoma+).

let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb(deferredPrompt);
    } catch {
      // ignore listener errors
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

// Appelle `cb` immédiatement avec l'état courant, puis à chaque fois que
// l'événement beforeinstallprompt arrive/disparaît. Retourne une fonction
// de désabonnement.
export function subscribeInstallAvailability(cb) {
  listeners.add(cb);
  cb(deferredPrompt);
  return () => listeners.delete(cb);
}

// Déclenche le prompt natif (Chrome/Edge/Android). Retourne 'accepted',
// 'dismissed', ou null si aucun prompt n'était disponible.
export async function triggerInstallPrompt() {
  if (!deferredPrompt) return null;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  promptEvent.prompt();
  try {
    const choice = await promptEvent.userChoice;
    return choice?.outcome || null;
  } catch {
    return null;
  }
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator?.standalone === true // iOS Safari
  );
}

export function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSUA = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "MacIntel" with touch support — distinguish from
  // a real Mac, which has no touch points.
  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOSUA || isIPadOS;
}

export function isSafariDesktop() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMac = /Macintosh/.test(ua) && !isIOSDevice();
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
    ua,
  );
  return isMac && isSafari;
}
