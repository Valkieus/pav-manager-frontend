import { useRef, useState, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Maximize2, X } from 'lucide-react';
import { eventsOf as datesClesOf } from '../../components/DatesCles';
import { isLiveMember, polesOf } from '../effectif/poles';

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Maps organigramme node names to predicates matched against technicien
// records, so clicking a branch on the chart can show exactly who's in it.
export const BRANCH_MEMBER_MATCH = {
  LIVE: isLiveMember, // titre : tous ceux qui sont dans un de ses pôles
  INCRUSTATION: (t) => polesOf(t).includes("Incrustation"),
  CAPTATION: (t) => polesOf(t).includes("Captation"),
  DIFFUSION: (t) => polesOf(t).includes("Diffusion"),
  ANIMATION: (t) => polesOf(t).includes("Animation"),
  RÉGISSEURS: (t) => polesOf(t).includes("Régisseurs"),
  COORDINATION: (t) => polesOf(t).includes("Coordination"),
  PRODUCTION: (t) => polesOf(t).includes("Production"),
  "RESPONSABLE PAV": (t) => polesOf(t).includes("Supervision"),
};

// Reverse map: which org-chart nodes a branch-scoped user (Coordination /
// Responsable with a limited `branches` list) is allowed to click into.
export const BRANCH_TO_NODES = {
  Live: ["LIVE", "CAPTATION", "INCRUSTATION", "DIFFUSION", "RÉGISSEURS", "ANIMATION"],
  Animation: ["ANIMATION"],
  Régisseurs: ["RÉGISSEURS"],
  Coordination: ["COORDINATION"],
  Production: ["PRODUCTION"],
  Supervision: ["RESPONSABLE PAV"],
};

// Colors for branches — shared by every OrgChart rendering path (desktop,
// tablet, mobile).
export const getBranchColor = (name) => {
  const colors = {
    "SUPERVISION TECHNIQUE": "bg-primary text-primary-foreground border-primary",
    "RESPONSABLE PAV": "bg-slate-800 text-white border-slate-700",
    COORDINATION: "bg-blue-500 text-white border-blue-600",
    PRODUCTION: "bg-emerald-500 text-white border-emerald-600",
    LIVE: "bg-red-500 text-white border-red-600",
    CAPTATION: "bg-red-400 text-white border-red-500",
    INCRUSTATION: "bg-red-400 text-white border-red-500",
    DIFFUSION: "bg-red-400 text-white border-red-500",
    ANIMATION: "bg-orange-500 text-white border-orange-600",
    RÉGISSEURS: "bg-purple-500 text-white border-purple-600",
  };
  return colors[name] || "bg-card text-foreground border-border";
};

