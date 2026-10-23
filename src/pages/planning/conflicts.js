import { stripAccents } from './constants';
import { findNoteAbsence } from './absenceNotes';

// Incohérences du planning, calculées à la volée (le contenu des cases n'est jamais modifié) :
//  - « absence » : une personne est planifiée un jour où elle a déclaré une absence (absence enregistrée ou ligne
//    « Nom — du JJ/MM au JJ/MM » dans les notes / « Absences de l'équipe ») ;
//  - « incomplet » : le nom écrit dans la case semble incomplet (« IS », « Isab », « Cedri ? ») : il ne correspond à
//    personne de l'Effectif mais débute comme un ou plusieurs noms. Les noms extérieurs complets (invités) ne sont
//    pas signalés.
// Chaque incohérence a une clé stable « AAAA-MM-JJ|nom|type » : c'est elle qui est enregistrée quand la Coordination+
// choisit de l'ignorer.
const norm = (t) => stripAccents(String(t || '')).toLowerCase().trim();
const tokens = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean);

const sameName = (cell, other) => {
  const a = norm(cell);
  const b = norm(other);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};

// Renvoie les noms d'Effectif que la saisie pourrait désigner si elle est incomplète, [] sinon.
function incompleteCandidates(value, roster) {
  const parts = String(value).split(/[/&+,]/).map((x) => x.trim()).filter(Boolean);
  for (const part of parts) {
    const toks = tokens(part);
    if (!toks.length) continue;
    const doubt = /[?]|\.\.\.$/.test(part);
    const known = roster.some((r) => toks.every((t) => r.tokens.includes(t)));
    if (known && !doubt) continue;
    const prefixed = roster.filter((r) => toks.every((t) => r.tokens.some((rt) => rt.startsWith(t))));
    const short = toks.join('').length <= 2;
    if (doubt || short || prefixed.length > 0) {
      return { part, candidates: prefixed.slice(0, 3).map((r) => r.name) };
    }
  }
  return null;
}

export function computeConflicts({ dates, sections, defaultSections, affectations, monthAbsences, notes, absences, rosterNames }) {
  const roster = (rosterNames || []).map((name) => ({ name, tokens: tokens(name) }));
  const out = new Map();
  const add = (id, base, cell) => {
    if (!out.has(id)) out.set(id, { id, ...base, cells: [] });
    out.get(id).cells.push(cell);
  };
  const texts = [notes?.vendredi, notes?.dimanche, absences?.vendredi, absences?.dimanche];
  ['dimanche', 'vendredi'].forEach((day) => {
    const dayDates = (dates && dates[day]) || [];
    const daySecs = (sections && sections[day]) || (defaultSections && defaultSections[day]);
    if (!daySecs) return;
    [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach((section) => {
      (section.roles || []).forEach((role) => {
        for (let slot = 0; slot < (role.slots || 1); slot += 1) {
          const key = `${role.key}_${slot}`;
          dayDates.forEach((iso, dateIdx) => {
            const value = affectations?.[key]?.[dateIdx];
            if (typeof value !== 'string' || !value.trim()) return;
            const cell = { day, key, dateIdx, role: role.label, value: value.trim() };
            const nv = norm(value);
            const hit = (monthAbsences || []).find((a) => a.date_debut <= iso && iso <= a.date_fin && sameName(value, a.full_name));
            if (hit) {
              add(`${iso}|${nv}|absence`, { type: 'absence', iso, name: value.trim(), detail: `${hit.full_name} — absence déclarée du ${hit.date_debut.slice(8)}/${hit.date_debut.slice(5, 7)} au ${hit.date_fin.slice(8)}/${hit.date_fin.slice(5, 7)}${hit.raison ? ` (${hit.raison})` : ''}` }, cell);
            } else {
              const noted = findNoteAbsence(texts, tokens(value), iso);
              if (noted) add(`${iso}|${nv}|absence`, { type: 'absence', iso, name: value.trim(), detail: `Notes : « ${noted} »` }, cell);
            }
            if (roster.length) {
              const inc = incompleteCandidates(value, roster);
              if (inc) {
                add(`${iso}|${nv}|incomplet`, { type: 'incomplet', iso, name: value.trim(), detail: `Case incomplète : « ${inc.part} » ne correspond à personne de l'Effectif${inc.candidates.length ? ` (${inc.candidates.join(', ')} ?)` : ''}` }, cell);
              }
            }
          });
        }
      });
    });
  });
  return Array.from(out.values()).sort((a, b) => (a.iso + a.type).localeCompare(b.iso + b.type));
}

export const fmtIso = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
