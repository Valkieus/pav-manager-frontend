import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Loader2 } from 'lucide-react';
import { API, BRANCH_MEMBER_MATCH, BRANCH_TO_NODES, OrgChart } from './dashboard/widgets';
import { DayPreviewDialog } from './dashboard/DayPreviewDialog';
import { RetardDialog } from './dashboard/RetardDialog';
import { OrgNodeDialog } from './dashboard/OrgNodeDialog';
import { CharismaDialog } from './dashboard/CharismaDialog';
import { PortalEditorDialog } from './dashboard/PortalEditorDialog';
import { mergeLinks, visibleLinks } from './dashboard/portalLinks';
import { openSongsSite } from '../lib/songs';
import { DashboardOrgCard } from './dashboard/DashboardOrgCard';
import { DashboardStatsSection } from './dashboard/DashboardStatsSection';
import { DashboardMonthCard } from './dashboard/DashboardMonthCard';
import { DashboardTodayCard } from './dashboard/DashboardTodayCard';
import { DashboardWelcome } from './dashboard/DashboardWelcome';
import { MonBadgeCard } from './dashboard/MonBadgeCard';





















export default function Dashboard() {
  const { user, isAdmin, isAdminOrReadOnly, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [techniciens, setTechniciens] = useState([]);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingServiceInfo, setEditingServiceInfo] = useState(false);
  const [serviceInfoDraft, setServiceInfoDraft] = useState("");
  const [savingServiceInfo, setSavingServiceInfo] = useState(false);
  const [retardDialogOpen, setRetardDialogOpen] = useState(false);
  const [retardHeure, setRetardHeure] = useState("");
  const [retardMessage, setRetardMessage] = useState("");
  const [retardSending, setRetardSending] = useState(false);
  // Portail Charisma sur mobile (demande 28/09/2026) : au lieu de forcer un
  // défilement horizontal des liens, un clic ouvre une liste verticale dans
  // une fenêtre qui reste sur PAV Manager (pas de navigation, juste un
  // Dialog) — plus lisible et plus "user friendly" au doigt.
  const [charismaOpen, setCharismaOpen] = useState(false);
  const [portalStored, setPortalStored] = useState(null); // barre Portail : configuration du Super Admin (null = par défaut)
  const [portalEditorOpen, setPortalEditorOpen] = useState(false);
  // Aperçu rapide au clic sur un jour de service dans le mini calendrier —
  // date + poste occupé ce jour-là + rappel des horaires déjà affiché plus
  // haut sur le Dashboard (service_info_text), pour ne pas avoir à
  // remonter/aller sur Mon planning juste pour vérifier.
  const [dayPreview, setDayPreview] = useState(null);
  // Navigation du mini-calendrier : le mois courant utilise les données du
  // résumé (service + éléments personnels + événements) ; un autre mois ne
  // charge que les événements Actualités (route dédiée).
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() + 1 };
  });
  const [calOtherEvents, setCalOtherEvents] = useState([]);
  const nowForCal = new Date();
  const isCurrentCalMonth =
    calView.year === nowForCal.getFullYear() &&
    calView.month === nowForCal.getMonth() + 1;
  useEffect(() => {
    if (isCurrentCalMonth) {
      setCalOtherEvents([]);
      return;
    }
    let cancelled = false;
    axios
      .get(`${API}/dashboard/calendar-events`, {
        params: { annee: calView.year, mois: calView.month },
      })
      .then((res) => !cancelled && setCalOtherEvents(res.data.events || []))
      .catch(() => !cancelled && setCalOtherEvents([]));
    return () => {
      cancelled = true;
    };
  }, [calView, isCurrentCalMonth]);
  const [cours, setCours] = useState({ days: {}, available: [] });
  const loadCours = useCallback(() => {
    axios
      .get(`${API}/dashboard/cours`, {
        params: { year: calView.year, month: calView.month },
      })
      .then((res) => setCours(res.data))
      .catch(() => setCours({ days: {}, available: [] }));
  }, [calView]);
  useEffect(() => {
    loadCours();
  }, [loadCours]);
  const shiftCalMonth = (delta) =>
    setCalView((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  const isMembre = user?.niveau_acces === "Technicien";

  // Fetched on mount, refreshed every 60s, and re-fetched immediately when
  // the tab regains focus — so the résumé rapide / stats / org chart stay
  // current without the user needing to hit reload.
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
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
      axios.get(`${API}/dashboard/portal-links`).then((r) => setPortalStored(r.data.links)).catch(() => {});
      const [orgRes, techRes, briefRes] = await Promise.all([
        axios.get(`${API}/organigramme`),
        axios.get(`${API}/techniciens/roster`).catch(() => ({ data: [] })),
        axios
          .get(`${API}/dashboard/member-brief`)
          .catch(() => ({ data: null })),
      ]);
      setOrgData(orgRes.data.structure);
      setTechniciens(techRes.data);
      setBrief(briefRes.data);

      if (!isMembre) {
        const statsRes = await axios.get(`${API}/dashboard/stats`);
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServiceInfo = async () => {
    if (!serviceInfoDraft.trim()) return;
    setSavingServiceInfo(true);
    try {
      await axios.put(`${API}/dashboard/service-info`, {
        text: serviceInfoDraft.trim(),
      });
      setBrief((prev) => ({
        ...(prev || {}),
        service_info_text: serviceInfoDraft.trim(),
      }));
      setEditingServiceInfo(false);
      toast.success("Rappel mis à jour");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
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
      toast.success(
        "Signalement envoyé — le superviseur du jour a été notifié",
      );
      setRetardDialogOpen(false);
      setRetardHeure("");
      setRetardMessage("");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de l'envoi du signalement",
      );
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
      toast.error(
        err.response?.data?.detail || "Impossible d'ouvrir PAV Academy",
      );
      setAcademySsoLoading(false);
    }
  };

  // PAV LED : ouvre le site LED déjà connecté (jeton à usage unique) ; la fenêtre est ouverte tout de suite pour éviter le blocage popup.
  const [ledSsoLoading, setLedSsoLoading] = useState(false);
  const handleLedSSO = async () => {
    const win = window.open("", "_blank");
    setLedSsoLoading(true);
    try {
      const res = await axios.post(`${API}/led/sso-handoff`);
      if (win) win.location.href = res.data.redirect_url;
      else window.location.href = res.data.redirect_url;
    } catch (err) {
      if (win) win.close();
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir PAV LED");
    } finally {
      setLedSsoLoading(false);
    }
  };
  const openPortalLink = (link) => {
    if (link.kind === "academy") handleAcademySSO();
    else if (link.kind === "led") handleLedSSO();
    else if (link.kind === "songs") openSongsSite();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin/Super Admin keep unrestricted visibility everywhere. A
  // Coordination/Responsable with a non-empty `branches` list is scoped to
  // just their own branch(es) on the Dashboard, per the department's access
  // rules; an empty `branches` list means unrestricted oversight (e.g. Paul).
  const isRestricted = !isAdminOrReadOnly() && user?.branches?.length > 0;
  const allowedNodes = isRestricted
    ? user.branches.flatMap((b) => BRANCH_TO_NODES[b] || [])
    : null;
  const visibleBranchesStats = isRestricted
    ? (stats?.branches_stats || []).filter((item) =>
        user.branches.includes(item.branche),
      )
    : stats?.branches_stats || [];

  const branchMembers =
    selectedNode && BRANCH_MEMBER_MATCH[selectedNode.name]
      ? techniciens.filter(BRANCH_MEMBER_MATCH[selectedNode.name])
      : [];

  // "Tu seras de service prochainement le vendredi 3 et le dimanche 19" —
  // joins the upcoming shifts found by the backend (name-matched against
  // this month's/next month's Planning) into a single readable sentence.
  const formatShiftsSentence = (shifts) => {
    if (!shifts || shifts.length === 0) return null;
    const parts = shifts.map((s) => {
      const d = new Date(s.date + "T00:00:00");
      return `${s.jour} ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
    });
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} et le ${parts[parts.length - 1]}`;
  };
  const shiftsSentence = formatShiftsSentence(brief?.upcoming_shifts);
  const upcomingEvents = brief?.upcoming_events || [];
  const formationsCount = brief?.formations_catalogue_count ?? 0;
  const canEditServiceInfo = isAdmin() || user?.niveau_acces === "Responsable";
  // Automatic like the Planning's current-month calc: computed from the
  // browser's own clock on every render, so it's always right without a
  // deploy — Bonjour before 18h, Bonsoir after.
  const greeting = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  // Bannière d'accueil personnalisée (tâche #304) : sous "Bonjour, prénom",
  // un résumé concret de ce que ce compte peut réellement voir/faire — pas
  // juste son rôle, mais le périmètre effectif (branche, accès Salles/
  // Régisseurs opt-in via groupe — cf. #296/#297). Construit à partir de
  // user.branches et user.module_permissions (union des permissions de
  // groupe, renvoyées par /auth/me).
  const modulePerms = user?.module_permissions || [];
  const hasSallesAccess = [
    "salles.read",
    "salles.write",
    "salles.reservations",
  ].some((p) => modulePerms.includes(p));
  const hasRegisseursAccess = ["logistique.read", "logistique.write"].some(
    (p) => modulePerms.includes(p),
  );

  // Vue d'ensemble (demande 28/09/2026) : Effectif Total / Badges / Devis+
  // Formations sont des chiffres globaux à l'échelle de toute l'église —
  // réservés à Coordination+ (Coordination, Admin, Admin lecture seule,
  // Super Admin). Un Responsable garde une vue "Mon équipe" scopée à ses
  // propres branches à la place, et — s'il gère les Régisseurs — garde
  // aussi Incidents/Devis/Matériel visibles rapidement, ce qui concerne
  // directement son équipe.
  const isCoordinationPlus =
    isAdminOrReadOnly() ||
    ["Coordination", "Admin", "Super Admin"].includes(user?.niveau_acces);
  const isResponsableRole = user?.niveau_acces === "Responsable";
  const myTeamCount =
    isResponsableRole && (user?.branches || []).length > 0
      ? techniciens.filter((t) =>
          (t.branches || []).some((b) => (user.branches || []).includes(b)),
        ).length
      : 0;
  const hasAcademyAccess =
    isAdminOrReadOnly() ||
    ["academy.examiner", "academy.student"].some((p) =>
      modulePerms.includes(p),
    );
  const hasLedAccess =
    isAdminOrReadOnly() || ["led.read", "led.write"].some((p) => modulePerms.includes(p));
  const portalAll = mergeLinks(portalStored);
  const portalLinks = visibleLinks(portalAll, { niveau: user?.niveau_acces, hasAcademyAccess, hasLedAccess });
  const portalBusyKind = academySsoLoading ? "academy" : ledSsoLoading ? "led" : null;
  const accessChips = [];
  if (user) {
    if (["Responsable", "Coordination"].includes(user.niveau_acces)) {
      accessChips.push(user.niveau_acces);
      accessChips.push(
        isRestricted
          ? `Effectif : ${user.branches.join(", ")}`
          : "Effectif : toutes branches",
      );
      if (hasSallesAccess) accessChips.push("Salles");
      if (hasRegisseursAccess) accessChips.push("Régisseurs");
    } else if (user.niveau_acces === "Admin (lecture seule)") {
      accessChips.push("Admin (lecture seule) — consultation uniquement");
    } else if (["Admin", "Super Admin"].includes(user.niveau_acces)) {
      accessChips.push(`${user.niveau_acces} — accès complet`);
    } else if (user.niveau_acces === "Technicien") {
      accessChips.push("Planning, absences, formations");
    }
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Welcome */}
      <DashboardWelcome
            accessChips={accessChips}
            greeting={greeting}
            user={user}
          />

      {/* Badge validé : à afficher en plein écran (paysage) les jours de service */}
      <MonBadgeCard user={user} />

      {/* Résumé rapide + Calendrier — côte à côte sur desktop (au lieu
d'empiler deux cartes pleine largeur) : ça évite au calendrier de
s'étirer sur toute la largeur de page, ce qui rendait ses cases
démesurément grandes sur PC. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="min-w-0">
      {/* Résumé rapide — personalized quick-info summary, shown to every
role (Membre included): prochain service, invités à venir, accès
rapide absence/formations, et un rappel des horaires de service. */}
      <DashboardTodayCard
            brief={brief}
            canEditServiceInfo={canEditServiceInfo}
            editingServiceInfo={editingServiceInfo}
            formationsCount={formationsCount}
            handleSaveServiceInfo={handleSaveServiceInfo}
            navigate={navigate}
            savingServiceInfo={savingServiceInfo}
            serviceInfoDraft={serviceInfoDraft}
            setEditingServiceInfo={setEditingServiceInfo}
            setServiceInfoDraft={setServiceInfoDraft}
            shiftsSentence={shiftsSentence}
            upcomingEvents={upcomingEvents}
          />

      </div>
      <div className="min-w-0">
      {/* Calendrier du mois — vue basique, non-navigable, des jours de
service et des événements Actualités du mois en cours. Visible à
tous les rôles comme le Résumé rapide. Col-span réduit à 2 (comme le
Résumé rapide) pour équilibrer la largeur — sinon le calendrier
paraît disproportionné sur desktop. */}
      <DashboardMonthCard
            brief={brief}
            calOtherEvents={calOtherEvents}
            cours={cours}
            canEditCours={isAdmin()}
            calView={calView}
            isCurrentCalMonth={isCurrentCalMonth}
            setCalView={setCalView}
            setDayPreview={setDayPreview}
            setRetardDialogOpen={setRetardDialogOpen}
            shiftCalMonth={shiftCalMonth}
          />

      </div>
      </div>

      {/* Stats Grid — operational KPIs, not relevant for a plain Membre */}
      {!isMembre && (
        <DashboardStatsSection
            hasRegisseursAccess={hasRegisseursAccess}
            isCoordinationPlus={isCoordinationPlus}
            isResponsableRole={isResponsableRole}
            myTeamCount={myTeamCount}
            navigate={navigate}
            stats={stats}
            user={user}
          />
      )}



      {/* Portail Charisma */}
      <DashboardOrgCard
            busyKind={portalBusyKind}
            canEdit={isSuperAdmin()}
            links={portalLinks}
            onEdit={() => setPortalEditorOpen(true)}
            onOpenLink={openPortalLink}
            setCharismaOpen={setCharismaOpen}
          />

            <CharismaDialog
            busyKind={portalBusyKind}
            charismaOpen={charismaOpen}
            links={portalLinks}
            onOpenLink={openPortalLink}
            setCharismaOpen={setCharismaOpen}
          />
          {isSuperAdmin() && (
            <PortalEditorDialog open={portalEditorOpen} onOpenChange={setPortalEditorOpen} links={portalAll} onSaved={setPortalStored} />
          )}

      {/* Organigramme — visible to everyone, Membre included */}
      <Card className="animate-fadeIn stagger-5 rounded-2xl border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle>Organigramme PAV</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgChart
            data={orgData}
            onNodeClick={setSelectedNode}
            allowedNodes={allowedNodes}
          />
        </CardContent>
      </Card>

      {/* Branch detail dialog: name + responsables (italic) on the left,
scrollable member list on the right. */}
      <OrgNodeDialog
            branchMembers={branchMembers}
            isMembre={isMembre}
            navigate={navigate}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
          />

      {/* Signaler un retard — visible seulement quand la fonctionnalité est
activée en Administration ET que l'utilisateur est planifié
aujourd'hui (les deux vérifiés côté serveur également). */}
      <RetardDialog
            handleSendRetard={handleSendRetard}
            retardDialogOpen={retardDialogOpen}
            retardHeure={retardHeure}
            retardMessage={retardMessage}
            retardSending={retardSending}
            setRetardDialogOpen={setRetardDialogOpen}
            setRetardHeure={setRetardHeure}
            setRetardMessage={setRetardMessage}
          />

      {/* Aperçu rapide d'un jour de service cliqué dans le mini-calendrier */}
      <DayPreviewDialog
            brief={brief}
            dayPreview={dayPreview}
            cours={cours}
            canEditCours={isAdmin()}
            onCoursSaved={loadCours}
            navigate={navigate}
            setDayPreview={setDayPreview}
          />
    </div>
  );
}