// CSS-only "family tree" connector: each node is an <li>, siblings are wired
// together with a shared horizontal bar (::before/::after) and a vertical
// stub down from their parent (ul::before). Because every measurement is a
// percentage of the <li> itself, the lines always meet the boxes exactly —
// unlike a fixed-pixel guess, this never drifts when labels/boxes resize.
export const OrgTreeStyles = () => (
  <style>{`
.org-tree, .org-tree ul { list-style: none; margin: 0; padding: 0; position: relative; }
.org-tree ul {
display: flex;
padding-top: 28px;
}
.org-tree li {
position: relative;
display: flex;
flex-direction: column;
align-items: center;
flex: 0 0 auto;
padding: 28px 7px 0 7px;
}
/* Sibling connector: each li draws its own half of the shared horizontal
bar (::before = left half, ::after = right half) plus its own vertical
drop down to its box. Because everything is a percentage of the li's
own box, this never drifts regardless of box width. */
.org-tree li::before, .org-tree li::after {
content: '';
position: absolute;
top: 0;
right: 50%;
width: 50%;
height: 28px;
border-top: 2.5px solid #94a3b8;
}
.org-tree li::after {
right: auto;
left: 50%;
border-left: 2.5px solid #94a3b8;
}
.org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
.org-tree li:only-child { padding-top: 0; }
.org-tree li:first-child::before, .org-tree li:last-child::after { border: none; }
.org-tree li:last-child::before {
border-right: 2.5px solid #94a3b8;
border-radius: 0 8px 0 0;
}
.org-tree li:first-child::after { border-radius: 8px 0 0 0; }
.org-tree > li { padding-top: 0; }
.org-tree > li::before, .org-tree > li::after { display: none !important; }
/* Vertical stub from a parent box down to its own children's shared
horizontal bar — drawn INSIDE the reserved padding-top gap (top: 0),
never crossing back up over the parent box itself. */
.org-tree > li > ul::before,
.org-tree ul ul::before {
content: '';
position: absolute;
top: 0;
left: 50%;
width: 0;
height: 28px;
border-left: 2.5px solid #94a3b8;
}
.dark .org-tree li::before, .dark .org-tree li::after,
.dark .org-tree li:last-child::before, .dark .org-tree ul ul::before,
.dark .org-tree > li > ul::before {
border-color: #64748b;
}
/* Branche latérale (ex. COORDINATION) : un trait vertical sous le parent, et un trait horizontal vers la boîte */
@media (max-width: 767px) {
.org-tree li { padding-left: 3px; padding-right: 3px; }
.org-box { padding: 5px 7px !important; border-radius: 8px; border-width: 1.5px; }
.org-box p:first-child { font-size: 11px; line-height: 1.15; }
.org-box p + p { font-size: 9px; line-height: 1.15; margin-top: 1px; }
}
.org-side-row { position: relative; width: 100%; height: 84px; }
.org-side-row .stem { position: absolute; left: 50%; top: 0; bottom: 0; border-left: 2.5px solid #94a3b8; }
.org-side-row .branch { position: absolute; left: 50%; top: 42px; width: 28px; border-top: 2.5px solid #94a3b8; }
.org-side-row .box { position: absolute; left: calc(50% + 28px); top: 42px; transform: translateY(-50%); }
.dark .org-side-row .stem, .dark .org-side-row .branch { border-color: #64748b; }
`}</style>
);

export const OrgNodeBox = ({ node, onNodeClick, isClickable, size = "md", fullWidth = false }) => {
  const clickable = isClickable(node.name);
  const pad =
    size === "lg" ? "px-7 py-4" : size === "sm" ? "px-3 py-2" : "px-3.5 py-2.5";
  return (
    <div
      onClick={clickable ? () => onNodeClick(node) : undefined}
      className={`
${pad} rounded-xl border-2 text-center shadow-sm transition-all duration-200
org-box hover:shadow-lg hover:-translate-y-0.5 ${fullWidth ? "w-full whitespace-normal" : "whitespace-nowrap"}
${getBranchColor(node.name)}
${clickable ? "cursor-pointer" : ""}
`}
    >
      <p
        className={size === "lg" ? "font-bold text-base" : "font-bold text-sm"}
      >
        {node.name}
      </p>
      {node.responsable && (
        <p className="text-xs opacity-90 mt-0.5 italic whitespace-nowrap">{node.responsable}</p>
      )}
    </div>
  );
};

