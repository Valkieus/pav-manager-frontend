import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Sélection multiple « façon Excel » dans la grille du Planning.
//  - glisser la souris d'une case à l'autre, ou Maj+clic, ou Maj+flèches ;
//  - Suppr/Retour arrière : vide les cases sélectionnées ;
//  - Ctrl/Cmd+C : copie (tableau texte, collable dans Excel) ; Ctrl/Cmd+V : colle un bloc (même depuis Excel) ;
//  - Ctrl/Cmd+D : recopie vers le bas, Ctrl/Cmd+R : recopie vers la droite ; Échap : désélectionne.
// Travaille sur le DOM (td[data-cell]) : aucune re-génération de la grille pendant la sélection.
// Seules les cases modifiables (data-editable="1") sont écrites ; l'annulation (Ctrl+Z du Planning) fonctionne
// car tout passe par setAffectations.
const SEL = 'td[data-cell]';

export function useCellSelection({ activeDay, canWrite, affectations, setAffectations }) {
  const st = useRef({ anchor: null, head: null, dragging: false, range: false });
  const live = useRef({});
  live.current = { activeDay, canWrite, affectations, setAffectations };

  useEffect(() => {
    const getGrid = () => {
      const tds = Array.from(document.querySelectorAll(SEL)).filter((td) => td.dataset.cell.startsWith(`${live.current.activeDay}|`));
      const rowIdx = new Map();
      const cells = tds.map((td) => {
        const [, key, d] = td.dataset.cell.split('|');
        if (!rowIdx.has(key)) rowIdx.set(key, rowIdx.size);
        return { td, key, c: Number(d), r: rowIdx.get(key), editable: td.dataset.editable === '1' };
      });
      return { cells, rows: rowIdx.size };
    };
    const locate = (td) => {
      if (!td) return null;
      const [day, key, d] = td.dataset.cell.split('|');
      if (day !== live.current.activeDay) return null;
      const { cells } = getGrid();
      const hit = cells.find((x) => x.key === key && x.c === Number(d));
      return hit ? { r: hit.r, c: hit.c } : null;
    };
    const rect = () => {
      const { anchor, head } = st.current;
      if (!anchor || !head) return null;
      return { r1: Math.min(anchor.r, head.r), r2: Math.max(anchor.r, head.r), c1: Math.min(anchor.c, head.c), c2: Math.max(anchor.c, head.c) };
    };
    const paint = () => {
      const rc = st.current.range ? rect() : null;
      const { cells } = getGrid();
      document.querySelectorAll('td[data-sel]').forEach((td) => td.removeAttribute('data-sel'));
      if (!rc) return;
      cells.forEach((x) => { if (x.r >= rc.r1 && x.r <= rc.r2 && x.c >= rc.c1 && x.c <= rc.c2) x.td.setAttribute('data-sel', '1'); });
    };
    const clear = () => {
      st.current = { anchor: null, head: null, dragging: false, range: false };
      document.body.classList.remove('planning-selecting');
      paint();
    };
    const selected = () => {
      const rc = st.current.range ? rect() : null;
      if (!rc) return [];
      return getGrid().cells.filter((x) => x.r >= rc.r1 && x.r <= rc.r2 && x.c >= rc.c1 && x.c <= rc.c2);
    };
    const valueOf = (key, c) => {
      const v = live.current.affectations[key];
      return (v && v[c]) || '';
    };
    const writeMany = (entries) => {
      const okEntries = entries.filter((e) => e.editable);
      if (!okEntries.length) { toast.info('Aucune case modifiable dans la sélection'); return; }
      live.current.setAffectations((prev) => {
        const next = { ...prev };
        okEntries.forEach(({ key, c, value }) => { next[key] = { ...(next[key] || {}), [c]: value }; });
        return next;
      });
      const skipped = entries.length - okEntries.length;
      toast.success(`${okEntries.length} case(s) modifiée(s)${skipped ? ` — ${skipped} ignorée(s) (verrouillées ou hors périmètre)` : ''}`);
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      const td = e.target.closest && e.target.closest(SEL);
      if (!td) { if (!e.target.closest?.('[role="dialog"], [role="menu"]')) clear(); return; }
      const pos = locate(td);
      if (!pos) return;
      if (e.shiftKey && st.current.anchor) {
        e.preventDefault();
        st.current.head = pos;
        st.current.range = true;
        document.activeElement?.blur?.();
        document.body.classList.add('planning-selecting');
        paint();
        return;
      }
      st.current = { anchor: pos, head: pos, dragging: true, range: false };
      paint();
    };
    const onMouseOver = (e) => {
      if (!st.current.dragging || e.buttons !== 1) return;
      const td = e.target.closest && e.target.closest(SEL);
      const pos = locate(td);
      if (!pos) return;
      const { anchor } = st.current;
      if (!st.current.range && pos.r === anchor.r && pos.c === anchor.c) return;
      st.current.range = true;
      st.current.head = pos;
      document.activeElement?.blur?.();
      document.body.classList.add('planning-selecting');
      paint();
    };
    const onMouseUp = () => { st.current.dragging = false; };

    const onKeyDown = (e) => {
      const s = st.current;
      if (!s.range) return;
      const mod = e.ctrlKey || e.metaKey;
      const sel = selected();
      if (!sel.length) return;
      if (e.key === 'Escape') { clear(); return; }
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        const { cells, rows } = getGrid();
        const maxC = Math.max(...cells.map((x) => x.c));
        s.head = { r: Math.min(rows - 1, Math.max(0, s.head.r + d[0])), c: Math.min(maxC, Math.max(0, s.head.c + d[1])) };
        paint();
        return;
      }
      if (!live.current.canWrite && (e.key === 'Delete' || e.key === 'Backspace' || (mod && ['d', 'r', 'v'].includes(e.key.toLowerCase())))) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        writeMany(sel.map((x) => ({ key: x.key, c: x.c, editable: x.editable, value: '' })));
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const rc = rect();
        const lines = [];
        for (let r = rc.r1; r <= rc.r2; r++) {
          lines.push(sel.filter((x) => x.r === r).sort((a, b) => a.c - b.c).map((x) => valueOf(x.key, x.c)).join('\t'));
        }
        navigator.clipboard?.writeText(lines.join('\n')).then(() => toast.success('Sélection copiée'), () => toast.error('Copie impossible'));
      } else if (mod && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        const down = e.key.toLowerCase() === 'd';
        const rc = rect();
        const entries = [];
        sel.forEach((x) => {
          const src = sel.find((y) => (down ? y.c === x.c && y.r === rc.r1 : y.r === x.r && y.c === rc.c1));
          if (src && src !== x) entries.push({ key: x.key, c: x.c, editable: x.editable, value: valueOf(src.key, src.c) });
        });
        writeMany(entries);
      }
    };
    const onPaste = (e) => {
      const s = st.current;
      if (!s.anchor || !live.current.canWrite) return;
      const text = e.clipboardData?.getData('text') || '';
      const multiText = /[\t\n]/.test(text.replace(/\n$/, ''));
      if (!s.range && !multiText) return; // collage normal dans une seule case
      e.preventDefault();
      const rc = rect();
      const { cells } = getGrid();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      const flat = rows.length === 1 && rows[0].length === 1;
      const entries = [];
      if (flat && s.range) {
        selected().forEach((x) => entries.push({ key: x.key, c: x.c, editable: x.editable, value: rows[0][0].trim() }));
      } else {
        rows.forEach((cols, i) => cols.forEach((v, j) => {
          const hit = cells.find((x) => x.r === rc.r1 + i && x.c === rc.c1 + j);
          if (hit) entries.push({ key: hit.key, c: hit.c, editable: hit.editable, value: v.trim() });
        }));
      }
      writeMany(entries);
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('paste', onPaste, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('paste', onPaste, true);
      clear();
    };
  }, [activeDay]);
}
