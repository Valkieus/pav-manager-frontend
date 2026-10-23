import { stripAccents } from './constants';
import { findNoteAbsence } from './absenceNotes';

// Incohérences du planning, calculées à la volée (le contenu des cases n'est jamais modifié) :
//  - « absence » : une personne est planifiée un jour où elle a déclaré une absence (absence enregistrée ou ligne
//    « Nom — du JJ/MM au JJ/MM » dans les notes / « Absences de l'équipe ») ;
//  - « doublon » : la même personne est dans plusieurs cases le même jour.
// Chaque incohérence a une clé stable « AAAA-MM-JJ|nom|type » : c'est elle qui est enregistrée quand la Coordination+
// choisit de l'ignorer.
const norm = (t) => stripAccents(String(t || '')).toLowerCase().trim();
const tokens = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean);

const sameName = (cell, other) => {
  const a = norm(cell);
  const b = norm(other);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};

export function computeConflicts({ dates, sections, defaultSections, affectations, monthAbsences, notes, absences }) {
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
    const perDate = dayDates.map(() => new Map()); // date -> nom normalisé -> cases
    [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach((section) => {
      (section.roles || []).forEach((role) => {
        for (let slot = 0; slot < (role.slots || 1); slot += 1) {
          const key = `${role.key}_${slot}`;
          dayDates.forEach((iso, dateIdx) => {
            const value = affectations?.[key]?.[dateIdx];
            if (typeof value !== 'string' || !value.trim()) return;
            const cell = { day, key, dateIdx, role: role.label, value: value.trim() };
            const nv = norm(value);
            if (!perDate[dateIdx].has(nv)) perDate[dateIdx].set(nv, []);
            perDate[dateIdx].get(nv).push(cell);
            const hit = (monthAbsences || []).find((a) => a.date_debut <= iso && iso <= a.date_fin && sameName(value, a.full_name));
            if (hit) {
              add(`${iso}|${nv}|absence`, { type: 'absence', iso, name: value.trim(), detail: `${hit.full_name} — absence déclarée du ${hit.date_debut.slice(8)}/${hit.date_debut.slice(5, 7)} au ${hit.date_fin.slice(8)}/${hit.date_fin.slice(5, 7)}${hit.raison ? ` (${hit.raison})` : ''}` }, cell);
            } else {
              const noted = findNoteAbsence(texts, tokens(value), iso);
              if (noted) add(`${iso}|${nv}|absence`, { type: 'absence', iso, name: value.trim(), detail: `Notes : « ${noted} »` }, cell);
            }
          });
        }
      });
    });
    perDate.forEach((byName, dateIdx) => {
      byName.forEach((cells, nv) => {
        if (cells.length > 1) {
          cells.forEach((cell) => add(`${dayDates[dateIdx]}|${nv}|doublon`, { type: 'doublon', iso: dayDates[dateIdx], name: cell.value, detail: `Planifié(e) ${cells.length} fois le même jour : ${cells.map((c) => c.role).join(', ')}` }, cell));
        }
      });
    });
  });
  return Array.from(out.values()).sort((a, b) => (a.iso + a.type).localeCompare(b.iso + b.type));
}

export const fmtIso = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
