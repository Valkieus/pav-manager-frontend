// Les exports PDF construisent du HTML à partir de données saisies (noms, remarques…).
// Juste après `container.innerHTML = ...`, on retire tout ce qui peut exécuter du code
// (balises script/iframe…, attributs on*, liens javascript:) avant que le navigateur ne le déclenche.
const BAD_TAGS = 'script,iframe,object,embed,link,meta,base,form,svg script';

export function sanitizeContainer(root) {
  if (!root || !root.querySelectorAll) return root;
  root.querySelectorAll(BAD_TAGS).forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      const name = a.name.toLowerCase();
      const val = String(a.value || '').trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') && /^(javascript|vbscript|data:text\/html)/.test(val))) {
        el.removeAttribute(a.name);
      }
    });
  });
  return root;
}

export const escapeHtml = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
