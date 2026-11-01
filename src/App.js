import "@/App.css";
import { Suspense, useEffect, useState } from "react";
import lazyWithRetry from "./lib/lazyWithRetry";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OfflineProvider } from "./contexts/OfflineContext";
import { Layout } from "./components/Layout";

import { OfflineIndicator } from "./components/OfflineIndicator";
import { Toaster } from "./components/ui/sonner";
import IdleGuard from "./components/IdleGuard";

// Pages — lazy-loaded so each route only downloads its own JS chunk instead of
// bundling every page into the initial load (faster first paint, especially on mobile).
const Login = lazyWithRetry(() => import("./pages/Login"));
const SsoLed = lazyWithRetry(() => import("./pages/SsoLed"));
const SsoSongs = lazyWithRetry(() => import("./pages/SsoSongs"));
const SsoAcademy = lazyWithRetry(() => import("./pages/SsoAcademy"));
const Register = lazyWithRetry(() => import("./pages/Register"));
const Confidentialite = lazyWithRetry(() => import("./pages/Confidentialite"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Actualites = lazyWithRetry(() => import("./pages/Actualites"));
const Planning = lazyWithRetry(() => import("./pages/PlanningHub"));
const MonEspace = lazyWithRetry(() => import("./pages/MonEspace"));
const MonBadge = lazyWithRetry(() => import("./pages/MonBadge"));
const Effectif = lazyWithRetry(() => import("./pages/Effectif"));
const Logistique = lazyWithRetry(() => import("./pages/Logistique"));
const ElementsLED = lazyWithRetry(() => import("./pages/ElementsLED"));
// Écran du compte tablette « Régisseurs iPad » — chargé seulement pour ce compte.
const KioskShell = lazyWithRetry(() => import("./components/KioskShell"));
const PortalOnlyShell = lazyWithRetry(() => import("./components/PortalOnlyShell"));
const Devis = lazyWithRetry(() => import("./pages/Devis"));
const Formations = lazyWithRetry(() => import("./pages/Formations"));
const Salles = lazyWithRetry(() => import("./pages/Salles"));
const Documents = lazyWithRetry(() => import("./pages/Documents"));
const Administration = lazyWithRetry(() => import("./pages/Administration"));
const Communication = lazyWithRetry(() => import("./pages/Communication"));
const PublicReservation = lazyWithRetry(() => import("./pages/PublicReservation"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain animate-pulse" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Vue PAV Manager verrouillée (nouvelle équipe LED) : seulement le portail (LED, CEC Songs, Bible) + message « bientôt disponible ».
  if (user?.portal_only && !["Admin", "Super Admin"].includes(user.niveau_acces)) {
    return <Suspense fallback={null}><PortalOnlyShell /></Suspense>;
  }

  // Compte tablette « Régisseurs iPad » : uniquement la vue Entrées/Sorties,
  // quelle que soit l'adresse ouverte (pas de menu, pas de déconnexion).
  if (user?.kiosk_mode) {
    return <KioskShell />;
  }

  // Compte de service (ex. « incrustation ») : pas de PAV Manager, on l'envoie
  // directement vers l'application à laquelle il a droit (CEC Songs).
  if (user?.service_account) {
    return (user.service_apps || []).includes("songs") ? (
      <SsoSongs />
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
        Ce compte n'a accès à aucune application pour le moment. Contactez un administrateur.
      </div>
    );
  }

  return (
    <>
      <IdleGuard />
      <Layout>{children}</Layout>
    </>
  );
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain animate-pulse" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Retour vers l'entrée SSO (site LED ou PAV Academy) si la connexion venait de là.
    const next = sessionStorage.getItem("post_login_next");
    return <Navigate to={["/sso-led", "/sso-academy", "/sso-songs"].includes(next) ? next : "/"} replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/sso-led" element={<SsoLed />} />
      <Route path="/sso-songs" element={<SsoSongs />} />
      <Route path="/sso-academy" element={<SsoAcademy />} />
      <Route path="/inscription" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reservation/:token" element={<PublicReservation />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/actualites" element={<ProtectedRoute><Actualites /></ProtectedRoute>} />
      <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
      <Route path="/mon-espace" element={<ProtectedRoute><MonEspace /></ProtectedRoute>} />
      <Route path="/mon-badge" element={<ProtectedRoute><MonBadge /></ProtectedRoute>} />
      <Route path="/effectif" element={<ProtectedRoute><Effectif /></ProtectedRoute>} />
      <Route path="/logistique" element={<ProtectedRoute><Logistique /></ProtectedRoute>} />
      <Route path="/elements-led" element={<ProtectedRoute><ElementsLED /></ProtectedRoute>} />
      <Route path="/devis" element={<ProtectedRoute><Devis /></ProtectedRoute>} />
      <Route path="/formations" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
      <Route path="/salles" element={<ProtectedRoute><Salles /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/administration" element={<ProtectedRoute><Administration /></ProtectedRoute>} />
<Route path="/communication" element={<ProtectedRoute><Communication /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

// Messages (toasts) : en haut à droite sur ordinateur ; sur téléphone, EN BAS de l'écran — en haut ils passaient derrière l'encoche /
// l'îlot dynamique et l'en-tête, donc invisibles (iPhone en application installée).
function AppToaster() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone
    ? <Toaster position="bottom-center" richColors offset={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }} mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)", left: 12, right: 12 }} />
    : <Toaster position="top-right" richColors />;
}

function App() {
  return (
    <ThemeProvider>
      <OfflineProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <OfflineIndicator />
            <AppToaster />
          </BrowserRouter>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}

export default App;
