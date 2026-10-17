import { useState, useEffect } from 'react';
import { Input } from '../../components/ui/input';

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CONTACT_TYPES = ['Fournisseur', 'Location', 'Réparation'];

export const POSTES_CAM = ['Caméra 1', 'Caméra 2', 'Caméra 3', 'Caméra 4', 'Caméra 5', 'Caméra 6', 'Caméra 7'];

export const FREQUENCE_OPTIONS = ['Ponctuel', 'Récurrent'];

// Format des noms : toujours « Prénom Nom » propre, quelle que soit la façon
// dont le nom a été saisi dans le planning (« elder » -> « Elder »,
// « jean  wisler » -> « Jean Wisler », « Victor e » -> « Victor E. »,
// « marc-arthur » -> « Marc-Arthur »). Particules (de, du, van…) en minuscules.
export const NOM_PARTICULES = new Set(['de', 'du', 'des', 'da', 'di', 'van', 'von', 'le', 'la', 'el']);

export const nomKey = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const formatNom = (raw) => {
  const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((tok, i) => {
      const lower = tok.toLowerCase();
      if (i > 0 && NOM_PARTICULES.has(lower)) return lower;
      // Lettre isolée = initiale : « e » -> « E. »
      if (/^\p{L}\.?$/u.test(tok)) return `${tok[0].toUpperCase()}.`;
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
};

// Couleur d'une fiche = couleur de sa CAMÉRA (1 rouge, 2 jaune, 3 vert, 4 bleu,
// 5 gris, 6 mauve, 7 violet foncé).
export const CAMERA_COULEURS = {
  1: { edge: 'border-red-500', nom: 'rouge', solid: 'bg-red-500 text-white', soft: 'bg-red-500/10', border: 'border-l-red-500', dot: 'bg-red-500' },
  2: { edge: 'border-yellow-400', nom: 'jaune', solid: 'bg-yellow-400 text-yellow-950', soft: 'bg-yellow-400/15', border: 'border-l-yellow-400', dot: 'bg-yellow-400' },
  3: { edge: 'border-green-500', nom: 'vert', solid: 'bg-green-500 text-white', soft: 'bg-green-500/10', border: 'border-l-green-500', dot: 'bg-green-500' },
  4: { edge: 'border-blue-500', nom: 'bleu', solid: 'bg-blue-500 text-white', soft: 'bg-blue-500/10', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  5: { edge: 'border-gray-500', nom: 'gris', solid: 'bg-gray-500 text-white', soft: 'bg-gray-500/10', border: 'border-l-gray-500', dot: 'bg-gray-500' },
  6: { edge: 'border-purple-300', nom: 'mauve', solid: 'bg-purple-300 text-purple-950', soft: 'bg-purple-300/20', border: 'border-l-purple-300', dot: 'bg-purple-300' },
  7: { edge: 'border-violet-800', nom: 'violet foncé', solid: 'bg-violet-800 text-white', soft: 'bg-violet-800/10', border: 'border-l-violet-800', dot: 'bg-violet-800' },
};

export const cameraCouleur = (poste) => {
  const n = parseInt((String(poste || '').match(/\d+/) || [''])[0], 10);
  return CAMERA_COULEURS[n] || null;
};

// Week-end : un week-end blanc, le suivant gris (alternance). Le vendredi et le
// dimanche d'un même week-end ont le même fond. Retourne 0 (blanc), 1 (gris)
// ou null pour un jour qui n'est ni vendredi ni dimanche.
export const weekendParite = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const wd = new Date(y, m - 1, d).getDay();
  if (wd !== 5 && wd !== 0) return null;
  // Jour (époque) du VENDREDI du week-end : le dimanche remonte de 2 jours.
  const fridayEpochDay = Math.floor(Date.UTC(y, m - 1, d) / 86400000) - (wd === 0 ? 2 : 0);
  return Math.floor(fridayEpochDay / 7) % 2;
};

// Couleurs du Planning PAV : vendredi = bleu planning, dimanche = orange.
export const jourCouleurStyle = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 5) return { background: '#A6C8EB', color: '#1F4E78', borderColor: '#1F4E78' };
  if (wd === 0) return { background: '#FCE4D6', color: '#C55A11', borderColor: '#C55A11' };
  return null;
};

// Signatures (sortie / entrée) : initiales (texte) ou dessin (image PNG).
export const isDrawnSig = (v) => typeof v === 'string' && v.startsWith('data:image');

export const sigText = (v) => (!v ? '' : isDrawnSig(v) ? '(signature dessinée)' : v);

export const sigSummary = (s) => {
  const parts = [
    s.signature_entree && `Retour matériel : ${sigText(s.signature_entree)}`,
  ].filter(Boolean);
  if (parts.length === 0 && s.signature) return sigText(s.signature);
  return parts.join(' / ');
};

