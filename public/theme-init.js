/* Thème appliqué avant la première peinture : pas de flash clair en mode sombre.
   Fichier externe car la politique de sécurité du site interdit les scripts inline. */
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'dark' && t !== 'light') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var r = document.documentElement;
    r.classList.add(t);
    r.style.colorScheme = t;
  } catch (e) {}
})();
