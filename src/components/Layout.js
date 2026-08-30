import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import axios from 'axios';
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
  BellOff
} from 'lucide-react';
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from '../utils/push';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// First-login onboarding guide content, one entry per permission level —
// shown once (right after login / the forced password-change popup),
// dismissed permanently via the "onboarding_seen" flag on the account.
const ONBOARDING_CONTENT = {
  'Technicien': {
    title: 'Bienvenue sur PAV Manager !',
    points: [
      "Ton tableau de bord affiche tes prochains services et les invités à venir.",
      "Une absence à venir ? Déclare-la en un clic depuis « Mon espace ».",
      "Découvre les formations disponibles et l'organigramme du département directement depuis le Dashboard.",
      "La cloche en haut à droite te prévient dès qu'il y a du nouveau.",
    ],
  },
  'Gestionnaire': {
    title: 'Bienvenue, Gestionnaire PAV !',
    points: [
      "Tu peux gérer le Planning, les Devis, les Salles et les Formations selon tes branches.",
      "La cloche en haut à droite signale les demandes qui nécessitent ton attention.",
      "Ton tableau de bord se limite aux branches qui te sont attribuées.",
    ],
  },
  'Responsable': {
    title: 'Bienvenue, Responsable !',
    points: [
      "Tu interviens en validation finale sur les Formations et supervises tes branches.",
      "Le tableau de bord te donne une vue d'ensemble : Devis, Formations, Effectif, Salles.",
      "La cloche en haut à droite regroupe toutes les notifications qui te concernent.",
    ],
  },
  'Admin': {
    title: 'Bienvenue, Administrateur !',
    points: [
      "Tu as accès en écriture à l'ensemble du département : Effectif, Planning, Devis, Salles, Documents, Actualités, Formations.",
      "L'onglet Administration te permet de gérer les utilisateurs, les groupes et les droits d'accès.",
      "Le redémarrage serveur, la purge des logs, la migration de données, le quota de stockage et le mode maintenance restent réservés au Super Admin.",
    ],
  },
  'Admin (lecture seule)': {
    title: 'Bienvenue, Administrateur (lecture seule) !',
    points: [
      "Tu as une vue d'ensemble complète du département, sans restriction de branche.",
      "L'onglet Administration te permet de consulter les journaux d'activité et la supervision du système.",
      "Ton accès est en lecture seule : les actions de création, modification et suppression ne sont pas disponibles.",
    ],
  },
  'Super Admin': {
    title: 'Bienvenue, Super Admin !',
    points: [
      "Tu as un accès complet : gestion des utilisateurs, des groupes de permissions et du mode maintenance.",
      "L'onglet Administration te permet de tout superviser, y compris les journaux d'activité.",
      "La cloche en haut à droite regroupe toutes les notifications importantes.",
    ],
  },
};

// Navigation items with role-based access
// minRole: minimum role required (Technicien < Responsable < Gestionnaire < Admin < Super Admin)
// Gestionnaire (coordination) ranks above Responsable — Gestionnaire gets
// Administration access (scoped to Groupes & Droits, see Administration.js)
// while Responsable does not.
const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', minRole: 'Technicien' },
  { path: '/actualites', icon: Newspaper, label: 'Actualités', minRole: 'Technicien' },
  { path: '/planning', icon: CalendarDays, label: 'Planning', minRole: 'Technicien' },
  { path: '/mon-espace', icon: CalendarOff, label: 'Mon espace', minRole: 'Technicien' },
  { path: '/effectif', icon: Users, label: 'Effectif', minRole: 'Responsable' },
  // Salles/Régisseurs (20/08/2026) : opt-in pour Responsable/Gestionnaire —
  // ces deux rôles ne voient l'entrée que s'ils appartiennent à un groupe
  // qui accorde au moins une des permissions listées ici (RO ou RW). Admin
  // (lecture seule) et au-dessus gardent l'accès total via minRole seul,
  // voir hasAccess() plus bas. Reflète le gating backend (has_any_group_permission).
  { path: '/salles', icon: Building2, label: 'Salles', minRole: 'Responsable', groupPerms: ['salles.read', 'salles.write', 'salles.reservations'] },
  { path: '/logistique', icon: Package, label: 'Régisseurs', minRole: 'Responsable', groupPerms: ['logistique.read', 'logistique.write'] },
  { path: '/devis', icon: FileText, label: 'Devis & Achat', minRole: 'Responsable' },
  { path: '/formations', icon: GraduationCap, label: 'Formations', minRole: 'Technicien' },
  { path: '/documents', icon: FolderOpen, label: 'Base de connaissance', minRole: 'Technicien' },
  { path: '/administration', icon: Settings, label: 'Administration', minRole: 'Gestionnaire' },
];

