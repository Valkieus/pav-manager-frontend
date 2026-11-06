// Parc matériel (QR) : constantes et petits utilitaires partagés.
export const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

// Adresse écrite dans le QR : ouvre directement la fiche (le téléphone demande la connexion au besoin).
export const codeUrl = (code) => `${window.location.origin}/parc/${code}`;

// Le QR peut contenir l'adresse complète ; on n'en garde que le code.
export const extractCode = (raw) => {
  const s = String(raw || '').trim().split('?')[0].replace(/\/+$/, '').split('/').pop().toUpperCase().replace(/\s+/g, '');
  return s.startsWith('PAV') && !s.startsWith('PAV-') ? `PAV-${s.slice(3)}` : s;
};

export const fmtDT = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };

// Résultat d'une confirmation : libellé + couleurs (le vert/rouge se lit aussi grâce au texte et à l'icône).
export const RESULTS = {
  conforme: { label: 'N° de série conforme', tone: 'ok', hint: 'Le numéro lu correspond à la fiche.' },
  ecart: { label: 'Écart de n° de série', tone: 'bad', hint: "Le numéro lu ne correspond PAS à la fiche : vérifiez l'appareil et la fiche." },
  present: { label: 'Présence confirmée', tone: 'ok', hint: 'Matériel retrouvé (sans comparaison de n° de série).' },
  sans_reference: { label: 'N° lu (fiche sans n° de série)', tone: 'warn', hint: "La fiche n'a pas de n° de série : il n'a pas pu être comparé." },
};

export const TONES = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100',
  bad: 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100',
  warn: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100',
};
