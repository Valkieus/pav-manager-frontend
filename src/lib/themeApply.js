// Application du thème clair / sombre.
// - appliqué avant la peinture (useLayoutEffect) et, au chargement, par le script de index.html : pas de flash ;
// - quand l'utilisateur bascule : fondu doux de toute la page (View Transitions API : un seul fondu, pas de « vague »),
//   ou, à défaut, une transition de même durée sur tous les éléments. Instantané si « réduire les animations » est activé.
const FADE_MS = 400;
let first = true;

export function applyTheme(theme) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#05080f' : '#e4e8f1');
  };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const same = root.classList.contains(theme);
  const initial = first;
  first = false;
  if (initial || same || reduce) { apply(); return; }
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(apply);
    return;
  }
  root.classList.add('theme-fade');
  apply();
  setTimeout(() => root.classList.remove('theme-fade'), FADE_MS + 60);
}

export function systemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
