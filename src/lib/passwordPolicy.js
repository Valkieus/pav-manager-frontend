// Politique de mots de passe : minimum recommandé par la CNIL (délibération n° 2022-100, mot de passe seul).
//   • 12 caractères minimum avec minuscule + majuscule + chiffre + caractère spécial, OU
//   • 14 caractères minimum avec minuscule + majuscule + chiffre (sans caractère spécial).
// Même règle que le serveur (qui reste l'autorité) : ici elle sert seulement à guider la saisie en direct.
export const MIN_FULL = 12;
export const MIN_NO_SPECIAL = 14;
export const MAX_BYTES = 72;

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FORBIDDEN = ['password', 'motdepasse', 'azerty', 'qwerty', 'qwertz', '123456', '654321', 'abcdef', '000000', '111111', 'bienvenue', 'welcome', 'letmein', 'iloveyou', 'charisma', 'pavmanager'];

const classes = (pw) => ({
  lower: /\p{Ll}/u.test(pw),
  upper: /\p{Lu}/u.test(pw),
  digit: /\d/.test(pw),
  special: /[^\p{L}\p{N}]/u.test(pw),
});

function trivial(flat) {
  if (new Set(flat).size <= 3) return true;
  let run = 1;
  for (let i = 1; i < flat.length; i += 1) {
    run = Math.abs(flat.charCodeAt(i) - flat.charCodeAt(i - 1)) === 1 ? run + 1 : 1;
    if (run >= 6) return true;
  }
  return false;
}

// Critères affichés un par un (ok = rempli). `ok` global = mot de passe accepté.
export function passwordCheck(pw, { username = '', fullName = '' } = {}) {
  const value = pw || '';
  const c = classes(value);
  const n = [...value].length;
  const core = c.lower && c.upper && c.digit;
  const lengthOk = (core && c.special && n >= MIN_FULL) || (core && n >= MIN_NO_SPECIAL);
  const flat = fold(value).replace(/[^a-z0-9]/g, '');
  const words = [username, ...String(fullName || '').split(/[\s\-']+/)].map((w) => fold(w).replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3);
  const tooLong = new TextEncoder().encode(value).length > MAX_BYTES;
  const items = [
    { key: 'len', label: `${MIN_FULL} caractères minimum`, ok: n >= MIN_FULL },
    { key: 'lower', label: 'une minuscule', ok: c.lower },
    { key: 'upper', label: 'une majuscule', ok: c.upper },
    { key: 'digit', label: 'un chiffre', ok: c.digit },
    { key: 'special', label: `un caractère spécial (ou ${MIN_NO_SPECIAL} caractères au total)`, ok: c.special || n >= MIN_NO_SPECIAL },
  ];
  const predictable = !!flat && (FORBIDDEN.some((p) => flat.includes(p)) || trivial(flat));
  const hasName = words.some((w) => flat.includes(w));
  return { ok: lengthOk && !predictable && !hasName && !tooLong && value.length > 0, items, predictable: lengthOk && predictable, hasName: lengthOk && hasName, tooLong };
}

export const isStrongPassword = (pw, who) => passwordCheck(pw, who).ok;

// Mot de passe aléatoire conforme (une lettre de chaque famille garantie).
export function generateStrongPassword(length = 16) {
  const pools = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '-_.!?#@+='];
  const pick = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const all = pools.join('');
  const out = pools.map(pick);
  while (out.length < Math.max(length, MIN_FULL)) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  const pw = out.join('');
  return isStrongPassword(pw) ? pw : generateStrongPassword(length);
}