// Recursive <li> node for the desktop/tablet CSS tree.
// Les enfants marqués `side` (ex. COORDINATION) pendent à un trait vertical sous le parent
// (trait horizontal vers leur boîte), au-dessus de la rangée des autres enfants.
export const OrgTreeNode = ({ node, onNodeClick, isClickable, isRoot }) => {
  const kids = node.children || [];
  const sideKids = kids.filter((c) => c.side);
  const mainKids = kids.filter((c) => !c.side);
  return (
    <li>
      <OrgNodeBox
        node={node}
        onNodeClick={onNodeClick}
        isClickable={isClickable}
        size={isRoot ? "lg" : "md"}
      />
      {sideKids.length > 0 && (
        <div className="org-side-row" aria-hidden={false}>
          <span className="stem" />
          <span className="branch" />
          <div className="box">
            {sideKids.map((c) => (
              <OrgNodeBox key={c.name} node={c} onNodeClick={onNodeClick} isClickable={isClickable} size="md" />
            ))}
          </div>
        </div>
      )}
      {mainKids.length > 0 && (
        <ul>
          {mainKids.map((child) => (
            <OrgTreeNode
              key={child.name}
              node={child}
              onNodeClick={onNodeClick}
              isClickable={isClickable}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

// Réduit l'arbre pour qu'il tienne toujours dans la largeur disponible (jamais de défilement horizontal).
const FitToWidth = ({ children }) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });
  useLayoutEffect(() => {
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const natural = inner.scrollWidth;
      const scale = natural > 0 ? Math.min(1, outer.clientWidth / natural) : 1;
      setFit({ scale, height: inner.scrollHeight * scale });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(outerRef.current); ro.observe(innerRef.current); }
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height: fit.height || undefined }}>
      <div
        ref={innerRef}
        className="inline-block"
        style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", marginLeft: `max(0px, calc((100% - ${(innerRef.current?.scrollWidth || 0) * fit.scale}px) / 2))` }}
      >
        {children}
      </div>
    </div>
  );
};

// Remplit exactement sa boîte (largeur ET hauteur) : l'arbre entier est visible d'un coup d'œil.
const FitToBox = ({ children }) => {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, w: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const o = outerRef.current, i = innerRef.current;
      if (!o || !i) return;
      const w = i.scrollWidth, h = i.scrollHeight;
      if (!w || !h) return;
      setFit({ scale: Math.min(o.clientWidth / w, o.clientHeight / h, 2), w, h });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(outerRef.current); ro.observe(innerRef.current); }
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return (
    <div ref={outerRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div ref={innerRef} style={{ position: "absolute", left: "50%", top: "50%", width: "max-content", transform: `translate(-50%, -50%) scale(${fit.scale})`, transformOrigin: "center center" }}>
        {children}
      </div>
    </div>
  );
};

// Plein écran en PAYSAGE : téléphone tenu droit → on tourne l'écran de 90° pour que l'organigramme tienne en entier ;
// téléphone déjà couché → tel quel. Un bouton ferme, toucher un pôle ouvre ses membres.
const OrgFullscreen = ({ data, isClickable, onNodeClick, onClose }) => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    try { window.screen?.orientation?.lock?.("landscape").catch(() => {}); } catch (e) { /* non pris en charge */ }
    return () => {
      window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on);
      try { window.screen?.orientation?.unlock?.(); } catch (e) { /* ignoré */ }
    };
  }, []);
  const portrait = size.h > size.w;
  const frame = portrait
    ? { position: "fixed", top: 0, left: 0, width: size.h, height: size.w, transformOrigin: "top left", transform: `translateX(${size.w}px) rotate(90deg)` }
    : { position: "fixed", inset: 0 };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "hsl(var(--background))" }} role="dialog" aria-label="Organigramme" data-testid="org-fullscreen">
      <div style={frame}>
        <div style={{ position: "absolute", inset: 0, padding: "12px 56px 12px 12px" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <FitToBox>
              <ul className="org-tree inline-flex">
                <OrgTreeNode node={data} onNodeClick={onNodeClick} isClickable={isClickable} isRoot />
              </ul>
            </FitToBox>
          </div>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer" data-testid="org-fullscreen-close"
        style={{ position: "fixed", zIndex: 10, top: "calc(env(safe-area-inset-top) + 0.75rem)", right: "calc(env(safe-area-inset-right) + 0.75rem)" }}
        className="flex h-11 w-11 items-center justify-center rounded-full border bg-background shadow-lg">
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
};

// Téléphone : arbre vertical lisible (chaque niveau décalé, traits de liaison), tout visible sans défiler.
export const OrgTreeVertical = ({ node, onNodeClick, isClickable, depth = 0 }) => {
  const kids = node.children || [];
  return (
    <div>
      <div className={depth ? "relative" : ""}>
        {depth > 0 && <span className="absolute -left-4 top-6 w-4 border-t-2 border-slate-400 dark:border-slate-500" />}
        <OrgNodeBox node={node} onNodeClick={onNodeClick} isClickable={isClickable} size={depth === 0 ? "lg" : "md"} fullWidth />
      </div>
      {kids.length > 0 && (
        <div className="ml-5 mt-2 space-y-2 border-l-2 border-slate-400 pl-4 dark:border-slate-500">
          {kids.map((c) => (
            <OrgTreeVertical key={c.name} node={c} onNodeClick={onNodeClick} isClickable={isClickable} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Phones: same boxes/colors/structure as the PC tree, laid out LEVEL BY
// LEVEL (breadth-first) — every node at generation N always sits in
// generation N's own row, full stop, regardless of which siblings have
// their own children below them. (An earlier version let a level WRAP
// onto a second row when it didn't fit, which visually broke the
// grouping: a childless sibling could land on the same row as another
// sibling's children and look like it belonged to them.) To guarantee
// that never happens again, each row never wraps — if five same-level
// boxes are wider than the screen, that one row scrolls horizontally
// (contained to just that row, same as the Portail Charisma strip
// elsewhere on this page) instead of breaking onto a second line.
// Connector lines are measured after real layout (useLayoutEffect) and
// drawn as SVG elbows straight from each node to its real parent.
export const OrgTreeMobileWithLines = ({ node, onNodeClick, isClickable }) => {
  const containerRef = useRef(null);
  const boxRefs = useRef({});
  const [paths, setPaths] = useState([]);

  // Which nodes start folded: everything from the 3rd generation down
  // (RESP. PAV's grandchildren, e.g. LIVE's INCRUSTATION/DIFFUSION) is
  // detail most people don't need at a glance on a phone, so it's
  // collapsed by default with a fold/unfold toggle on the parent box.
  // The root and its direct branches (PAV, RESP. PAV, and the branches
  // row) always stay visible.
  const [collapsed, setCollapsed] = useState(() => {
    const initial = new Set();
    const walk = (n, depth, id) => {
      if (depth >= 2 && n.children && n.children.length > 0) initial.add(id);
      (n.children || []).forEach((c, i) => walk(c, depth + 1, `${id}.${i}`));
    };
    walk(node, 0, "0");
    return initial;
  });
  const toggleCollapsed = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Breadth-first: group nodes by depth, and keep a flat parent->child
  // edge list to draw lines from (a node's parent is NOT necessarily its
  // visual neighbour once grouped by level, so lines are measured, not
  // assumed from DOM adjacency). Children of a folded node are simply
  // never added to the frontier, so they don't take up a row at all.
  const { levels, edges, collapsibleIds } = useMemo(() => {
    const lv = [];
    const eg = [];
    const cIds = new Set();
    let frontier = [{ id: "0", parentId: null, node, depth: 0 }];
    while (frontier.length) {
      lv.push(frontier);
      const next = [];
      frontier.forEach(({ id, node: n, depth }) => {
        const hasKids = n.children && n.children.length > 0;
        if (depth >= 2 && hasKids) cIds.add(id);
        if (hasKids && !collapsed.has(id)) {
          n.children.forEach((c, i) => {
            const cid = `${id}.${i}`;
            eg.push({ parentId: id, childId: cid });
            next.push({ id: cid, node: c, depth: depth + 1 });
          });
        }
      });
      frontier = next;
    }
    return { levels: lv, edges: eg, collapsibleIds: cIds };
  }, [node, collapsed]);

  const recompute = () => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const next = [];
    edges.forEach(({ parentId, childId }) => {
      const childEl = boxRefs.current[childId];
      const parentEl = boxRefs.current[parentId];
      if (!childEl || !parentEl) return;
      const c = childEl.getBoundingClientRect();
      const p = parentEl.getBoundingClientRect();
      const x1 = p.left + p.width / 2 - containerRect.left;
      const y1 = p.bottom - containerRect.top;
      const x2 = c.left + c.width / 2 - containerRect.left;
      const y2 = c.top - containerRect.top;
      const midY = y1 + (y2 - y1) / 2;
      next.push(`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`);
    });
    setPaths(next);
  };

  useLayoutEffect(() => {
    recompute();
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="2" />
        ))}
      </svg>
      <div
        className="relative flex flex-col items-center gap-8"
        style={{ zIndex: 1 }}
      >
        {levels.map((levelNodes, li) => (
          <div
            key={li}
            className="w-full overflow-x-auto"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorX: "contain",
              touchAction: "pan-x pan-y",
            }}
            onScroll={recompute}
          >
            <div className="flex items-start gap-x-3 px-1 pb-2 w-max mx-auto">
              {levelNodes.map(({ id, node: n }) => (
                <div
                  key={id}
                  className="shrink-0 relative"
                  ref={(el) => {
                    boxRefs.current[id] = el;
                  }}
                >
                  <OrgNodeBox
                    node={n}
                    onNodeClick={onNodeClick}
                    isClickable={isClickable}
                    size={li === 0 ? "lg" : "sm"}
                  />
                  {collapsibleIds.has(id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapsed(id);
                      }}
                      className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background border border-border shadow flex items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={collapsed.has(id) ? "Déplier" : "Replier"}
                      title={collapsed.has(id) ? "Déplier" : "Replier"}
                    >
                      {collapsed.has(id) ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronUp className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Organigramme Component - Professional design with responsive layouts
export const OrgChart = ({ data, onNodeClick, allowedNodes }) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  if (!data) return null;

  const isClickable = (name) =>
    !!BRANCH_MEMBER_MATCH[name] &&
    (!allowedNodes || allowedNodes.includes(name));

  return (
    <div className="w-full">
      <OrgTreeStyles />

      {/* Même arbre partout (PC, tablette, téléphone) : il se réduit pour tenir dans la largeur.
          Sur téléphone, « Agrandir » ouvre l'organigramme en plein écran à taille lisible (défilement / pincement). */}
      <div className="py-4 px-1 md:py-6 md:px-2">
        <div className="md:hidden flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm"
            data-testid="org-zoom-btn"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Agrandir
          </button>
        </div>
        <FitToWidth>
          <ul className="org-tree inline-flex">
            <OrgTreeNode node={data} onNodeClick={onNodeClick} isClickable={isClickable} isRoot />
          </ul>
        </FitToWidth>
      </div>

      {zoomOpen && (
        <OrgFullscreen
          data={data}
          isClickable={isClickable}
          onNodeClick={(n) => { setZoomOpen(false); onNodeClick && onNodeClick(n); }}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
};

// Simple, non-navigable current-month grid: highlights service days
// (from the Planning) and Actualités events (guest events get a distinct
// dot color) so the Dashboard gives an at-a-glance view of the month
// without needing to open Planning/Actualités separately.
export const MiniCalendar = ({
  year,
  month,
  serviceDates = [],
  events = [],
  cours = {},
  canEditCours = false,
  onDayClick,
}) => {
  const pad = (n) => String(n).padStart(2, "0");
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month, 0).getDate();

  const serviceByDate = {};
  serviceDates.forEach((s) => {
    serviceByDate[s.date] = s;
  });
  const eventsByDate = {};
  events.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const datesCles = {};
  datesClesOf(year).forEach((e) => {
    if (e.date.getMonth() === month - 1) datesCles[e.date.getDate()] = e;
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} />;
          const dateStr = `${year}-${pad(month)}-${pad(d)}`;
          const serviceInfo = serviceByDate[dateStr];
          const isService = !!serviceInfo;
          const dayEvents = eventsByDate[dateStr] || [];
          const hasGuest = dayEvents.some((e) => e.invite);
          const hasAbsence = dayEvents.some((e) => e.type === "absence");
          const hasFormation = dayEvents.some((e) => e.type === "formation");
          const hasEvenement = dayEvents.some(
            (e) => e.type === "evenement" && !e.invite,
          );
          const eventRingClass = hasGuest
            ? "ring-1 ring-inset ring-amber-500"
            : hasFormation
              ? "ring-1 ring-inset ring-violet-500"
              : hasEvenement
                ? "ring-1 ring-inset ring-blue-500"
                : hasAbsence
                  ? "ring-1 ring-inset ring-slate-400"
                  : "";
          const isToday = dateStr === todayStr;
          const dateCle = datesCles[d];
          const dayCours = cours[dateStr]?.courses || [];
          const tipLines = [];
          if (dayCours.length)
            tipLines.push({ dot: "bg-teal-500", text: `Cours : ${dayCours.map((c) => (cours[dateStr].titles?.[c] ? `${c} — ${cours[dateStr].titles[c]}` : c)).join(", ")}` });
          if (dateCle)
            tipLines.push({ dot: "bg-pink-500", text: `${dateCle.emoji} ${dateCle.nom}` });
          if (isService)
            tipLines.push({
              dot: "bg-primary",
              text: `Service (${serviceInfo.jour}${serviceInfo.poste ? ` — ${serviceInfo.poste}` : ""})`,
            });
          dayEvents.forEach((e) => {
            const kind = e.invite
              ? { dot: "bg-amber-500", label: "Invité" }
              : e.type === "absence"
                ? { dot: "bg-slate-400", label: "Absence" }
                : e.type === "formation"
                  ? { dot: "bg-violet-500", label: "Formation" }
                  : { dot: "bg-blue-500", label: "Événement" };
            tipLines.push({ dot: kind.dot, text: `${kind.label} : ${e.titre}` });
          });
          const col = idx % 7;
          const tipPos =
            col <= 1 ? "left-0" : col >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
          const title = tipLines.map((l) => l.text).join(" — ");
          // Cliquable dès qu'il y a quelque chose à voir ce jour-là : un
          // service OU un événement (Actualités, absence, formation).
          const isClickable = isService || dayEvents.length > 0 || dayCours.length > 0 || canEditCours;
          const Tag = isClickable ? "button" : "div";
          return (
            <Tag
              key={idx}
              type={isClickable ? "button" : undefined}
              aria-label={title ? `${d} : ${title}` : undefined}
              onClick={
                isClickable
                  ? () => onDayClick?.(dateStr, serviceInfo, dayEvents)
                  : undefined
              }
              className={`group relative aspect-square flex items-center justify-center rounded-md text-xs
${isToday ? "ring-2 ring-primary" : dateCle ? "ring-2 ring-inset ring-pink-500 bg-pink-500/10" : eventRingClass}
${isService ? "bg-primary/10 font-semibold text-primary" : "text-foreground"}
${isClickable ? "cursor-pointer hover:bg-primary/20 transition-colors" : ""}`}
            >
              {d}
              {tipLines.length > 0 && (
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full mb-1 z-50 hidden group-hover:block group-focus-visible:block w-max max-w-[14rem] rounded-md border border-border bg-popover text-popover-foreground shadow-md px-2.5 py-1.5 text-left text-xs font-normal ${tipPos}`}
                >
                  {tipLines.map((l, i) => (
                    <span key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${l.dot}`} />
                      <span className="break-words">{l.text}</span>
                    </span>
                  ))}
                </span>
              )}
              {dateCle && (
                <span
                  className="absolute top-0 right-0.5 text-[11px] leading-none"
                  aria-label={dateCle.nom}
                >
                  {dateCle.emoji}
                </span>
              )}
              {dayCours.length > 0 && (
                <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-teal-500" />
              )}
              {dayEvents.length > 0 && (
                <span className="absolute bottom-0.5 flex items-center gap-0.5">
                  {hasGuest && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                  {hasAbsence && (
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                  )}
                  {hasFormation && (
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                  )}
                  {hasEvenement && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </span>
              )}
            </Tag>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3 text-xs font-medium text-foreground/80">
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-3 h-3 rounded border-2 border-primary bg-primary/20 inline-block" />{" "}
          Jour de service
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />{" "}
          Événement
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />{" "}
          Invité
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />{" "}
          Mon absence
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />{" "}
          Ma formation
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />{" "}
          Cours
        </span>
        <span className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
          <span className="w-3 h-3 rounded border-2 border-pink-500 bg-pink-500/10 inline-block" />{" "}
          Date clé
        </span>
      </div>

    </div>
  );
};
