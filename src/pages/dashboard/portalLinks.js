// Barre « Portail Charisma » : liens par défaut + personnalisation enregistrée par le Super Admin (libellé, adresse, ordre,
// activation, niveaux qui voient le lien). Les types spéciaux (led, academy, songs) gardent leur propre contrôle d'accès.
export const ALL_ROLES = ['Technicien', 'Responsable', 'Coordination', 'Admin (lecture seule)', 'Admin', 'Super Admin'];
const NOT_TECH = ALL_ROLES.filter((r) => r !== 'Technicien');

// tone : classes complètes (Tailwind ne génère que les classes écrites en toutes lettres).
export const TONES = {
  primary: { hover: 'hover:border-primary/50', bg: 'bg-primary/10', icon: 'text-primary', text: 'group-hover:text-primary' },
  red: { hover: 'hover:border-red-500/50', bg: 'bg-red-500/10', icon: 'text-red-500', text: 'group-hover:text-red-500' },
  purple: { hover: 'hover:border-purple-500/50', bg: 'bg-purple-500/10', icon: 'text-purple-500', text: 'group-hover:text-purple-500' },
  emerald: { hover: 'hover:border-emerald-500/50', bg: 'bg-emerald-500/10', icon: 'text-emerald-600', text: 'group-hover:text-emerald-600' },
  amber: { hover: 'hover:border-amber-500/50', bg: 'bg-amber-500/10', icon: 'text-amber-600', text: 'group-hover:text-amber-600' },
  violet: { hover: 'hover:border-violet-500/50', bg: 'bg-violet-500/10', icon: 'text-violet-600', text: 'group-hover:text-violet-600' },
  sky: { hover: 'hover:border-sky-500/50', bg: 'bg-sky-500/10', icon: 'text-sky-600', text: 'group-hover:text-sky-600' },
  yellow: { hover: 'hover:border-yellow-500/50', bg: 'bg-yellow-500/10', icon: 'text-yellow-600', text: 'group-hover:text-yellow-600' },
};

export const DEFAULT_LINKS = [
  { id: 'site', label: 'Site Web Charisma', subtitle: 'www.charisma.fr', url: 'https://www.charisma.fr/', kind: 'url', roles: [], enabled: true, icon: 'globe', tone: 'primary' },
  { id: 'tv', label: 'Charisma TV', subtitle: '@CHARISMATV1', url: 'https://www.youtube.com/@CHARISMATV1', kind: 'url', roles: [], enabled: true, icon: 'youtube', tone: 'red' },
  { id: 'acadarts', label: 'Académie des Arts', subtitle: 'acadarts.charisma.fr', url: 'https://acadarts.charisma.fr/', kind: 'url', roles: NOT_TECH, enabled: true, icon: 'palette', tone: 'purple' },
  { id: 'academy', label: 'PAV Academy', subtitle: 'Formation & examens', url: '', kind: 'academy', roles: [], enabled: true, icon: 'award', tone: 'emerald' },
  { id: 'led', label: 'PAV LED', subtitle: 'Éléments visuels', url: '', kind: 'led', roles: [], enabled: true, icon: 'lightbulb', tone: 'yellow' },
  { id: 'songs', label: 'CEC Songs', subtitle: 'Connexion avec PAV Manager', url: '', kind: 'songs', roles: NOT_TECH, enabled: true, icon: 'music', tone: 'amber' },
  { id: 'songspot', label: 'SongSpot', subtitle: 'songspot-cec.netlify.app', url: 'https://songspot-cec.netlify.app/', kind: 'url', roles: NOT_TECH, enabled: true, icon: 'music', tone: 'violet' },
  { id: 'bible', label: 'Recherche Biblique', subtitle: 'quick-bible-search.netlify.app', url: 'https://quick-bible-search.netlify.app/', kind: 'url', roles: [], enabled: true, icon: 'book', tone: 'sky' },
];
const BY_ID = Object.fromEntries(DEFAULT_LINKS.map((d) => [d.id, d]));

// Liste complète (éditable) : configuration enregistrée dans l'ordre choisi ; un lien par défaut absent de la configuration
// (par exemple ajouté après coup) est ajouté à la fin, activé.
export function mergeLinks(stored) {
  if (!Array.isArray(stored)) return DEFAULT_LINKS.map((d) => ({ ...d }));
  const out = stored.map((s) => {
    const d = BY_ID[s.id] || {};
    return { icon: 'globe', tone: 'primary', ...d, ...s };
  });
  const have = new Set(out.map((l) => l.id));
  DEFAULT_LINKS.forEach((d) => { if (!have.has(d.id)) out.push({ ...d }); });
  return out;
}

// Liens affichés pour cette personne : activés, niveau autorisé, et accès réel pour les types spéciaux.
export function visibleLinks(links, { niveau, hasAcademyAccess, hasLedAccess }) {
  return links.filter((l) => {
    if (!l.enabled) return false;
    if ((l.roles || []).length > 0 && !l.roles.includes(niveau)) return false;
    if (l.kind === 'academy' && !hasAcademyAccess) return false;
    if (l.kind === 'led' && !hasLedAccess) return false;
    return true;
  });
}
