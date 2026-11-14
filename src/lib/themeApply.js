// Application du thème clair / sombre.
// - appliqué avant la peinture (useLayoutEffect) : pas de flash ni de « saut » après le rendu ;
// - les transitions CSS sont suspendues pendant le basculement, sinon chaque élément se fond à son rythme
//   (effet de vague, saccades sur les grandes pages) ; elles reprennent 2 images plus tard.
export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#05080f' : '#e4e8f1');
  void root.offsetHeight; // force le recalcul des styles avec les transitions coupées
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
}

export function systemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
