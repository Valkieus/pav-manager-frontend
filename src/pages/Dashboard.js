import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Users,
  Package,
  FileText,
  GraduationCap,
  IdCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Youtube,
  Globe,
  Building2,
  Calendar,
  Palette,
  ShieldCheck,
  Clock,
  ArrowRight,
  CalendarOff,
  Info,
  Pencil,
  Check,
  X,
  PartyPopper,
  Music,
  AlarmClock,
  Send,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Maps organigramme node names to predicates matched against technicien
// records, so clicking a branch on the chart can show exactly who's in it.
const BRANCH_MEMBER_MATCH = {
  'LIVE': (t) => (t.branches || []).includes('Live'),
  'INCRUSTATION': (t) => (t.branches || []).includes('Live') && (t.sous_branches || []).includes('Incrustation'),
  'DIFFUSION': (t) => (t.branches || []).includes('Live') && (t.sous_branches || []).includes('Diffusion'),
  'ANIMATION': (t) => (t.branches || []).includes('Animation'),
  'RÉGISSEURS': (t) => (t.branches || []).includes('Régisseurs'),
  'COORDINATION': (t) => (t.branches || []).includes('Coordination'),
  'PRODUCTION': (t) => (t.branches || []).includes('Production'),
  'RESP. PAV': (t) => (t.branches || []).includes('Supervision'),
};

// Reverse map: which org-chart nodes a branch-scoped user (Gestionnaire /
// Responsable with a limited `branches` list) is allowed to click into.
const BRANCH_TO_NODES = {
  'Live': ['LIVE', 'INCRUSTATION', 'DIFFUSION'],
  'Animation': ['ANIMATION'],
  'Régisseurs': ['RÉGISSEURS'],
  'Coordination': ['COORDINATION'],
  'Production': ['PRODUCTION'],
  'Supervision': ['RESP. PAV'],
};

// Colors for branches — shared by every OrgChart rendering path (desktop,
// tablet, mobile).
const getBranchColor = (name) => {
  const colors = {
    'PAV': 'bg-primary text-primary-foreground border-primary',
    'RESP. PAV': 'bg-slate-800 text-white border-slate-700',
    'COORDINATION': 'bg-blue-500 text-white border-blue-600',
    'PRODUCTION': 'bg-emerald-500 text-white border-emerald-600',
    'LIVE': 'bg-red-500 text-white border-red-600',
    'INCRUSTATION': 'bg-red-400 text-white border-red-500',
    'DIFFUSION': 'bg-red-400 text-white border-red-500',
    'ANIMATION': 'bg-orange-500 text-white border-orange-600',
    'RÉGISSEURS': 'bg-purple-500 text-white border-purple-600',
  };
  return colors[name] || 'bg-card text-foreground border-border';
};