const ROLE_HIERARCHY = {
  'Technicien': 1,
  'Responsable': 2,
  'Gestionnaire': 3,
  'Admin (lecture seule)': 4,
  'Admin': 5,
  'Super Admin': 6
};

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [maintenance, setMaintenance] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const { user, logout, isSuperAdmin, mustChangePassword, changePassword, canManage, onboardingSeen, markOnboardingSeen } = useAuth();
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
        console.log('Could not check maintenance mode');
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
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Notifications push (téléphone/navigateur) — état d'abonnement de CET
  // appareil (indépendant du compte : chaque appareil a son propre
  // endpoint PushManager), lu au montage et tenu à jour après chaque action.
  const [pushState, setPushState] = useState({ supported: false, subscribed: false });
  const [pushBusy, setPushBusy] = useState(false);
  const refreshPushState = async () => {
    const s = await getPushSubscriptionState();
    setPushState(s);
  };
  useEffect(() => {
    if (!user) return;
    refreshPushState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [testPushBusy, setTestPushBusy] = useState(false);
  const handleTestPush = async () => {
    setTestPushBusy(true);
    try {
      const res = await axios.post(`${API}/push/test`);
      toast.success(res.data?.message || 'Notification de test envoyée');
      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi du test");
    } finally {
      setTestPushBusy(false);
    }
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPush(axios);
        toast.success('Notifications push désactivées sur cet appareil');
      } else {
        const res = await subscribeToPush(axios);
        if (res.ok) {
          toast.success('Notifications push activées — tu recevras une alerte même app fermée');
        } else if (res.reason === 'denied') {
          toast.error("Autorisation refusée — active les notifications pour ce site dans les réglages du navigateur");
        } else if (res.reason === 'unsupported') {
          toast.error("Notifications push non supportées sur ce navigateur/appareil");
        } else if (res.reason === 'server_disabled') {
          toast.error("Notifications push non configurées côté serveur — contacte l'administrateur");
        } else {
          toast.error(`Impossible d'activer les notifications push${res.message ? ` : ${res.message}` : ''}`);
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
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_NAVIGATE' && event.data.link) {
        navigate(event.data.link);
        fetchNotifications();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defensive: a malformed/incomplete notification document (missing
  // fields, or a non-array API response served during a network hiccup —
  // see service-worker.js's offline fallback) must never crash the whole
  // app. A bad entry here used to take down the entire render tree with a
  // silent blank page, since nothing above catches render errors — an
  // ErrorBoundary now catches that class of crash too, but this is the
  // actual root cause, so it's fixed at the source.
  const safeNotifications = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
  const unreadNotifications = safeNotifications.filter((n) => !n.is_read);

  const handleNotificationClick = async (notif) => {
    if (!notif) return;
    try {
      await axios.put(`${API}/notifications/${notif.id}/read`);
      setNotifications((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n && n.id !== notif.id));
    } catch (err) {
      // silent
    }
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`);
      setNotifications((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n && n.is_read));
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
  // group membership too, when the user's role is Responsable/Gestionnaire
  // (see comment on navItems above).
  const hasAccess = (item) => {
    if (!user) return true;
    if (item.minRole) {
      const userLevel = ROLE_HIERARCHY[user.niveau_acces] || 0;
      const requiredLevel = ROLE_HIERARCHY[item.minRole] || 0;
      if (userLevel < requiredLevel) return false;
    }
    if (item.groupPerms && ['Responsable', 'Gestionnaire'].includes(user.niveau_acces)) {
      const perms = user.module_permissions || [];
      return item.groupPerms.some(p => perms.includes(p));
    }
    return true;
  };

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => hasAccess(item));

  // Maintenance impacts the roles chosen by Super Admin when activating it.
  // If no specific roles were chosen (legacy behavior), it impacts everyone
  // below Super Admin (Technicien, Gestionnaire, Responsable, Admin) — Super
  // Admin can always get in to fix things, regardless of the selection.
  const maintenanceAppliesToUser = maintenance?.is_active && !isSuperAdmin() &&
    (!maintenance.affected_roles || maintenance.affected_roles.length === 0 ||
      maintenance.affected_roles.includes(user?.niveau_acces));

  // Scope "site" : le site entier est remplacé par l'écran de maintenance
  // (plus de nav, plus de sidebar).
  const showMaintenancePage = maintenanceAppliesToUser && maintenance.scope !== 'page';

  // Scope "page" : seule la page ciblée est concernée, et seul son contenu
  // (pas la nav ni la sidebar) est remplacé par le bloc de maintenance —
  // les autres pages restent utilisables normalement.
  const showMaintenanceContentOnly = maintenanceAppliesToUser &&
    maintenance.scope === 'page' &&
    location.pathname === maintenance.page_path;

  // Show password change dialog if required
  useEffect(() => {
    if (mustChangePassword) {
      setPasswordDialogOpen(true);
    }
  }, [mustChangePassword]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(newPassword);
      toast.success('Mot de passe modifié avec succès');
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du changement de mot de passe');
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
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNiveauAccesColor = (niveau) => {
    const colors = {
      'Super Admin': 'bg-red-500',
      'Admin': 'bg-orange-500',
      'Admin (lecture seule)': 'bg-amber-500',
      'Responsable': 'bg-blue-500',
      'Gestionnaire': 'bg-green-500',
      'Technicien': 'bg-gray-500'
    };
    return colors[niveau] || 'bg-gray-500';
  };

  // Show maintenance page for members
  if (showMaintenancePage) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <AlertTriangle className="w-20 h-20 mx-auto text-yellow-500" />
          <h1 className="text-3xl font-bold">Maintenance en cours</h1>
          <p className="text-muted-foreground text-lg">
            {maintenance?.message || 'Nous effectuons une maintenance. Veuillez réessayer plus tard.'}
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
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-72 sm:w-64
        bg-card border-r border-border
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/logo.png" alt="PAV" className="w-8 h-8 object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-foreground truncate">PAV Manager</h1>
                <p className="text-xs text-muted-foreground truncate">Gestion Technique</p>
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
              const isUnderMaintenance = maintenanceAppliesToUser &&
                maintenance.scope === 'page' &&
                maintenance.page_path === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                  title={isUnderMaintenance ? 'Page en maintenance' : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isUnderMaintenance && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                  {isActive && !isUnderMaintenance && <ChevronRight className="w-4 h-4 text-white/90 shrink-0" />}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getNiveauAccesColor(user?.niveau_acces)}`} />
                  <p className="text-xs text-muted-foreground truncate">{user?.niveau_acces}</p>
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
                  <Button variant="ghost" size="icon" className="relative w-9 h-9 sm:w-10 sm:h-10" data-testid="notifications-bell">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                    {unreadNotifications.length > 0 && (
                      <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 bg-red-500 hover:bg-red-500 text-white text-[10px] leading-none flex items-center justify-center">
                        {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
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
                      <p className="text-sm text-muted-foreground">Aucune nouvelle notification</p>
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
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1">{notifTimeAgo(n.created_at)}</p>
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
                          ? 'Notifications push activées sur cet appareil'
                          : 'Activer les notifications sur cet appareil'}
                      </button>
                      {pushState.subscribed && (
                        <button
                          type="button"
                          onClick={handleTestPush}
                          disabled={testPushBusy}
                          className="w-full flex items-center gap-2 text-xs text-primary hover:underline disabled:opacity-60"
                        >
                          {testPushBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Envoyer une notification de test
                        </button>
                      )}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="theme-toggle w-9 h-9 sm:w-10 sm:h-10"
                data-testid="theme-toggle"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-10 sm:h-10" data-testid="user-menu">
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                        {user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="truncate">{user?.full_name}</span>
                      <span className="text-xs text-muted-foreground font-normal truncate">{user?.niveau_acces}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isSuperAdmin() && (
                    <DropdownMenuItem onClick={() => navigate('/administration')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Administration
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
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
                  {maintenance?.message || 'Cette page est temporairement indisponible. Veuillez réessayer plus tard.'}
                </p>
              </div>
            </div>
          ) : children}
        </main>
      </div>

      {/* Force Password Change Dialog */}
      <Dialog open={passwordDialogOpen && mustChangePassword} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Changement de mot de passe obligatoire
            </DialogTitle>
            <DialogDescription>
              Vous devez changer votre mot de passe pour continuer à utiliser l'application.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmer le mot de passe *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
              />
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
      <Dialog open={!!user && !mustChangePassword && !onboardingSeen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {(ONBOARDING_CONTENT[user?.niveau_acces] || ONBOARDING_CONTENT['Technicien']).title}
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
            {(ONBOARDING_CONTENT[user?.niveau_acces] || ONBOARDING_CONTENT['Technicien']).points.map((p, i) => (
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
    </div>
  );
};
