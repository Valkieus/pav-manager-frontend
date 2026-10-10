import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Users } from 'lucide-react';

// Édition à plusieurs « comme sur Google Sheets » : toutes les ~3 s le
// navigateur envoie sa position (case en cours d'édition) et reçoit qui est en
// ligne + les modifications des autres. Les cases que la personne n'a pas
// touchées sont mises à jour en direct ; celles qu'elle est en train de
// modifier ne sont jamais écrasées.

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 3000;
const FLASH_MS = 3500;
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

export const colorFor = (id) => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

const norm = (v) => (v === null || v === undefined || v === '__none__' ? '' : v);

// Fusion à 3 voies (identique à celle du serveur) : case non modifiée
// localement (mine == base) => valeur du serveur ; sinon la valeur locale gagne.
export function mergeCells(base, mine, current) {
  const out = {};
  const keys = new Set([...Object.keys(mine || {}), ...Object.keys(current || {})]);
  keys.forEach((k) => {
    const m = (mine && mine[k]) || [];
    const b = (base && base[k]) || [];
    const c = (current && current[k]) || [];
    const n = Math.max(m.length, c.length);
    const row = [];
    for (let i = 0; i < n; i++) {
      row.push(norm(m[i]) === norm(b[i]) ? (c[i] === undefined ? '' : c[i]) : m[i]);
    }
    out[k] = row;
  });
  return out;
}

// Liste des cellules (« clé|colonne ») dont la valeur diffère entre a et b.
function diffCells(a, b) {
  const changed = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  keys.forEach((k) => {
    const x = (a && a[k]) || [];
    const y = (b && b[k]) || [];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if (norm(x[i]) !== norm(y[i])) changed.push(`${k}|${i}`);
    }
  });
  return changed;
}

/**
 * @param kind 'planning' | 'evenement'
 * @param id   id du document (null => inactif)
 * @param getLocal  () => affectations locales actuelles
 * @param onApply   (affectations fusionnées) => void
 * @param cellId    (clé|colonne) => identifiant data-cell (permet d'ajouter un préfixe, ex. le jour)
 */
export function useLiveDoc({ kind, id, enabled, getLocal, onApply, cellPrefix = '' }) {
  const [users, setUsers] = useState([]);
  const [flashes, setFlashes] = useState({});
  const baseRef = useRef({});
  const sinceRef = useRef(null);
  const cellRef = useRef(null);
  const busyRef = useRef(false);
  const getLocalRef = useRef(getLocal);
  const onApplyRef = useRef(onApply);
  const prefixRef = useRef(cellPrefix);
  getLocalRef.current = getLocal;
  onApplyRef.current = onApply;
  prefixRef.current = cellPrefix;

  const sync = useCallback((updatedAt, affectations) => {
    sinceRef.current = updatedAt || null;
    baseRef.current = affectations || {};
  }, []);

  const flash = useCallback((cells, by) => {
    if (!cells.length) return;
    const stamp = Date.now();
    setFlashes((f) => {
      const n = { ...f };
      cells.forEach((c) => { n[`${prefixRef.current}${c}`] = { by, stamp }; });
      return n;
    });
    setTimeout(() => {
      setFlashes((f) => {
        const n = { ...f };
        Object.keys(n).forEach((k) => { if (n[k].stamp === stamp) delete n[k]; });
        return n;
      });
    }, FLASH_MS);
  }, []);

  // Réponse du serveur (autosave ou battement) : on fusionne dans l'état local.
  const applyServer = useCallback((serverAff, updatedAt, by, baseOverride) => {
    const local = getLocalRef.current() || {};
    const merged = mergeCells(baseOverride || baseRef.current, local, serverAff || {});
    const changed = diffCells(local, merged);
    if (changed.length) {
      onApplyRef.current(merged);
      if (by) flash(changed, by);
    }
    baseRef.current = serverAff || {};
    sinceRef.current = updatedAt || sinceRef.current;
  }, [flash]);

  const beat = useCallback(async () => {
    if (!id || busyRef.current || document.hidden) return;
    busyRef.current = true;
    try {
      const res = await axios.post(`${API}/live/${kind}/${id}`, { cell: cellRef.current, since: sinceRef.current });
      setUsers(res.data.users || []);
      if (res.data.data) {
        applyServer(res.data.data.affectations, res.data.updated_at, res.data.updated_by_name || 'Un collègue');
      }
    } catch {
      // réseau coupé / droits : l'édition continue normalement sans le live
    } finally {
      busyRef.current = false;
    }
  }, [id, kind, applyServer]);

  useEffect(() => {
    if (!enabled || !id) { setUsers([]); return undefined; }
    const t = setInterval(beat, POLL_MS);
    const find = (el) => (el && el.closest ? el.closest('[data-cell]') : null);
    const onIn = (e) => {
      const c = find(e.target);
      cellRef.current = c ? c.getAttribute('data-cell') : null;
      beat();
    };
    const onOut = (e) => {
      if (!find(e.relatedTarget)) { cellRef.current = null; }
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    beat();
    return () => {
      clearInterval(t);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, [enabled, id, beat]);

  return { users, flashes, sync, applyServer, getBase: () => baseRef.current };
}

// Pastilles « En ligne : … » à placer près du statut d'enregistrement.
export function LivePresence({ users }) {
  if (!users || users.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs print:hidden" data-testid="live-presence" title="Personnes qui regardent ce planning en ce moment">
      <Users className="w-3.5 h-3.5 text-muted-foreground" />
      {users.map((u) => (
        <span key={u.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: colorFor(u.id) }}>
          <span className="w-2 h-2 rounded-full" style={{ background: colorFor(u.id) }} />
          {u.name}
        </span>
      ))}
    </span>
  );
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Contours colorés + nom au-dessus de la case où un collègue écrit, et
// surbrillance brève sur les cases qu'il vient de modifier.
export function LiveStyle({ users, flashes, cellPrefix = '' }) {
  let css = '@keyframes pavLiveFlash{0%{background:#fde68a}100%{background:transparent}}';
  (users || []).forEach((u) => {
    if (!u.cell || (cellPrefix && !u.cell.startsWith(cellPrefix))) return;
    const col = colorFor(u.id);
    css += `[data-cell="${esc(u.cell)}"]{position:relative;outline:2px solid ${col};outline-offset:-2px}`;
    css += `[data-cell="${esc(u.cell)}"]::after{content:"${esc(u.name)}";position:absolute;top:0;right:0;background:${col};color:#fff;font-size:9px;line-height:1;padding:2px 4px;z-index:5;pointer-events:none;white-space:nowrap}`;
  });
  Object.keys(flashes || {}).forEach((c) => {
    css += `[data-cell="${esc(c)}"]{animation:pavLiveFlash ${FLASH_MS}ms ease-out}`;
  });
  return <style>{css}</style>;
}
