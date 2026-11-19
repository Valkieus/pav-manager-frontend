import { useMemo, useRef, useState } from "react";

// Auto-complétion discrète des noms : la suite du nom apparaît en grisé derrière ce qu'on tape.
// Tab, Entrée, → (en fin de saisie), Espace ou un appui sur la suite grisée sur téléphone l'acceptent ; sinon on continue de taper.
// Espace n'accepte que si le mot tapé n'est pas fini dans la suggestion (« Pa » → Paul Durand) : après « Jean » (prénom complet), l'espace reste un espace.
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Premier nom (ordre alphabétique) qui commence par ce qui est tapé, et qui est plus long que la saisie.
export function suggest(names, typed) {
  const q = norm(typed).trimStart();
  if (!q) return null;
  return (names || []).find((n) => { const m = norm(n); return m.length > q.length && m.startsWith(q); }) || null;
}

const wantsAccept = (key, full, typed) => key === "Tab" || key === "Enter" || (key === " " && full.length > typed.length && full[typed.length] !== " ");

const useNames = (names) => useMemo(() => Array.from(new Set(names || [])).sort((a, b) => a.localeCompare(b, "fr")), [names]);

export function NameInput({ value, onChange, names, className = "", style, onKeyDown, ...rest }) {
  const list = useNames(names);
  const [focus, setFocus] = useState(false);
  const v = value || "";
  const full = focus ? suggest(list, v) : null;
  const rest_ = full ? full.slice(v.trimStart().length + (v.length - v.trimStart().length)) : "";
  const accept = () => { if (full) onChange(full); };
  return (
    <span className="relative block w-full">
      <input
        {...rest}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={className}
        style={full ? { ...style, textAlign: "left" } : style}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => {
          const atEnd = e.currentTarget.selectionStart === v.length && e.currentTarget.selectionEnd === v.length;
          if (full && atEnd && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (wantsAccept(e.key, full, v) || e.key === "ArrowRight")) {
            e.preventDefault(); accept();
            return; // Entrée ne valide pas en plus le champ : on a seulement complété le nom
          }
          onKeyDown && onKeyDown(e);
        }}
      />
      {full && (
        <span aria-hidden className={`${className} absolute inset-0 pointer-events-none flex items-center justify-start overflow-hidden whitespace-pre border-transparent ring-0`} style={{ ...style, textAlign: "left", background: "transparent" }}>
          <span className="invisible">{v}</span>
          <span className="text-muted-foreground/70 pointer-events-auto cursor-pointer" onPointerDown={(e) => { e.preventDefault(); accept(); }}>{rest_}</span>
        </span>
      )}
    </span>
  );
}

// Même idée pour une zone de texte : le nom en début de ligne (« Jean — du 18/10… ») est proposé tant que la ligne n'est que le début d'un nom.
export function NameTextarea({ value, onChange, names, className = "", onKeyDown, ...rest }) {
  const list = useNames(names);
  const ref = useRef(null);
  const ghostRef = useRef(null);
  const [caret, setCaret] = useState(null);
  const text = value || "";
  let full = null, lineStart = 0;
  if (caret !== null && caret <= text.length) {
    const atEol = caret === text.length || text[caret] === "\n";
    lineStart = text.lastIndexOf("\n", caret - 1) + 1;
    if (atEol) full = suggest(list, text.slice(lineStart, caret));
  }
  const typedLen = caret !== null ? caret - lineStart : 0;
  const accept = () => {
    if (!full) return;
    const next = text.slice(0, lineStart) + full + text.slice(caret);
    onChange(next);
    const pos = lineStart + full.length;
    requestAnimationFrame(() => { const t = ref.current; if (t) { t.selectionStart = t.selectionEnd = pos; setCaret(pos); } });
  };
  const sync = (e) => { setCaret(e.target.selectionStart === e.target.selectionEnd ? e.target.selectionStart : null); if (ghostRef.current) ghostRef.current.scrollTop = e.target.scrollTop; };
  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={ref}
        spellCheck={false}
        className={className}
        value={text}
        onChange={(e) => { onChange(e.target.value); sync(e); }}
        onSelect={sync}
        onKeyUp={sync}
        onClick={sync}
        onScroll={sync}
        onBlur={() => setCaret(null)}
        onKeyDown={(e) => {
          if (full && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && wantsAccept(e.key, full, text.slice(lineStart, caret))) { e.preventDefault(); accept(); return; }
          onKeyDown && onKeyDown(e);
        }}
      />
      {full && (
        <div ref={ghostRef} aria-hidden className={`${className} absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words border-transparent bg-transparent ring-0`} style={{ resize: "none" }}>
          <span className="invisible">{text.slice(0, caret)}</span>
          <span className="text-muted-foreground/70">{full.slice(typedLen)}</span>
        </div>
      )}
    </div>
  );
}