// CSS-only "family tree" connector: each node is an <li>, siblings are wired
// together with a shared horizontal bar (::before/::after) and a vertical
// stub down from their parent (ul::before). Because every measurement is a
// percentage of the <li> itself, the lines always meet the boxes exactly —
// unlike a fixed-pixel guess, this never drifts when labels/boxes resize.
const OrgTreeStyles = () => (
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
      flex: 1 1 0;
      min-width: 0;
      padding: 28px 14px 0 14px;
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
    .dark .org-tree li:last-child::before, .dark .org-tree ul ul::before {
      border-color: #64748b;
    }
  `}</style>
);

const OrgNodeBox = ({ node, onNodeClick, isClickable, size = 'md' }) => {
  const clickable = isClickable(node.name);
  const pad = size === 'lg' ? 'px-7 py-4' : size === 'sm' ? 'px-3 py-2' : 'px-5 py-3';
  return (
    <div
      onClick={clickable ? () => onNodeClick(node) : undefined}
      className={`
        ${pad} rounded-xl border-2 text-center shadow-sm transition-all duration-200
        hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap
        ${getBranchColor(node.name)}
        ${clickable ? 'cursor-pointer' : ''}
      `}
    >
      <p className={size === 'lg' ? 'font-bold text-base' : 'font-bold text-sm'}>{node.name}</p>
      {node.responsable && (
        <p className="text-xs opacity-90 mt-0.5 italic">{node.responsable}</p>
      )}
    </div>
  );
};

// Recursive <li> node for the desktop/tablet CSS tree.
const OrgTreeNode = ({ node, onNodeClick, isClickable, isRoot }) => {
  const hasChildren = node.children && node.children.length > 0;
  return (
    <li>
      <OrgNodeBox node={node} onNodeClick={onNodeClick} isClickable={isClickable} size={isRoot ? 'lg' : 'md'} />
      {hasChildren && (
        <ul>
          {node.children.map((child) => (
            <OrgTreeNode key={child.name} node={child} onNodeClick={onNodeClick} isClickable={isClickable} />
          ))}
        </ul>
      )}
    </li>
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
const OrgTreeMobileWithLines = ({ node, onNodeClick, isClickable }) => {
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
    walk(node, 0, '0');
    return initial;
  });
  const toggleCollapsed = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    let frontier = [{ id: '0', parentId: null, node, depth: 0 }];
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
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="2" />
        ))}
      </svg>
      <div className="relative flex flex-col items-center gap-8" style={{ zIndex: 1 }}>
        {levels.map((levelNodes, li) => (
          <div
            key={li}
            className="w-full overflow-x-auto"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
            onScroll={recompute}
          >
            <div className="flex items-start gap-x-3 px-1 pb-2 w-max mx-auto">
              {levelNodes.map(({ id, node: n }) => (
                <div key={id} className="shrink-0 relative" ref={(el) => { boxRefs.current[id] = el; }}>
                  <OrgNodeBox node={n} onNodeClick={onNodeClick} isClickable={isClickable} size={li === 0 ? 'lg' : 'sm'} />
                  {collapsibleIds.has(id) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleCollapsed(id); }}
                      className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-background border border-border shadow flex items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={collapsed.has(id) ? 'Déplier' : 'Replier'}
                      title={collapsed.has(id) ? 'Déplier' : 'Replier'}
                    >
                      {collapsed.has(id) ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
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
const OrgChart = ({ data, onNodeClick, allowedNodes }) => {
  if (!data) return null;

  const isClickable = (name) => !!BRANCH_MEMBER_MATCH[name] && (!allowedNodes || allowedNodes.includes(name));

  return (
    <div className="w-full">
      <OrgTreeStyles />

      <div className="hidden lg:flex justify-center overflow-x-auto py-8 px-4">
        <ul className="org-tree inline-flex">
          <OrgTreeNode node={data} onNodeClick={onNodeClick} isClickable={isClickable} isRoot />
        </ul>
      </div>

      <div className="hidden md:flex lg:hidden justify-center overflow-x-auto py-6 px-2">
        <ul className="org-tree inline-flex scale-90 origin-top">
          <OrgTreeNode node={data} onNodeClick={onNodeClick} isClickable={isClickable} isRoot />
        </ul>
      </div>

      {/* Phones: wrapping tree with real measured connector lines (see
          OrgTreeMobileWithLines above) — no horizontal scroll needed,
          everything fits by wrapping down the screen, and it still looks
          like a proper family tree with lines linking each generation. */}
      <div className="md:hidden py-4 px-1">
        <OrgTreeMobileWithLines node={data} onNodeClick={onNodeClick} isClickable={isClickable} />
      </div>
    </div>
  );
};

// Simple, non-navigable current-month grid: highlights service days
// (from the Planning) and Actualités events (guest events get a distinct
// dot color) so the Dashboard gives an at-a-glance view of the month
// without needing to open Planning/Actualités separately.
const MiniCalendar = ({ year, month, serviceDates = [], events = [], onServiceDayClick }) => {
  const pad = (n) => String(n).padStart(2, '0');
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month, 0).getDate();

  const serviceByDate = {};
  serviceDates.forEach((s) => { serviceByDate[s.date] = s; });
  const eventsByDate = {};
  events.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} />;
          const dateStr = `${year}-${pad(month)}-${pad(d)}`;
          const serviceInfo = serviceByDate[dateStr];
          const isService = !!serviceInfo;
          const dayEvents = eventsByDate[dateStr] || [];
          const hasGuest = dayEvents.some((e) => e.invite);
          const hasAbsence = dayEvents.some((e) => e.type === 'absence');
          const hasFormation = dayEvents.some((e) => e.type === 'formation');
          const hasEvenement = dayEvents.some((e) => e.type === 'evenement' && !e.invite);
          const isToday = dateStr === todayStr;
          const title = [
            isService ? `Service (${serviceInfo.jour}${serviceInfo.poste ? ` — ${serviceInfo.poste}` : ''})` : null,
            ...dayEvents.map((e) => e.titre),
          ].filter(Boolean).join(' — ');
          const Tag = isService ? 'button' : 'div';
          return (
            <Tag
              key={idx}
              type={isService ? 'button' : undefined}
              title={title || undefined}
              onClick={isService ? () => onServiceDayClick?.(dateStr, serviceInfo) : undefined}
              className={`relative aspect-square flex items-center justify-center rounded-md text-xs
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isService ? 'bg-primary/10 font-semibold text-primary cursor-pointer hover:bg-primary/20 transition-colors' : 'text-foreground'}`}
            >
              {d}
              {dayEvents.length > 0 && (
                <span className="absolute bottom-0.5 flex items-center gap-0.5">
                  {hasGuest && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  {hasAbsence && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                  {hasFormation && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                  {hasEvenement && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </span>
              )}
            </Tag>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/10 inline-block" /> Jour de service</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" /> Événement</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Invité</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Mon absence</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" /> Ma formation</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, isAdmin, isAdminOrReadOnly } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [techniciens, setTechniciens] = useState([]);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingServiceInfo, setEditingServiceInfo] = useState(false);
  const [serviceInfoDraft, setServiceInfoDraft] = useState('');
  const [savingServiceInfo, setSavingServiceInfo] = useState(false);
  const [retardDialogOpen, setRetardDialogOpen] = useState(false);
  const [retardHeure, setRetardHeure] = useState('');
  const [retardMessage, setRetardMessage] = useState('');
  const [retardSending, setRetardSending] = useState(false);
  // Aperçu rapide au clic sur un jour de service dans le mini calendrier —
  // date + poste occupé ce jour-là + rappel des horaires déjà affiché plus
  // haut sur le Dashboard (service_info_text), pour ne pas avoir à
  // remonter/aller sur Mon planning juste pour vérifier.
  const [dayPreview, setDayPreview] = useState(null);

  const isMembre = user?.niveau_acces === 'Technicien';

  // Fetched on mount, refreshed every 60s, and re-fetched immediately when
  // the tab regains focus — so the résumé rapide / stats / org chart stay
  // current without the user needing to hit reload.
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      // Organigramme + techniciens (for the branch-detail popup) are shown to
      // everyone, Membre included; the operational Stats Grid stays admin+.
      // /techniciens/roster is the PII-free variant (no téléphone/email/badge)
      // reachable by any authenticated role, so the popup keeps working for
      // Technicien even though the full /techniciens list is Responsable+.
      const [orgRes, techRes, briefRes] = await Promise.all([
        axios.get(`${API}/organigramme`),
        axios.get(`${API}/techniciens/roster`).catch(() => ({ data: [] })),
        axios.get(`${API}/dashboard/member-brief`).catch(() => ({ data: null })),
      ]);
      setOrgData(orgRes.data.structure);
      setTechniciens(techRes.data);
      setBrief(briefRes.data);

      if (!isMembre) {
        const statsRes = await axios.get(`${API}/dashboard/stats`);
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServiceInfo = async () => {
    if (!serviceInfoDraft.trim()) return;
    setSavingServiceInfo(true);
    try {
      await axios.put(`${API}/dashboard/service-info`, { text: serviceInfoDraft.trim() });
      setBrief((prev) => ({ ...(prev || {}), service_info_text: serviceInfoDraft.trim() }));
      setEditingServiceInfo(false);
      toast.success('Rappel mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSavingServiceInfo(false);
    }
  };

  const handleSendRetard = async () => {
    if (!retardHeure.trim()) {
      toast.error("Indique une heure d'arrivée estimée");
      return;
    }
    setRetardSending(true);
    try {
      await axios.post(`${API}/planning/retard`, {
        date: brief.retard_today_date,
        heure_estimee: retardHeure.trim(),
        message: retardMessage.trim() || undefined,
      });
      toast.success('Signalement envoyé — le superviseur du jour a été notifié');
      setRetardDialogOpen(false);
      setRetardHeure('');
      setRetardMessage('');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi du signalement");
    } finally {
      setRetardSending(false);
    }
  };

  // PAV Academy entry point (tâche #325) : échange un token SSO opaque
  // à usage unique auprès du backend puis redirige vers le site Netlify
  // séparé de PAV Academy, qui l'échangera contre un JWT classique.
  const [academySsoLoading, setAcademySsoLoading] = useState(false);
  const handleAcademySSO = async () => {
    setAcademySsoLoading(true);
    try {
      const res = await axios.post(`${API}/academy/sso-handoff`, {});
      window.location.href = res.data.redirect_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir PAV Academy");
      setAcademySsoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin/Super Admin keep unrestricted visibility everywhere. A
  // Gestionnaire/Responsable with a non-empty `branches` list is scoped to
  // just their own branch(es) on the Dashboard, per the department's access
  // rules; an empty `branches` list means unrestricted oversight (e.g. Paul).
  const isRestricted = !isAdminOrReadOnly() && (user?.branches?.length > 0);
  const allowedNodes = isRestricted ? user.branches.flatMap((b) => BRANCH_TO_NODES[b] || []) : null;
  const visibleBranchesStats = isRestricted
    ? (stats?.branches_stats || []).filter((item) => user.branches.includes(item.branche))
    : (stats?.branches_stats || []);

  const branchMembers = selectedNode && BRANCH_MEMBER_MATCH[selectedNode.name]
    ? techniciens.filter(BRANCH_MEMBER_MATCH[selectedNode.name])
    : [];

  // Is this user able to act somewhere in the Formations approval chain, or
  // is otherwise entitled to see the pipeline summary (Admins always do)?
  const isCoordination = isAdminOrReadOnly() || (
    ['Gestionnaire', 'Responsable'].includes(user?.niveau_acces) &&
    (user?.branches || []).includes('Coordination')
  );
  const isDirection = isAdminOrReadOnly() || (
    user?.niveau_acces === 'Responsable' && (!user?.branches || user.branches.length === 0)
  );
  const showPipeline = isCoordination || isDirection;

  // "Tu seras de service prochainement le vendredi 3 et le dimanche 19" —
  // joins the upcoming shifts found by the backend (name-matched against
  // this month's/next month's Planning) into a single readable sentence.
  const formatShiftsSentence = (shifts) => {
    if (!shifts || shifts.length === 0) return null;
    const parts = shifts.map((s) => {
      const d = new Date(s.date + 'T00:00:00');
      return `${s.jour} ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    });
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} et le ${parts[parts.length - 1]}`;
  };
  const shiftsSentence = formatShiftsSentence(brief?.upcoming_shifts);
  const upcomingEvents = brief?.upcoming_events || [];
  const formationsCount = brief?.formations_catalogue_count ?? 0;
  const canEditServiceInfo = isAdmin() || user?.niveau_acces === 'Responsable';
  // Automatic like the Planning's current-month calc: computed from the
  // browser's own clock on every render, so it's always right without a
  // deploy — Bonjour before 18h, Bonsoir after.
  const greeting = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir';

  // Bannière d'accueil personnalisée (tâche #304) : sous "Bonjour, prénom",
  // un résumé concret de ce que ce compte peut réellement voir/faire — pas
  // juste son rôle, mais le périmètre effectif (branche, accès Salles/
  // Régisseurs opt-in via groupe — cf. #296/#297). Construit à partir de
  // user.branches et user.module_permissions (union des permissions de
  // groupe, renvoyées par /auth/me).
  const modulePerms = user?.module_permissions || [];
  const hasSallesAccess = ['salles.read', 'salles.write', 'salles.reservations'].some(p => modulePerms.includes(p));
  const hasRegisseursAccess = ['logistique.read', 'logistique.write'].some(p => modulePerms.includes(p));
  const hasAcademyAccess = isAdminOrReadOnly() || ['academy.examiner', 'academy.student'].some(p => modulePerms.includes(p));
  const accessChips = [];
  if (user) {
    if (['Responsable', 'Gestionnaire'].includes(user.niveau_acces)) {
      accessChips.push(user.niveau_acces);
      accessChips.push(isRestricted ? `Effectif : ${user.branches.join(', ')}` : 'Effectif : toutes branches');
      if (hasSallesAccess) accessChips.push('Salles');
      if (hasRegisseursAccess) accessChips.push('Régisseurs');
    } else if (user.niveau_acces === 'Admin (lecture seule)') {
      accessChips.push('Admin (lecture seule) — consultation uniquement');
    } else if (['Admin', 'Super Admin'].includes(user.niveau_acces)) {
      accessChips.push(`${user.niveau_acces} — accès complet`);
    } else if (user.niveau_acces === 'Technicien') {
      accessChips.push('Planning, absences, formations');
    }
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Welcome */}
      <div className="animate-fadeIn gradient-primary rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-14 -left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5" /> {user?.niveau_acces}
            </span>
            <h1 className="text-3xl font-bold">
              {greeting}, {user?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-white/80 mt-1">
              Tableau de bord du département PAV
            </p>
            {accessChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {accessChips.map((chip, i) => (
                  <Badge key={i} className="font-normal text-xs border-transparent bg-white/15 text-white hover:bg-white/20">
                    {chip}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-white/75">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Résumé rapide — personalized quick-info summary, shown to every
          role (Membre included): prochain service, invités à venir, accès
          rapide absence/formations, et un rappel des horaires de service. */}
      <Card className="animate-fadeIn border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PartyPopper className="w-5 h-5 text-primary" />
            Résumé rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              {brief?.service_status_text ? (
                <span className={brief.service_status_text.startsWith('Tu es de service') ? 'font-semibold' : 'text-muted-foreground'}>
                  {brief.service_status_text}
                </span>
              ) : shiftsSentence ? (
                <>Tu seras de service prochainement le <span className="font-semibold">{shiftsSentence}</span> !</>
              ) : (
                <span className="text-muted-foreground">Aucun service prévu prochainement pour toi.</span>
              )}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <PartyPopper className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm">
                {brief?.guests_status_text ? (
                  <span className={brief.guests_status_text.startsWith('Nous avons') ? 'font-semibold' : 'text-muted-foreground'}>
                    {brief.guests_status_text}
                  </span>
                ) : upcomingEvents.length > 0 ? (
                  <>Nous avons <span className="font-semibold">{upcomingEvents.length} invité{upcomingEvents.length > 1 ? 's' : ''}</span> prochainement : {upcomingEvents.map(e => e.titre).join(', ')}.</>
                ) : (
                  <span className="text-muted-foreground">Aucun invité prévu pour le moment.</span>
                )}
              </p>
              {(brief?.guests_detail || []).length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {brief.guests_detail.map((g, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-medium text-foreground">{new Date(g.date_evenement + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span>{g.titre}{g.invite_nom ? ` — ${g.invite_nom}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="justify-start" onClick={() => navigate('/mon-espace')}>
              <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
              Absent prochainement ? Renseigne-le ici
            </Button>
            <Button size="sm" variant="outline" className="justify-start" onClick={() => navigate('/formations')}>
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              {formationsCount} formation{formationsCount !== 1 ? 's' : ''} disponible{formationsCount !== 1 ? 's' : ''}, découvrir ici
            </Button>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-border">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            {editingServiceInfo ? (
              <div className="flex-1 space-y-2">
                <Textarea
                  value={serviceInfoDraft}
                  onChange={(e) => setServiceInfoDraft(e.target.value)}
                  className="text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={savingServiceInfo} onClick={handleSaveServiceInfo}>
                    {savingServiceInfo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingServiceInfo(false)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex-1">
                {brief?.service_info_text}
                {canEditServiceInfo && (
                  <button
                    className="ml-2 opacity-60 hover:opacity-100 inline-flex align-middle"
                    title="Modifier ce rappel"
                    onClick={() => { setServiceInfoDraft(brief?.service_info_text || ''); setEditingServiceInfo(true); }}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendrier du mois — vue basique, non-navigable, des jours de
          service et des événements Actualités du mois en cours. Visible à
          tous les rôles comme le Résumé rapide. */}
      <Card className="animate-fadeIn">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg capitalize">
            <Calendar className="w-5 h-5 text-primary" />
            {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MiniCalendar
            year={new Date().getFullYear()}
            month={new Date().getMonth() + 1}
            serviceDates={brief?.calendar_service_dates || []}
            events={[...(brief?.calendar_events || []), ...(brief?.calendar_personal || [])]}
            onServiceDayClick={(dateStr, serviceInfo) => setDayPreview({ date: dateStr, ...serviceInfo })}
          />
          {brief?.retard_enabled && brief?.retard_is_scheduled_today && (
            <div className="mt-4 pt-3 border-t border-border">
              <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setRetardDialogOpen(true)}>
                <AlarmClock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Je vais être en retard ce {brief.retard_today_service_type === 'dimanche' ? 'dimanche' : 'vendredi'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* À traiter — Formations & Devis pipeline. Only surfaced to people who
          can actually act on one of these stages, so it reads as a worklist
          rather than noise for everyone else. */}
      {showPipeline && (
        <div className="animate-fadeIn">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">À traiter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {isCoordination && (
              <Card className="card-hover cursor-pointer border-amber-200 dark:border-amber-900" onClick={() => navigate('/formations')}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Formations — Coordination</p>
                    <p className="text-2xl font-bold">{stats?.formations_en_attente_coordination ?? 0}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            )}
            {isDirection && (
              <Card className="card-hover cursor-pointer border-violet-200 dark:border-violet-900" onClick={() => navigate('/formations')}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Formations — Validation finale</p>
                    <p className="text-2xl font-bold">{stats?.formations_en_attente_validation_finale ?? 0}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-violet-600" />
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="card-hover cursor-pointer" onClick={() => navigate('/devis')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devis en attente</p>
                  <p className="text-2xl font-bold">{stats?.devis_en_attente ?? 0}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Stats Grid — operational KPIs, not relevant for a plain Membre */}
      {!isMembre && (
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="card-hover animate-fadeIn cursor-pointer"
            data-testid="stat-effectif"
            onClick={() => navigate('/effectif')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Effectif Total</p>
                  <p className="text-3xl font-bold mt-1">{stats?.total_techniciens || 0}</p>
                  <p className="text-xs text-muted-foreground mt-2">Techniciens actifs</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="card-hover animate-fadeIn stagger-1 cursor-pointer"
            data-testid="stat-badges"
            onClick={() => navigate('/effectif')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Badges</p>
                  <p className="text-3xl font-bold mt-1">{stats?.badges_attribues || 0}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Attribués
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {stats?.badges_non_attribues || 0} en attente
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <IdCard className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="card-hover animate-fadeIn stagger-2 cursor-pointer"
            data-testid="stat-materiel"
            onClick={() => navigate('/logistique')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Matériel</p>
                  <p className="text-3xl font-bold mt-1">{stats?.total_materiel || 0}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="text-emerald-500 font-medium">{stats?.materiel_disponible || 0}</span> disponible
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="card-hover animate-fadeIn stagger-3 cursor-pointer"
            data-testid="stat-pending"
            onClick={() => navigate('/formations')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-2xl font-bold">{stats?.devis_en_attente || 0}</p>
                      <p className="text-xs text-muted-foreground">Devis</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.formations_en_attente || 0}</p>
                      <p className="text-xs text-muted-foreground">Formations</p>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="card-hover animate-fadeIn stagger-4 cursor-pointer"
            data-testid="stat-salles"
            onClick={() => navigate('/salles')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Salles</p>
                  <p className="text-3xl font-bold mt-1">{stats?.total_salles || 0}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {stats?.reservations_en_attente || 0} en attente
                    </span>
                    <span className="text-xs text-emerald-500">
                      {stats?.reservations_validees || 0} validées
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Portail Charisma */}
      <Card className="animate-fadeIn stagger-4 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Portail Charisma
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bandeau: one compact horizontal strip instead of stacked
                full-width cards — each link scrolls into view rather than
                taking its own row. */}
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              <a
                href="https://www.charisma.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">Site Web Charisma</p>
                  <p className="text-xs text-muted-foreground">www.charisma.fr</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>

              <a
                href="https://www.youtube.com/@CHARISMATV1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-red-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <Youtube className="w-4 h-4 text-red-500" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-red-500 transition-colors">Charisma TV</p>
                  <p className="text-xs text-muted-foreground">@CHARISMATV1</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>

              {!isMembre && (
              <a
                href="https://acadarts.charisma.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-purple-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4 text-purple-500" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-purple-500 transition-colors">Académie des Arts</p>
                  <p className="text-xs text-muted-foreground">acadarts.charisma.fr</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>
              )}

              {/* PAV Academy — entrée SSO (tâche #325) vers le site
                  d'entraînement/examen séparé, réservée aux comptes ayant
                  l'accès academy.examiner ou academy.student. */}
              {hasAcademyAccess && (
              <button
                type="button"
                onClick={handleAcademySSO}
                disabled={academySsoLoading}
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-emerald-500/50 hover:shadow-md transition-all group disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  {academySsoLoading ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  ) : (
                    <Award className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="whitespace-nowrap text-left">
                  <p className="font-medium text-sm group-hover:text-emerald-600 transition-colors">PAV Academy</p>
                  <p className="text-xs text-muted-foreground">Formation &amp; examens</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </button>
              )}

              {/* Cahier de Louange (CEC songs) — visible à tous, y compris
                  Membre/Technicien, contrairement aux autres liens de ce
                  bandeau réservés à partir de Gestionnaire. */}
              <a
                href="https://cec-songs.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-amber-600" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-amber-600 transition-colors">Cahier de Louange</p>
                  <p className="text-xs text-muted-foreground">cec-songs.netlify.app</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>

              {/* Recherche Biblique — visible à tous, comme le Cahier de
                  Louange ci-dessus. */}
              <a
                href="https://quick-bible-search.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-sky-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-sky-600 transition-colors">Recherche Biblique</p>
                  <p className="text-xs text-muted-foreground">quick-bible-search.netlify.app</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Branches Stats */}
      {!isMembre && visibleBranchesStats.length > 0 && (
        <Card className="animate-fadeIn stagger-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Répartition par Branche
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bandeau: single scrollable strip instead of a wrapped grid. */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {visibleBranchesStats.map((item) => (
                <Badge
                  key={item.branche}
                  variant="outline"
                  className="px-3 py-1.5 text-sm shrink-0 whitespace-nowrap"
                >
                  {item.branche}: <span className="font-bold ml-1">{item.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organigramme — visible to everyone, Membre included */}
      <Card className="animate-fadeIn stagger-5">
        <CardHeader>
          <CardTitle>Organigramme PAV</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgChart data={orgData} onNodeClick={setSelectedNode} allowedNodes={allowedNodes} />
        </CardContent>
      </Card>

      {/* Branch detail dialog: name + responsables (italic) on the left,
          scrollable member list on the right. */}
      <Dialog open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DialogContent className="max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-h-[300px]">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold">{selectedNode?.name}</h2>
              {selectedNode?.responsable && (
                <p className="text-muted-foreground italic mt-1">{selectedNode.responsable}</p>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                {branchMembers.length} personne{branchMembers.length !== 1 ? 's' : ''}
              </p>
              {!isMembre && (
                <button
                  className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  onClick={() => { setSelectedNode(null); navigate('/effectif'); }}
                >
                  Voir dans l'Effectif <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {branchMembers.map((t) => {
                  const nomComplet = [t.prenom, t.nom].filter(Boolean).join(' ');
                  const badge = (t.organigramme_label || t.poste_principal) && (
                    <Badge variant="secondary" className="text-xs">{t.organigramme_label || t.poste_principal}</Badge>
                  );
                  // Technicien voit les noms de l'organigramme mais n'a pas
                  // accès à la fiche individuelle (page Effectif).
                  if (isMembre) {
                    return (
                      <div key={t.id} className="w-full flex items-center justify-between py-1.5 px-2 rounded">
                        <span className="text-sm">{nomComplet}</span>
                        {badge}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedNode(null); navigate(`/effectif?tech=${t.id}`); }}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-left transition-colors"
                    >
                      <span className="text-sm text-primary hover:underline">{nomComplet}</span>
                      {badge}
                    </button>
                  );
                })}
                {branchMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun membre trouvé</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signaler un retard — visible seulement quand la fonctionnalité est
          activée en Administration ET que l'utilisateur est planifié
          aujourd'hui (les deux vérifiés côté serveur également). */}
      <Dialog open={retardDialogOpen} onOpenChange={setRetardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlarmClock className="w-5 h-5 text-amber-600" />
              Signaler un retard
            </DialogTitle>
            <DialogDescription>
              Le/la superviseur du jour, le Responsable PAV et les Responsables Coordination seront notifiés immédiatement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Heure d'arrivée estimée</Label>
              <Input
                placeholder="Ex: 18h45"
                value={retardHeure}
                onChange={(e) => setRetardHeure(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message (optionnel)</Label>
              <Textarea
                placeholder="Ex: bloqué dans les transports..."
                value={retardMessage}
                onChange={(e) => setRetardMessage(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetardDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSendRetard} disabled={retardSending}>
              {retardSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu rapide d'un jour de service cliqué dans le mini-calendrier */}
      <Dialog open={!!dayPreview} onOpenChange={(open) => !open && setDayPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Jour de service
            </DialogTitle>
            <DialogDescription>
              {dayPreview && new Date(dayPreview.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="capitalize">{dayPreview?.jour}</Badge>
              {dayPreview?.poste && (
                <span className="font-medium text-foreground">{dayPreview.poste}</span>
              )}
            </div>
            {brief?.service_info_text && (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{brief.service_info_text}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayPreview(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
