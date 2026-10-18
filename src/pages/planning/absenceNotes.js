import { stripAccents } from './constants';

// Une note « Jean — du 18/10 au 25/10 » est lue comme une absence (même règle que le serveur :
// le nom est avant le premier séparateur, la période = les dates jj/mm[/aaaa] trouvées après).
const DATE_RE = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;
const tokens = (t) => stripAccents(t || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function parseNoteLine(line, defaultYear) {
  const text = (line || '').trim();
  if (!text) return null;
  const m = text.match(/\s[:—–-]\s|[:—–]/);
  const head = m ? text.slice(0, m.index) : text;
  const body = m ? text.slice(m.index + m[0].length) : text;
  const days = [];
  for (const [, d, mo, y] of body.matchAll(DATE_RE)) {
    const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : defaultYear;
    const dt = new Date(year, Number(mo) - 1, Number(d));
    if (dt.getMonth() === Number(mo) - 1) days.push(dt);
  }
  const name = tokens(head.replace(DATE_RE, ' '));
  if (!days.length || !name.length) return null;
  const ts = days.map((x) => x.getTime());
  return { name, start: new Date(Math.min(...ts)), end: new Date(Math.max(...ts)) };
}

// Première ligne des textes qui cite (tous les mots tapés) cette personne avec une période couvrant `iso` (AAAA-MM-JJ).
export function findNoteAbsence(texts, typedTokens, iso) {
  const day = new Date(`${iso}T00:00:00`);
  const year = day.getFullYear();
  for (const text of texts) {
    for (const line of (text || '').split('\n')) {
      const p = parseNoteLine(line, year);
      if (!p) continue;
      if (!typedTokens.every((t) => p.name.includes(t))) continue;
      if (p.start <= day && day <= p.end) return line.trim();
    }
  }
  return null;
}
