import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import axios from "axios";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Package,
  FileText,
  GraduationCap,
  Settings,
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Building2,
  X,
  Loader2,
  KeyRound,
  Newspaper,
  FolderOpen,
  AlertTriangle,
  CalendarOff,
  Bell,
  Check,
  Inbox,
  Sparkles,
  BellRing,
  BellOff,
  Copy,
  MessageSquare,
  Eye,
  EyeOff,
  Download,
  Share,
  PlusSquare,
  ArrowDown,
  Lightbulb,
} from "lucide-react";
import {
  isPushSupported,
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "../utils/push";
import {
  subscribeInstallAvailability,
  triggerInstallPrompt,
  isStandaloneDisplay,
  isIOSDevice,
  isSafariDesktop,
} from "../utils/pwaInstall";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// First-login onboarding guide content, one entry per permission level —
// shown once (right after login / the forced password-change popup),
// dismissed permanently via the "onboarding_seen" flag on the account.
const ONBOARDING_CONTENT = {
  Technicien: {
    title: "Bienvenue sur PAV Manager !",
    points: [
      "Votre tableau de bord affiche vos prochains services et les invités à venir.",
      "Une absence à venir ? Déclarez-la en un clic depuis « Mon espace ».",
      "Découvrez les formations disponibles et l'organigramme du département directement depuis le Dashboard.",
      "La cloche en haut à droite vous prévient dès qu'il y a du nouveau.",
    ],
  },
  Coordination: {
    title: "Bienvenue à la Coordination PAV !",
    points: [
      "Vous pouvez gérer le Planning, les Devis, les Salles et les Formations selon vos branches.",
      "La cloche en haut à droite signale les demandes qui nécessitent votre attention.",
      "Votre tableau de bord se limite aux branches qui vous sont attribuées.",
    ],
  },
  Responsable: {
    title: "Bienvenue, Responsable !",
    points: [
      "Vous intervenez en validation finale sur les Formations et supervisez vos branches.",
      "Le tableau de bord vous donne une vue d'ensemble : Devis, Formations, Effectif, Salles.",
      "La cloche en haut à droite regroupe toutes les notifications qui vous concernent.",
    ],
  },
  Admin: {
    title: "Bienvenue, Administrateur !",
    points: [
      "Vous avez accès en écriture à l'ensemble du département : Effectif, Planning, Devis, Salles, Documents, Actualités, Formations.",
      "L'onglet Administration vous permet de gérer les utilisateurs, les groupes et les droits d'accès.",
      "Le redémarrage serveur, la purge des logs, la migration de données, le quota de stockage et le mode maintenance restent réservés au Super Admin.",
    ],
  },
  "Admin (lecture seule)": {
    title: "Bienvenue, Administrateur (lecture seule) !",
    points: [
      "Vous avez une vue d'ensemble complète du département, sans restriction de branche.",
      "L'onglet Administration vous permet de consulter les journaux d'activité et la supervision du système.",
      "Votre accès est en lecture seule : les actions de création, modification et suppression ne sont pas disponibles.",
    ],
  },
  "Super Admin": {
    title: "Bienvenue, Super Admin !",
    points: [
      "Vous avez un accès complet : gestion des utilisateurs, des groupes de permissions et du mode maintenance.",
      "L'onglet Administration vous permet de tout superviser, y compris les journaux d'activité.",
      "La cloche en haut à droite regroupe toutes les notifications importantes.",
    ],
  },
};

// Navigation items with role-based access
// minRole: minimum role required (Technicien < Responsable < Coordination < Admin < Super Admin)
// "Coordination" (ex-"Gestionnaire", renamed, same permissions/hierarchy
// position) ranks above Responsable — Coordination gets Administration
// access (scoped to Groupes & Droits, see Administration.js) while
// Responsable does not.
const navItems = [
  {
    path: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    minRole: "Technicien",
  },
  {
    path: "/actualites",
    icon: Newspaper,
    label: "Actualités",
    minRole: "Technicien",
  },
  {
    path: "/planning",
    icon: CalendarDays,
    label: "Planning",
    minRole: "Technicien",
  },
  {
    path: "/mon-espace",
    icon: CalendarOff,
    label: "Mon espace",
    minRole: "Technicien",
  },
  { path: "/effectif", icon: Users, label: "Effectif", minRole: "Responsable" },
  // Salles/Régisseurs (20/08/2026) : opt-in pour Responsable/Coordination —
  // ces deux rôles ne voient l'entrée que s'ils appartiennent à un groupe
  // qui accorde au moins une des permissions listées ici (RO ou RW). Admin
  // (lecture seule) et au-dessus gardent l'accès total via minRole seul,
  // voir hasAccess() plus bas. Reflète le gating backend (has_any_group_permission).
  {
    path: "/salles",
    icon: Building2,
    label: "Salles",
    minRole: "Responsable",
    groupPerms: ["salles.read", "salles.write", "salles.reservations"],
  },
  {
    path: "/logistique",
    icon: Package,
    label: "Régisseurs",
    minRole: "Responsable",
    groupPerms: ["logistique.read", "logistique.write"],
  },
  {
    path: "/elements-led",
    icon: Lightbulb,
    label: "Éléments LED",
    minRole: "Responsable",
  },
  {
    path: "/devis",
    icon: FileText,
    label: "Devis & Achat",
    minRole: "Responsable",
  },
  {
    path: "/formations",
    icon: GraduationCap,
    label: "Formations",
    minRole: "Technicien",
  },
  {
    path: "/documents",
    icon: FolderOpen,
    label: "Base de connaissance",
    minRole: "Technicien",
  },
  {
    path: "/communication",
    icon: MessageSquare,
    label: "Communication",
    minRole: "Technicien",
  },
  {
    path: "/administration",
    icon: Settings,
    label: "Administration",
    minRole: "Coordination",
  },
];

const ROLE_HIERARCHY = {
  Technicien: 1,
  Responsable: 2,
  Coordination: 3,
  "Admin (lecture seule)": 4,
  Admin: 5,
  "Super Admin": 6,
};

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [maintenance, setMaintenance] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const {
    user,
    logout,
    isSuperAdmin,
    mustChangePassword,
    changePassword,
    canManage,
    onboardingSeen,
    markOnboardingSeen,
  } = useAuth();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Check maintenance mode
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await axios.get(`${API}/maintenance`);
        setMaintenance(res.data);
      } catch (err) {
        console.log("Could not check maintenance mode");
      }
    };
    checkMaintenance();
  }, [location.pathname]);

  // Notification bell — fetched on mount, polled every 20s, and re-fetched
  // immediately whenever the tab regains focus/visibility, so new
  // requests/absences/etc. surface on their own without a full page reload.
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      // The service worker's offline fallback (see service-worker.js) can
      // return a {error, message} object instead of an array on a flaky
      // connection — never trust the shape blindly.
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // silent — non-critical
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications();
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

  // Notifications push (téléphone/navigateur) — état d'abonnement de CET
  // appareil (indépendant du compte : chaque appareil a son propre
  // endpoint PushManager), lu au montage et tenu à jour après chaque action.
  const [pushState, setPushState] = useState({
    supported: false,
    subscribed: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [braveHelpOpen, setBraveHelpOpen] = useState(false);
  const refreshPushState = async () => {
    const s = await getPushSubscriptionState();
    setPushState(s);
  };
  useEffect(() => {
    if (!user) return;
    refreshPushState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Notifications actives par défaut pour tout le monde (demande
  // 28/09/2026) : plutôt que d'attendre que l'utilisateur aille chercher le
  // bouton dans la cloche, on déclenche nous-mêmes une seule fois par
  // navigateur/appareil la demande d'autorisation native dès que l'état
  // d'abonnement est connu et qu'aucun choix n'a encore été fait
  // (Notification.permission === "default"). Le navigateur affichera son
  // propre prompt système — on ne peut pas forcer l'octroi sans geste
  // utilisateur, mais on peut au moins déclencher la demande
  // automatiquement au lieu de la cacher dans un menu. Un flag localStorage
  // évite de re-solliciter à chaque connexion une fois qu'un choix (accordé
  // OU refusé) a été fait.
  useEffect(() => {
    if (!user || !pushState.supported) return;
    if (pushState.subscribed) return;
    if (pushState.permission && pushState.permission !== "default") return;
    if (localStorage.getItem("pav_push_auto_prompted")) return;
    const t = setTimeout(async () => {
      localStorage.setItem("pav_push_auto_prompted", "1");
      await subscribeToPush(axios);
      await refreshPushState();
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pushState.supported, pushState.subscribed, pushState.permission]);

  // Installation de l'app (PWA) — bouton "Installer l'application" visible
  // dans le header, disponible sur PC et téléphone (voir utils/pwaInstall).
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [iosInstallHelpOpen, setIosInstallHelpOpen] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  useEffect(() => {
    setAlreadyInstalled(isStandaloneDisplay());
    const unsub = subscribeInstallAvailability((prompt) => {
      setInstallAvailable(!!prompt);
    });
    return unsub;
  }, []);
  const canShowManualInstallHelp = !alreadyInstalled && (isIOSDevice() || isSafariDesktop());
  const showInstallButton = !alreadyInstalled && (installAvailable || canShowManualInstallHelp);
  const handleInstallClick = async () => {
    if (installAvailable) {
      setInstallBusy(true);
      try {
        const outcome = await triggerInstallPrompt();
        if (outcome === "accepted") {
          toast.success("Application installée");
          setAlreadyInstalled(true);
        }
      } finally {
        setInstallBusy(false);
      }
      return;
    }
    // Chrome/Edge/Android sans prompt capturé (déjà refusé une fois cette
    // session, ou navigateur qui ne l'expose pas) : pas d'API pour
    // déclencher l'install par code, donc on affiche les étapes manuelles —
    // mêmes qu'iOS/Safari.
    setIosInstallHelpOpen(true);
  };

  const [testPushBusy, setTestPushBusy] = useState(false);
  const handleTestPush = async () => {
    setTestPushBusy(true);
    try {
      const res = await axios.post(`${API}/push/test`);
      toast.success(res.data?.message || "Notification de test envoyée");
      fetchNotifications();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de l'envoi du test",
      );
    } finally {
      setTestPushBusy(false);
    }
  };

  const handleCopyBraveSettingsLink = async () => {
    try {
      await navigator.clipboard.writeText("brave://settings/privacy");
      toast.success("Lien copie - colle-le dans un nouvel onglet");
    } catch {
      toast.error(
        "Impossible de copier - tape brave://settings/privacy dans un nouvel onglet",
      );
    }
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPush(axios);
        toast.success("Notifications push désactivées sur cet appareil");
      } else {
        const res = await subscribeToPush(axios);
        if (res.ok) {
          toast.success(
            "Notifications push activées — tu recevras une alerte même app fermée",
          );
        } else if (res.reason === "denied") {
          toast.error(
            "Autorisation refusée — active les notifications pour ce site dans les réglages du navigateur",
          );
        } else if (res.reason === "unsupported") {
          toast.error(
            "Notifications push non supportées sur ce navigateur/appareil",
          );
        } else if (res.reason === "server_disabled") {
          toast.error(
            "Notifications push non configurées côté serveur — contacte l'administrateur",
          );
        } else if (res.reason === "brave_push_disabled") {
          setBraveHelpOpen(true);
        } else if (res.reason === "push_service_unavailable") {
          toast.error(
            "Le service de notifications de ton navigateur est injoignable — vérifie ta connexion, ton pare-feu, ou une extension qui bloque Google.",
            { duration: 8000 },
          );
        } else {
          toast.error(
            `Impossible d'activer les notifications push${res.message ? ` : ${res.message}` : ""}`,
          );
        }
      }
    } finally {
      await refreshPushState();
      setPushBusy(false);
    }
  };

  // Un clic sur une vraie notification système (bannière OS, app fermée)
  // est relayé ici par le service worker via postMessage, pour naviguer dans
  // la SPA déjà ouverte plutôt que de recharger une page blanche.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event) => {
      if (
        event.data &&
        event.data.type === "PUSH_NAVIGATE" &&
        event.data.link
      ) {
        navigate(event.data.link);
        fetchNotifications();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defensive: a malformed/incomplete notification document (missing
  // fields, or a non-array API response served during a network hiccup —
  // see service-worker.js's offline fallback) must never crash the whole
  // app. A bad entry here used to take down the entire render tree with a
  // silent blank page, since nothing above catches render errors — an
  // ErrorBoundary now catches that class of crash too, but this is the
  // actual root cause, so it's fixed at the source.
  const safeNotifications = Array.isArray(notifications)
    ? notifications.filter(Boolean)
    : [];
  const unreadNotifications = safeNotifications.filter((n) => !n.is_read);

  const handleNotificationClick = async (notif) => {
    if (!notif) return;
    try {
      await axios.put(`${API}/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        (Array.isArray(prev) ? prev : []).filter((n) => n && n.id !== notif.id),
      );
    } catch (err) {
      // silent
    }
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`);
      setNotifications((prev) =>
        (Array.isArray(prev) ? prev : []).filter((n) => n && n.is_read),
      );
    } catch (err) {
      toast.error("Erreur lors de la mise à jour des notifications");
    }
  };

  const notifTimeAgo = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  };

  // Check if user has access to a menu item based on role, and — for the
  // handful of items marked groupPerms (Salles, Régisseurs) — based on
  // group membership too, when the user's role is Responsable/Coordination
  // (see comment on navItems above).
  const hasAccess = (item) => {
    if (!user) return true;
    if (item.minRole) {
      const userLevel = ROLE_HIERARCHY[user.niveau_acces] || 0;
      const requiredLevel = ROLE_HIERARCHY[item.minRole] || 0;
      if (userLevel < requiredLevel) return false;
    }
    if (
      item.groupPerms &&
      ["Responsable", "Coordination"].includes(user.niveau_acces)
    ) {
      const perms = user.module_permissions || [];
      return item.groupPerms.some((p) => perms.includes(p));
    }
    return true;
  };

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) => hasAccess(item));

  // Maintenance impacts the roles chosen by Super Admin when activating it.
  // If no specific roles were chosen (legacy behavior), it impacts everyone
  // below Super Admin (Technicien, Coordination, Responsable, Admin) — Super
  // Admin can always get in to fix things, regardless of the selection.
  // #542 : GET /maintenance peut désormais renvoyer PLUSIEURS activations
  // simultanées (entries) — ex: la page Salles ET la page Communication en
  // maintenance en même temps, chacune avec son propre message/rôles visés.
  // On vérifie donc TOUTES les entrées plutôt qu'un seul état.
  const maintenanceEntries = maintenance?.entries || [];
  const entryAppliesToUser = (entry) =>
    !isSuperAdmin() &&
    (!entry.affected_roles ||
      entry.affected_roles.length === 0 ||
      entry.affected_roles.includes(user?.niveau_acces));

  // Scope "site" : le site entier est remplacé par l'écran de maintenance
  // (plus de nav, plus de sidebar). Si plusieurs entrées "site" existaient
  // (ne devrait pas arriver, cf. backend), on prend la première applicable.
  const activeSiteEntry = maintenanceEntries.find(
    (e) => e.scope === "site" && entryAppliesToUser(e),
  );
  const showMaintenancePage = !!activeSiteEntry;

  // Scope "page" : seule la page ciblée par CETTE entrée est concernée, et
  // seul son contenu (pas la nav ni la sidebar) est remplacé par le bloc de
  // maintenance — les autres pages (et les autres entrées) restent
  // utilisables normalement, ce qui permet plusieurs pages en maintenance
  // en même temps.
  const activePageEntry = maintenanceEntries.find(
    (e) =>
      e.scope === "page" &&
      e.page_path === location.pathname &&
      entryAppliesToUser(e),
  );
  const showMaintenanceContentOnly = !activeSiteEntry && !!activePageEntry;

  // Show password change dialog if required
  useEffect(() => {
    if (mustChangePassword) {
      setPasswordDialogOpen(true);
    }
  }, [mustChangePassword]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(newPassword);
      toast.success("Mot de passe modifié avec succès");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          "Erreur lors du changement de mot de passe",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // Swipe left-to-right (starting near the screen's left edge) opens the
  // mobile menu — a common drawer gesture.
  //
  // Fix 28/09/2026 (retour utilisateur : "des fois ils renvoie vers la page
  // precedent[e]") : la zone de départ était 0-24px du bord gauche, qui est
  // EXACTEMENT la zone que iOS Safari / Chrome Android réservent au geste
  // système "swipe depuis le bord = retour page précédente". Ce geste
  // système est intercepté au niveau OS/navigateur, avant nos écouteurs
  // JS — impossible à bloquer avec preventDefault une fois démarré dans
  // cette zone. Résultat : selon la précision du doigt, le swipe ouvrait
  // le menu OU déclenchait le retour navigateur, au hasard.
  // Fix : on démarre la détection un peu plus loin du bord (au-delà de la
  // zone système), et on appelle preventDefault dès qu'on reconnaît notre
  // geste horizontal pour empêcher toute interférence (scroll, swipe-back
  // Chrome Android, rubber-banding iOS) — plus JAMAIS "autre chose" que
  // l'ouverture du menu.
  useEffect(() => {
    let startX = null;
    let startY = null;
    let committed = false; // true une fois qu'on a décidé "c'est notre swipe"
    const SYSTEM_EDGE_ZONE = 18; // zone réservée au geste retour du navigateur, on l'ignore complètement
    const OUTER_ZONE = 70; // au-delà, ce n'est plus un swipe "depuis le bord"
    const SWIPE_THRESHOLD = 60;
    const COMMIT_DEADZONE = 10; // px de mouvement avant de trancher horizontal vs vertical

    const onTouchStart = (e) => {
      committed = false;
      if (window.innerWidth >= 1024) {
        startX = null;
        return;
      }
      if (sidebarOpen) {
        startX = null;
        return;
      }
      const t = e.touches[0];
      if (!t || t.clientX <= SYSTEM_EDGE_ZONE || t.clientX > OUTER_ZONE) {
        startX = null;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e) => {
      if (startX === null) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);

      if (!committed) {
        if (Math.max(Math.abs(dx), dy) < COMMIT_DEADZONE) return;
        if (dx <= 0 || dy > dx) {
          // Pas un swipe horizontal vers la droite : on abandonne cette
          // séquence tactile (laisse le scroll vertical normal se faire).
          startX = null;
          return;
        }
        committed = true;
      }

      // À partir d'ici c'est reconnu comme NOTRE geste : on empêche tout
      // autre comportement (scroll, navigation navigateur) de s'y mêler.
      if (e.cancelable) e.preventDefault();

      if (dx > SWIPE_THRESHOLD) {
        setSidebarOpen(true);
        startX = null;
        committed = false;
      }
    };

    const onTouchEnd = () => {
      startX = null;
      startY = null;
      committed = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getNiveauAccesColor = (niveau) => {
    const colors = {
      "Super Admin": "bg-red-500",
      Admin: "bg-orange-500",
      "Admin (lecture seule)": "bg-amber-500",
      Responsable: "bg-blue-500",
      Coordination: "bg-green-500",
      Technicien: "bg-gray-500",
    };
    return colors[niveau] || "bg-gray-500";
  };

  // Show maintenance page for members
  if (showMaintenancePage) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <AlertTriangle className="w-20 h-20 mx-auto text-yellow-500" />
          <h1 className="text-3xl font-bold">Maintenance en cours</h1>
          <p className="text-muted-foreground text-lg">
            {activeSiteEntry?.message ||
              "Nous effectuons une maintenance. Veuillez réessayer plus tard."}
          </p>
          <div className="pt-4">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
fixed lg:sticky top-0 left-0 z-50 h-screen w-72 sm:w-64
bg-card border-r border-border
transform transition-transform duration-300 ease-in-out
${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/logo.png"
                  alt="PAV"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-foreground truncate">
                  PAV Manager
                </h1>
                <p className="text-xs text-muted-foreground truncate">
                  Gestion Technique
                </p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isUnderMaintenance = maintenanceEntries.some(
                (e) =>
                  e.scope === "page" &&
                  e.page_path === item.path &&
                  entryAppliesToUser(e),
              );
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                  title={isUnderMaintenance ? "Page en maintenance" : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isUnderMaintenance && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  )}
                  {isActive && !isUnderMaintenance && (
                    <ChevronRight className="w-4 h-4 text-white/90 shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.full_name}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${getNiveauAccesColor(user?.niveau_acces)}`}
                  />
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.niveau_acces}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 h-14 sm:h-16">
            <button
              className="lg:hidden p-2 hover:bg-muted rounded-lg -ml-2"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-btn"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-1 sm:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative w-9 h-9 sm:w-10 sm:h-10"
                    data-testid="notifications-bell"
                  >
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                    {unreadNotifications.length > 0 && (
                      <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 bg-red-500 hover:bg-red-500 text-white text-[10px] leading-none flex items-center justify-center">
                        {unreadNotifications.length > 9
                          ? "9+"
                          : unreadNotifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                    <p className="font-medium text-sm">Notifications</p>
                    {unreadNotifications.length > 0 && (
                      <button
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        onClick={handleMarkAllRead}
                      >
                        <Check className="w-3 h-3" /> Tout marquer lu
                      </button>
                    )}
                  </div>
                  {unreadNotifications.length === 0 ? (
                    <div className="py-8 text-center px-4">
                      <Inbox className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucune nouvelle notification
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-80">
                      <div className="divide-y divide-border">
                        {unreadNotifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                          >
                            <p className="text-sm font-medium">{n.titre}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1">
                              {notifTimeAgo(n.created_at)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {pushState.supported && (
                    <div className="border-t border-border px-3 py-2 space-y-1.5">
                      <button
                        type="button"
                        onClick={handleTogglePush}
                        disabled={pushBusy}
                        className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                      >
                        {pushBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : pushState.subscribed ? (
                          <BellRing className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <BellOff className="w-3.5 h-3.5" />
                        )}
                        {pushState.subscribed
                          ? "Notifications push activées sur cet appareil"
                          : "Activer les notifications sur cet appareil"}
                      </button>
                      {pushState.subscribed && (
                        <button
                          type="button"
                          onClick={handleTestPush}
                          disabled={testPushBusy}
                          className="w-full flex items-center gap-2 text-xs text-primary hover:underline disabled:opacity-60"
                        >
                          {testPushBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Envoyer une notification de test
                        </button>
                      )}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {showInstallButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleInstallClick}
                  disabled={installBusy}
                  className="w-9 h-9 sm:w-10 sm:h-10"
                  data-testid="install-app-btn"
                  title="Installer l'application"
                >
                  {installBusy ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="theme-toggle w-9 h-9 sm:w-10 sm:h-10"
                data-testid="theme-toggle"
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 sm:w-10 sm:h-10"
                    data-testid="user-menu"
                  >
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                        {user?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="truncate">{user?.full_name}</span>
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        {user?.niveau_acces}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isSuperAdmin() && (
                    <DropdownMenuItem
                      onClick={() => navigate("/administration")}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Administration
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
          {showMaintenanceContentOnly ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
              <div className="max-w-md text-center space-y-4">
                <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500" />
                <h2 className="text-2xl font-bold">Page en maintenance</h2>
                <p className="text-muted-foreground">
                  {activePageEntry?.message ||
                    "Cette page est temporairement indisponible. Veuillez réessayer plus tard."}
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Force Password Change Dialog */}
      <Dialog
        open={passwordDialogOpen && mustChangePassword}
        onOpenChange={() => {}}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Changement de mot de passe obligatoire
            </DialogTitle>
            <DialogDescription>
              Vous devez changer votre mot de passe pour continuer à utiliser
              l'application.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe *</Label>
<div className="relative">
                <Input
                type={showNewPassword ? "text" : "password"}
value={newPassword}
  onChange={(e) => setNewPassword(e.target.value)}
    placeholder="Minimum 6 caractères"
      required
        className="pr-10"
          />
        {showNewPassword ? (
          <EyeOff
          onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"
              />
              ) : (
                <Eye
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"
              />
              )}
                </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmer le mot de passe *</Label>
<div className="relative">
                <Input
                type={showConfirmPassword ? "text" : "password"}
value={confirmPassword}
  onChange={(e) => setConfirmPassword(e.target.value)}
    placeholder="Répétez le mot de passe"
      required
        className="pr-10"
          />
        {showConfirmPassword ? (
          <EyeOff
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"
              />
              ) : (
                <Eye
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer"
              />
              )}
                </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Changer mon mot de passe
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* First-login Onboarding Guide — shown once, right after login (or
after the forced password change above, if that applied), content
tailored per permission level. */}
      <Dialog
        open={!!user && !mustChangePassword && !onboardingSeen}
        onOpenChange={() => {}}
      >
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {
                (
                  ONBOARDING_CONTENT[user?.niveau_acces] ||
                  ONBOARDING_CONTENT["Technicien"]
                ).title
              }
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
            {(
              ONBOARDING_CONTENT[user?.niveau_acces] ||
              ONBOARDING_CONTENT["Technicien"]
            ).points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground italic pt-1 border-t border-border mt-1">
            — La Coordination &amp; le Responsable du département PAV
          </p>
          <DialogFooter>
            <Button className="w-full" onClick={markOnboardingSeen}>
              J'ai compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={braveHelpOpen} onOpenChange={setBraveHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Activer les notifications sur Brave
            </DialogTitle>
            <DialogDescription>
              Brave bloque par defaut le service Google necessaire aux
              notifications push. Une seule fois par navigateur :
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-4">
            <li>
              Ouvre un nouvel onglet et colle-y{" "}
              <code className="text-foreground bg-muted px-1 rounded">
                brave://settings/privacy
              </code>
            </li>
            <li>
              Active{" "}
              <strong className="text-foreground">
                « Utiliser les services Google pour la messagerie push »
              </strong>
            </li>
            <li>Reviens ici et clique sur « Reessayer »</li>
          </ol>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyBraveSettingsLink}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copier le lien
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBraveHelpOpen(false);
                handleTogglePush();
              }}
            >
              Reessayer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={iosInstallHelpOpen} onOpenChange={setIosInstallHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Installer l'application
            </DialogTitle>
            <DialogDescription>
              {isIOSDevice()
                ? "Sur iPhone/iPad (Safari), l'installation se fait en 2 étapes :"
                : isSafariDesktop()
                  ? "Sur Mac (Safari), l'installation se fait en 2 étapes :"
                  : "Ce navigateur ne propose pas d'installation en un clic — ajoute un raccourci manuellement :"}
            </DialogDescription>
          </DialogHeader>
          {isIOSDevice() ? (
            <>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-4">
                <li className="rounded-lg bg-primary/10 -mx-1 px-2 py-1.5">
                  Appuie sur l'icône{" "}
                  <Share className="w-3.5 h-3.5 inline text-foreground" />{" "}
                  <strong className="text-foreground">Partager</strong> tout
                  en bas de l'écran, dans la barre de Safari
                </li>
                <li>
                  Fais défiler la liste et choisis{" "}
                  <strong className="text-foreground inline-flex items-center gap-1">
                    <PlusSquare className="w-3.5 h-3.5" />
                    Sur l'écran d'accueil
                  </strong>
                </li>
                <li>
                  Confirme en appuyant sur{" "}
                  <strong className="text-foreground">Ajouter</strong> en
                  haut à droite
                </li>
              </ol>
            </>
          ) : isSafariDesktop() ? (
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-4">
              <li>
                Menu <strong className="text-foreground">Fichier</strong> de
                Safari
              </li>
              <li>
                Choisis{" "}
                <strong className="text-foreground">
                  Ajouter au Dock…
                </strong>{" "}
                (macOS Sonoma et plus récent)
              </li>
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Utilise le menu de ton navigateur et cherche « Installer
              l'application » ou « Ajouter à l'écran d'accueil ». Sur
              Chrome/Edge, l'icône d'installation apparaît normalement
              directement dans la barre d'adresse.
            </p>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setIosInstallHelpOpen(false)}>
              Compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demande 28/09/2026 ("facilite la tâche") : iOS ne permet aucune
      installation déclenchée par le site (pas de prompt automatique), donc
      on rend l'étape manuelle la plus évidente possible avec une flèche
      animée qui pointe vers le vrai bouton Partager de Safari, tout en bas
      de l'écran. Rendue ICI, en dehors de <DialogContent> (qui a un
      translate-x/-y CSS pour se centrer — un ancêtre avec transform crée un
      nouveau bloc de référence pour tout descendant en position fixed, donc
      la flèche restait coincée juste sous "Compris" au lieu d'aller
      jusqu'en bas de l'écran réel). */}
      {iosInstallHelpOpen && isIOSDevice() && (
        <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none z-[100]">
          <ArrowDown className="w-8 h-8 text-primary animate-bounce drop-shadow-lg" />
        </div>
      )}
    </div>
  );
};
