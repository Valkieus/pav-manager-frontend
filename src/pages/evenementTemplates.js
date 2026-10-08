// Modèles de plannings événements — repris à l'identique des trois feuilles
// du classeur PLANNING_PAV_2026 (ONE SOUND, Festival des enfants, Festival
// des jeunes) : une colonne « AFFECTATION » avec les postes, une ou plusieurs
// colonnes de dates/moments, les catégories Régie / Cadreurs / Régisseurs /
// Diffusion et, comme sur la feuille, l'en-tête répété avant les régisseurs.

export function slugify(label) {
  return (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `role_${Math.random().toString(36).slice(2, 7)}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDateLong(iso) {
  const s = new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Une colonne est { date: 'YYYY-MM-DD', label: 'texte libre' }. Dans la
// base, la colonne est identifiée par sa date ; une 2e colonne le même jour
// reçoit le suffixe « ~2 » (Spectacle + Concert le même soir, par exemple).
export function colsToIds(cols) {
  const seen = {};
  return cols.map((c) => {
    seen[c.date] = (seen[c.date] || 0) + 1;
    return seen[c.date] === 1 ? c.date : `${c.date}~${seen[c.date]}`;
  });
}

export function idsToCols(ids, colLabels) {
  return (ids || []).map((id) => ({ date: String(id).slice(0, 10), label: (colLabels || {})[id] || '' }));
}

const reg = (n) => ({ key: '', label: n, slots: 1 });

function regieRoles() {
  return [
    { label: 'Réalisateur', slots: 1 },
    { label: 'Assistant réalisateur / truquiste', slots: 1 },
    { label: 'Opérateur VDO A', slots: 1 },
    { label: 'Opérateur VDO B', slots: 1 },
    { label: 'Opérateur Incrustation A', slots: 1 },
    { label: 'Opérateur Incrustation B', slots: 1 },
    { label: 'Opérateur Incrustation C', slots: 1 },
    { label: 'Animateur VDO / VFX', slots: 1 },
    { label: 'Animateur VDO / VFX', slots: 1 },
  ];
}

function cameraRoles(count, doubleUntil) {
  // Comme sur la feuille : chaque caméra a 2 lignes (principal + assistant),
  // les dernières caméras n'en ont qu'une.
  return Array.from({ length: count }, (_, i) => ({
    label: `Caméra ${i + 1}`,
    slots: i + 1 <= doubleUntil ? 2 : 1,
  }));
}

function posteRoles(n) {
  return [reg('Supervision'), ...Array.from({ length: n }, (_, i) => reg(`Poste ${i + 1}`))];
}

function diffusionRoles(annexes) {
  return [
    reg('Supervision'),
    reg('Sanctuaire'), reg('Sanctuaire'), reg('Sanctuaire'),
    ...(annexes ? [reg('Salle Annexe 1'), reg('Salle Annexe 2')] : []),
    reg('Poly 3'),
    reg('Gymnase'),
  ];
}

// Chaque modèle liste ses catégories ; `id` permet au popup de proposer de
// cocher/décocher une catégorie avant la création.
export const EVENT_TEMPLATES = [
  {
    key: 'one_sound',
    nom: 'ONE SOUND',
    description: 'Une seule colonne (date) — régie, 7 caméras, régisseurs, diffusion.',
    titre: 'ONE SOUND',
    rdv: '',
    colonnes: [{ label: '' }],
    cameras: { count: 7, doubleUntil: 7 },
    postes: 6,
    annexes: true,
  },
  {
    key: 'festival_enfants',
    nom: 'Festival des enfants',
    description: 'Deux colonnes (Spectacle des enfants, Concert) — 7 caméras, 3 postes régie.',
    titre: 'FESTIVAL DES ENFANTS',
    rdv: 'RDV en salle 114',
    colonnes: [{ label: 'Spectacle des enfants' }, { label: 'Concert' }],
    cameras: { count: 7, doubleUntil: 7 },
    postes: 3,
    annexes: false,
  },
  {
    key: 'festival_jeunes',
    nom: 'Festival des jeunes',
    description: 'Deux colonnes (Ouverture/Prédication, Concert) — 8 caméras, 4 postes régie.',
    titre: 'FESTIVAL DES JEUNES',
    rdv: 'RDV à 13h00 en salle 114',
    colonnes: [{ label: 'Ouverture : \nPrédication : ' }, { label: 'Concert : ' }],
    cameras: { count: 8, doubleUntil: 5 },
    postes: 4,
    annexes: true,
  },
];

export const CATEGORIES = [
  { id: 'regie', name: 'REGIE' },
  { id: 'cadreurs', name: 'CADREURS' },
  { id: 'regisseurs', name: 'REGISSEURS' },
  { id: 'diffusion', name: 'DIFFUSION' },
];

// Construit { sections, roles } à partir d'un modèle + des choix du popup
// (catégories cochées, nombre de caméras, postes…). Les clés de rôle sont
// uniques (deux « Sanctuaire » → sanctuaire, sanctuaire_2…).
export function buildStructure(tpl, opts = {}) {
  const inc = opts.categories || { regie: true, cadreurs: true, regisseurs: true, diffusion: true };
  const camCount = opts.cameras ?? tpl.cameras.count;
  const camDouble = opts.camerasDoubles ?? tpl.cameras.doubleUntil;
  const posteCount = opts.postes ?? tpl.postes;
  const defs = [
    { key: 'supervision', name: 'SUPERVISION', standalone: true, roles: [reg('Supervision')], on: inc.regie },
    { key: 'regie', name: 'REGIE', roles: regieRoles(), on: inc.regie },
    { key: 'cadreurs', name: 'CADREURS', roles: cameraRoles(camCount, camDouble), on: inc.cadreurs },
    { key: 'regisseurs', name: 'REGISSEURS', repeat_header: true, roles: posteRoles(posteCount), on: inc.regisseurs },
    { key: 'diffusion', name: 'DIFFUSION', roles: diffusionRoles(tpl.annexes), on: inc.diffusion },
  ].filter((d) => d.on);
  return structureFromDefs(defs);
}

function structureFromDefs(defs) {
  const used = {};
  const sections = [];
  const roles = [];
  defs.forEach((d, si) => {
    const skey = `${d.key || slugify(d.name)}_${si}`;
    sections.push({
      key: skey, name: d.name,
      ...(d.standalone ? { standalone: true } : {}),
      ...(d.repeat_header ? { repeat_header: true } : {}),
    });
    d.roles.forEach((r) => {
      const base = slugify(r.label);
      used[base] = (used[base] || 0) + 1;
      roles.push({
        key: used[base] === 1 ? base : `${base}_${used[base]}`,
        label: r.label,
        slots: r.slots || 1,
        section: skey,
      });
    });
  });
  return { sections, roles };
}

// Reprend la structure du planning vendredi / dimanche en cours
// (sections.table1 + table2) comme point de départ d'un planning événement.
export function structureFromMainPlanning(sectionsOfDay) {
  const defs = [];
  [['table1', false], ['table2', true]].forEach(([tk, rep]) => {
    (sectionsOfDay?.[tk] || []).forEach((s, i) => {
      defs.push({
        key: slugify(s.name),
        name: s.name,
        standalone: !!s.standalone,
        repeat_header: rep && i === 0,
        roles: (s.roles || []).map((r) => ({ label: r.label, slots: r.slots || 1 })),
      });
    });
  });
  return structureFromDefs(defs);
}

export function emptyStructure() {
  return structureFromDefs([{ key: 'poste', name: '', standalone: true, roles: [] }]);
}

// Regroupe les rôles à plat par catégorie, dans l'ordre. Les anciens
// plannings (sans `sections`) tombent dans une catégorie unique sans titre.
export function groupRoles(sections, roles) {
  const secs = sections && sections.length
    ? sections
    : [{ key: '__legacy', name: '', standalone: true }];
  const firstKey = secs[0].key;
  const known = new Set(secs.map((s) => s.key));
  return secs.map((s) => ({
    ...s,
    roles: roles.filter((r) => (known.has(r.section) ? r.section : firstKey) === s.key),
  }));
}
