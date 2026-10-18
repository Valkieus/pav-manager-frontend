import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Sélection multiple « façon Excel » dans la grille du Planning.
//  - glisser la souris d'une case à l'autre, ou Maj+clic, ou Maj+flèches ;
//  - Suppr/Retour arrière : vide les cases sélectionnées ;
//  - Ctrl/Cmd+C : copie (tableau texte, collable dans Excel) ; Ctrl/Cmd+V : colle un bloc (même depuis Excel) ;
//  - Ctrl/Cmd+X : couper (la source est vidée au collage = déplacer), Ctrl/Cmd+D : recopie vers le bas,
//    Ctrl/Cmd+R : recopie vers la droite, Ctrl/Cmd+A : tout sélectionner (2e appui dans une case), Ctrl/Cmd+Z : annuler ;
//  - Alt + glisser un bloc sélectionné : le déplace ; Échap : désélectionne / annule la coupe.
// Travaille sur le DOM (td[data-cell]) : aucune re-génération de la grille pendant la sélection.
// Seules les cases modifiables (data-editable="1") sont écrites ; l'annulation (Ctrl+Z du Planning) fonctionne
// car tout passe par setAffectations.
const SEL = 'td[data-cell]';

export function useCellSelection({ activeDay, canWrite, affectations, setAffectations, onUndo }) {
  const st = useRef({ anchor: null, head: null, dragging: false, range: false });
  const cut = useRef(null); // { text, cells: [{ key, c }] } : coupé, en attente de collage
  const moving = useRef(null); // { from: {r,c} } : déplacement Alt+glisser
  const live = useRef({});
  live.current = { activeDay, canWrite, affectations, setAffectations, onUndo };

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
    const clearCutMarks = () => {
      cut.current = null;
      document.querySelectorAll('td[data-cut]').forEach((td) => td.removeAttribute('data-cut'));
    };
    const clear = () => {
      clearCutMarks();
      moving.current = null;
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
      if (e.altKey && st.current.range && live.current.canWrite) {
        const rc0 = rect();
        if (rc0 && pos.r >= rc0.r1 && pos.r <= rc0.r2 && pos.c >= rc0.c1 && pos.c <= rc0.c2) {
          e.preventDefault();
          moving.current = { from: pos };
          document.activeElement?.blur?.();
          document.body.classList.add('planning-selecting');
          return;
        }
      }
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
    const onMouseUp = (e) => {
      st.current.dragging = false;
      const mv = moving.current;
      if (!mv) return;
      moving.current = null;
      document.body.classList.remove('planning-selecting');
      const td = e.target.closest && e.target.closest(SEL);
      const to = locate(td);
      const rc0 = rect();
      if (!to || !rc0 || (to.r === mv.from.r && to.c === mv.from.c)) return;
      const dr = to.r - mv.from.r, dc = to.c - mv.from.c;
      const { cells } = getGrid();
      const src = selected();
      const at = (r, c) => cells.find((x) => x.r === r && x.c === c);
      const dest = [];
      src.forEach((x) => { const t = at(x.r + dr, x.c + dc); if (t) dest.push({ from: x, to: t }); });
      if (dest.length !== src.length || dest.some((d) => !d.to.editable) || src.some((x) => !x.editable)) {
        toast.error('Déplacement impossible : la destination sort de la grille ou contient une case verrouillée');
        return;
      }
      const vals = dest.map((d) => ({ d, v: valueOf(d.from.key, d.from.c) }));
      live.current.setAffectations((prev) => {
        const next = { ...prev };
        dest.forEach((d) => { next[d.from.key] = { ...(next[d.from.key] || {}), [d.from.c]: '' }; });
        vals.forEach(({ d, v }) => { next[d.to.key] = { ...(next[d.to.key] || {}), [d.to.c]: v }; });
        return next;
      });
      st.current.anchor = { r: rc0.r1 + dr, c: rc0.c1 + dc };
      st.current.head = { r: rc0.r2 + dr, c: rc0.c2 + dc };
      paint();
      toast.success(`${dest.length} case(s) déplacée(s)`);
    };

    const onKeyDown = (e) => {
      const s = st.current;
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl+A : dans une case, le 1er appui sélectionne le texte, le 2e (ou case vide) sélectionne toute la grille.
      if (mod && e.key.toLowerCase() === 'a' && s.anchor) {
        const el = document.activeElement;
        const inCell = el && el.tagName === 'INPUT' && el.closest && el.closest(SEL);
        const textAllSelected = inCell && el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length;
        if (!inCell || textAllSelected || el.value === '') {
          e.preventDefault();
          const { cells, rows } = getGrid();
          if (!cells.length) return;
          s.anchor = { r: 0, c: 0 };
          s.head = { r: rows - 1, c: Math.max(...cells.map((x) => x.c)) };
          s.range = true;
          el?.blur?.();
          document.body.classList.add('planning-selecting');
          paint();
        }
        return;
      }
      if (!s.range) return;
      const sel = selected();
      if (!sel.length) return;
      if (e.key === 'Escape') { if (cut.current) clearCutMarks(); else clear(); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && live.current.onUndo) {
        e.preventDefault();
        live.current.onUndo();
        return;
      }
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
      } else if (mod && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
        e.preventDefault();
        const rc = rect();
        const lines = [];
        for (let r = rc.r1; r <= rc.r2; r++) {
          lines.push(sel.filter((x) => x.r === r).sort((a, b) => a.c - b.c).map((x) => valueOf(x.key, x.c)).join('\t'));
        }
        const text = lines.join('\n');
        const isCut = e.key.toLowerCase() === 'x';
        if (isCut && !live.current.canWrite) return;
        navigator.clipboard?.writeText(text).then(() => toast.success(isCut ? 'Sélection coupée — colle-la où tu veux' : 'Sélection copiée'), () => toast.error('Copie impossible'));
        clearCutMarks();
        if (isCut) {
          cut.current = { text, cells: sel.filter((x) => x.editable).map((x) => ({ key: x.key, c: x.c })) };
          sel.forEach((x) => x.td.setAttribute('data-cut', '1'));
        }
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
      const cutNow = cut.current && cut.current.text === text.replace(/\r/g, '').replace(/\n$/, '') ? cut.current : null;
      writeMany(entries);
      if (cutNow) {
        const written = new Set(entries.filter((x) => x.editable).map((x) => `${x.key}|${x.c}`));
        const toClear = cutNow.cells.filter((x) => !written.has(`${x.key}|${x.c}`));
        if (toClear.length) {
          live.current.setAffectations((prev) => {
            const next = { ...prev };
            toClear.forEach(({ key, c }) => { next[key] = { ...(next[key] || {}), [c]: '' }; });
            return next;
          });
        }
        clearCutMarks();
      }
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