// Heures de la fiche d'un culte : saisie avec un vrai sélecteur d'heure
// (<input type="time">, "HH:MM"), enregistrée au format français déjà utilisé
// partout (« 8h30 », « 15h12 »). Les anciennes saisies libres lisibles
// (« 8h30 », « 8h », « 15:12 ») sont reprises ; une saisie illisible est
// conservée telle quelle tant qu'on ne choisit pas une nouvelle heure.
export const heureToInput = (raw) => {
  const m = String(raw || '').trim().toLowerCase().match(/^(\d{1,2})\s*(?:h|:)\s*(\d{0,2})$/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = m[2] === '' ? 0 : parseInt(m[2], 10);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

export const heureFromInput = (value) => {
  if (!value) return '';
  const [h, m] = value.split(':');
  return `${parseInt(h, 10)}h${m}`;
};

// Photo / logo d'une fiche : si l'image ne charge pas (fichier manquant), on
// affiche une pastille avec l'icône plutôt qu'une image cassée avec son texte.
export function PhotoTile({ url, alt, contain, Icon }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) {
    return (
      <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center" title={url ? `${alt} : image indisponible` : undefined}>
        <Icon className="w-5 h-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={`${process.env.REACT_APP_BACKEND_URL}${url}`}
      alt={alt}
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-12 h-12 rounded border ${contain ? 'object-contain bg-white' : 'object-cover'}`}
    />
  );
}

// Cadreurs prévus au planning pour une date : [{ label, num, names: [{ slot, nom }] }].
export const extractPlanned = (pl, date) => {
  const out = [];
  ['dimanche', 'vendredi'].forEach((day) => {
    const dateIdx = ((pl.dates || {})[day] || []).indexOf(date);
    if (dateIdx < 0) return;
    const tables = (pl.sections || {})[day] || {};
    Object.values(tables).forEach((secs) =>
      (Array.isArray(secs) ? secs : []).forEach((sec) => {
        if (sec?.name !== 'CADREURS') return;
        (sec.roles || []).forEach((role) => {
          const num = parseInt((role.label || '').replace(/\D+/g, ''), 10);
          const names = [];
          for (let slot = 0; slot < (role.slots || 1); slot++) {
            const raw = (pl.affectations || {})[`${role.key}_${slot}`];
            const val = Array.isArray(raw) ? raw[dateIdx] : raw && raw[dateIdx];
            if (val && String(val).trim()) names.push({ slot, nom: String(val).trim() });
          }
          if (names.length) out.push({ label: role.label, num: Number.isNaN(num) ? null : num, names });
        });
      })
    );
  });
  out.sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  return out;
};

// Clé du week-end (date du dimanche) pour un vendredi ou un dimanche ; null sinon.
export const weekendKey = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = d.getDay();
  if (wd !== 5 && wd !== 0) return null;
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 5 ? 2 : 0));
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
};

// Date de référence du week-end en cours : aujourd'hui si vendredi/samedi/dimanche, sinon le
// vendredi à venir (lundi à jeudi → le week-end qui arrive).
export const nextWeekendRefDate = () => {
  const t = new Date();
  const wd = t.getDay();
  const add = wd === 6 ? -1 : wd >= 1 && wd <= 4 ? 5 - wd : 0; // samedi → vendredi
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Code de rôle d'une ligne d'équipe : « C », « Cadreur », « cadreur » → C ; « Assistant » → A ; « Régisseur » → R.
export const roleCode = (r) => {
  const x = String(r || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (x === 'C' || x.startsWith('CAD')) return 'C';
  if (x === 'A' || x.startsWith('ASS')) return 'A';
  if (x === 'R' || x.startsWith('REG')) return 'R';
  return null;
};

// Une seule ligne d'office par rôle (Cadreur / Assistant / Régisseur) : les anciens libellés sont
// ramenés au code, les lignes vides en double disparaissent, les manquantes sont ajoutées.
export const withDefaultEquipe = (equipe) => {
  const rows = (equipe || []).map((m) => { const c = roleCode(m.role); return c ? { ...m, role: c } : { ...m }; });
  const named = (m) => !!(m.nom || '').trim();
  const out = [];
  const keptEmpty = new Set();
  rows.forEach((m) => {
    const c = ['C', 'A', 'R'].includes(m.role) ? m.role : null;
    if (!c || named(m)) { out.push(m); return; }
    if (rows.some((o) => o.role === c && named(o)) || keptEmpty.has(c)) return; // doublon vide
    keptEmpty.add(c);
    out.push(m);
  });
  ['C', 'A', 'R'].forEach((r) => {
    if (!out.some((m) => m.role === r)) out.push({ role: r, nom: '' });
  });
  const rank = (m) => ['C', 'A', 'R'].indexOf(m.role);
  return out.map((m, i) => ({ m, i })).sort((x, y) => {
    const rx = rank(x.m) < 0 ? 3 : rank(x.m); const ry = rank(y.m) < 0 ? 3 : rank(y.m);
    return rx - ry || x.i - y.i;
  }).map((x) => x.m);
};

// Cadreurs principaux d'office par numéro de caméra (prénoms, résolus dans l'effectif).
export const DEFAULT_PRINCIPAUX = { 5: ['Marc-Arthur', 'Camille'] };

// Champ nom avec suggestions filtrées par les lettres tapées (accents/casse ignorés).
// Au focus le texte est sélectionné : taper remplace le nom et la liste repart de zéro.
export function NameCombobox({ value, options, labelFor, onChange, onCommit }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const q = nomKey(value);
  const shown = (options || []).filter((n) => !typed || !q || nomKey(n).includes(q)).slice(0, 40);
  return (
    <div className="relative flex-1 min-w-[140px]">
      <Input
        value={value}
        placeholder="Nom (taper pour chercher dans la liste)"
        autoComplete="off"
        onFocus={(e) => { setOpen(true); setTyped(false); e.target.select(); }}
        onChange={(e) => { setTyped(true); setOpen(true); onChange(e.target.value); }}
        onBlur={() => { setOpen(false); onCommit(value); }}
      />
      {open && shown.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {shown.map((n) => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(n); onCommit(n); setOpen(false); setTyped(false); }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <span>{n}</span>
                {labelFor && labelFor(n) ? <span className="text-[10px] text-primary">{labelFor(n)}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
