import "@/App.css";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OfflineProvider } from "./contexts/OfflineContext";
import { Layout } from "./components/Layout";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { Toaster } from "./components/ui/sonner";

// Pages — lazy-loaded so each route only downloads its own JS chunk instead of
// bundling every page into the initial load (faster first paint, especially on mobile).
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Confidentialite = lazy(() => import("./pages/Confidentialite"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Actualites = lazy(() => import("./pages/Actualites"));
const Planning = lazy(() => import("./pages/PlanningHub"));
const MonEspace = lazy(() => import("./pages/MonEspace"));
const Effectif = lazy(() => import("./pages/Effectif"));
const Logistique = lazy(() => import("./pages/Logistique"));
const Devis = lazy(() => import("./pages/Devis"));
const Formations = lazy(() => import("./pages/Formations"));
const Salles = lazy(() => import("./pages/Salles"));
const Documents = lazy(() => import("./pages/Documents"));
const Administration = lazy(() => import("./pages/Administration"));
const PublicReservation = lazy(() => import("./pages/PublicReservation"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain animate-pulse" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

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

  return <Layout>{children}</Layout>;
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
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/inscription" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reservation/:token" element={<PublicReservation />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/actualites" element={<ProtectedRoute><Actualites /></ProtectedRoute>} />
      <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
      <Route path="/mon-espace" element={<ProtectedRoute><MonEspace /></ProtectedRoute>} />
      <Route path="/effectif" element={<ProtectedRoute><Effectif /></ProtectedRoute>} />
      <Route path="/logistique" element={<ProtectedRoute><Logistique /></ProtectedRoute>} />
      <Route path="/devis" element={<ProtectedRoute><Devis /></ProtectedRoute>} />
      <Route path="/formations" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
      <Route path="/salles" element={<ProtectedRoute><Salles /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/administration" element={<ProtectedRoute><Administration /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <OfflineProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <OfflineIndicator />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}

export default App;
