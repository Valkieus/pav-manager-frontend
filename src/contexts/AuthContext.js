import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTheme } from "./ThemeContext";

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// « Voir comme… » : un Admin ou Super Admin peut prévisualiser l'application avec le niveau d'un rôle INFÉRIEUR au sien.
// Aperçu en lecture seule (aucune modification envoyée au serveur) et jamais mémorisé au-delà de l'onglet.
const LEVELS = ["Technicien", "Responsable", "Coordination", "Admin (lecture seule)", "Admin", "Super Admin"];
const VIEW_AS_KEY = "pav_view_as";
const viewAsChoices = (real) =>
  ["Admin", "Super Admin"].includes(real) ? LEVELS.filter((l) => LEVELS.indexOf(l) < LEVELS.indexOf(real)) : [];

// Compte tablette (kiosk_mode) : la session ne doit JAMAIS sauter à cause d'une
// coupure réseau passagère. Le profil est mémorisé sur la tablette et réutilisé
// si le serveur est injoignable ; seule une vraie réponse 401 déconnecte.
const KIOSK_USER_KEY = "kiosk_user";
// Le profil de TOUS les comptes est mémorisé : une coupure réseau ou une
// erreur serveur passagère ne déconnecte plus personne (seul un 401 le fait).
const rememberKioskUser = (u) => {
  try {
    if (u) localStorage.setItem(KIOSK_USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(KIOSK_USER_KEY);
  } catch (e) {
    // stockage indisponible : sans conséquence
  }
};
const readKioskUser = () => {
  try {
    const raw = localStorage.getItem(KIOSK_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const { syncThemeFromServer } = useTheme();
  const [rawUser, setUser] = useState(null);
  const [viewAs, setViewAs] = useState(() => {
    try { return sessionStorage.getItem(VIEW_AS_KEY) || null; } catch (e) { return null; }
  });
  // Utilisateur « effectif » : en aperçu, le niveau simulé remplace le vrai ; les droits de groupes ne sont pas simulés.
  const viewAsOptions = rawUser && !rawUser.kiosk_mode ? viewAsChoices(rawUser.niveau_acces) : [];
  const viewAsActive = viewAs && viewAsOptions.includes(viewAs) ? viewAs : null;
  const user = useMemo(
    () => (rawUser && viewAsActive ? { ...rawUser, niveau_acces: viewAsActive, module_permissions: [], group_ids: [], real_niveau_acces: rawUser.niveau_acces } : rawUser),
    [rawUser, viewAsActive],
  );
  const startViewAs = (level) => {
    try { sessionStorage.setItem(VIEW_AS_KEY, level); } catch (e) { /* ignore */ }
    setViewAs(level);
  };
  const stopViewAs = () => {
    try { sessionStorage.removeItem(VIEW_AS_KEY); } catch (e) { /* ignore */ }
    setViewAs(null);
  };
  // Aperçu = lecture seule : toute requête qui modifierait des données est bloquée.
  useEffect(() => {
    if (!viewAsActive) return undefined;
    const id = axios.interceptors.request.use((config) => {
      const method = (config.method || "get").toLowerCase();
      if (!["get", "head", "options"].includes(method) && !String(config.url || "").includes("/auth/")) {
        toast.info(`Aperçu « ${viewAsActive} » : lecture seule — quittez l'aperçu pour modifier.`);
        return Promise.reject(new axios.Cancel("Aperçu en lecture seule"));
      }
      return config;
    });
    return () => axios.interceptors.request.eject(id);
  }, [viewAsActive]);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      // Session glissante : le serveur renvoie un jeton neuf à chaque ouverture.
      const fresh = res.headers?.["x-refreshed-token"];
      if (fresh) {
        try {
          localStorage.setItem("token", fresh);
        } catch (e) {
          // stockage indisponible : on garde le jeton actuel
        }
        axios.defaults.headers.common["Authorization"] = `Bearer ${fresh}`;
      }
      setUser(res.data);
      rememberKioskUser(res.data);
      syncThemeFromServer(res.data.theme_preference);
      setMustChangePassword(res.data.must_change_password || false);
      setOnboardingSeen(res.data.onboarding_seen !== false);
    } catch (err) {
      console.error("Auth error:", err);
      const cached = readKioskUser();
      if (cached && err?.response?.status !== 401) {
        // Hors ligne / serveur injoignable ou en redémarrage : on garde la session.
        setUser(cached);
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  // Le thème se règle aussi depuis PAV Academy / Éléments LED : on se recale à chaque retour sur l'onglet.
  useEffect(() => {
    if (!token) return undefined;
    const resync = () => {
      if (document.visibilityState === "hidden") return;
      axios.get(`${API}/auth/me`).then((res) => syncThemeFromServer(res.data.theme_preference)).catch(() => {});
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [token, syncThemeFromServer]);

  const login = async (username, password) => {
    const res = await axios.post(`${API}/auth/login`, { username, password });
    return applyLogin(res.data);
  };

  // Connexion par Face ID / empreinte : même résultat que le mot de passe.
  const loginWithData = async (data) => applyLogin(data);

  const applyLogin = (data) => {
    const { access_token, user: userData } = data;
    localStorage.setItem("token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    rememberKioskUser(userData);
    syncThemeFromServer(userData.theme_preference);
    setMustChangePassword(userData.must_change_password || false);
    setOnboardingSeen(userData.onboarding_seen !== false);
    return userData;
  };

  const logout = () => {
    try { sessionStorage.removeItem(VIEW_AS_KEY); } catch (e) { /* ignore */ }
    setViewAs(null);
    localStorage.removeItem("token");
    rememberKioskUser(null);
    delete axios.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    setOnboardingSeen(true);
  };

  const changePassword = async (newPassword) => {
    await axios.post(`${API}/auth/change-password`, {
      new_password: newPassword,
    });
    setMustChangePassword(false);
    setUser((prev) => ({ ...prev, must_change_password: false }));
  };

  // Called once the first-login onboarding guide has been dismissed, so it
  // never shows again for this account.
  const markOnboardingSeen = async () => {
    setOnboardingSeen(true);
    setUser((prev) => (prev ? { ...prev, onboarding_seen: true } : prev));
    try {
      await axios.put(`${API}/auth/me/onboarding-seen`);
    } catch (err) {
      console.error("Onboarding seen update failed:", err);
    }
  };

  const canValidate = () => {
    if (!user) return false;
    return ["Super Admin", "Admin", "Responsable"].includes(user.niveau_acces);
  };

  const canManage = () => {
    if (!user) return false;
    return ["Super Admin", "Admin", "Responsable", "Coordination"].includes(
      user.niveau_acces,
    );
  };

  const isSuperAdmin = () => user?.niveau_acces === "Super Admin";
  // Write-capable admin (creates/edits/deletes across business modules). Does
  // NOT include "Admin (lecture seule)", which is intentionally read-only —
  // use isAdminOrReadOnly() below for view-scope checks (dashboard scope,
  // supervision tabs) that the read-only role should still see.
  const isAdmin = () => ["Super Admin", "Admin"].includes(user?.niveau_acces);
  // Unrestricted VIEW scope (dashboard branches, coordination/direction views,
  // supervision panels) — includes the read-only Admin role, since it should
  // see everything Admin sees, just without any write controls.
  const isAdminOrReadOnly = () =>
    ["Super Admin", "Admin", "Admin (lecture seule)"].includes(
      user?.niveau_acces,
    );
  // Coordination+ : utilisé pour des réglages de personnalisation fine
  // (ex. étiquette affichée dans l'organigramme) qu'on ne veut pas ouvrir à
  // Responsable, mais pas non plus restreindre au seul Admin/Super Admin.
  const isGestionnairePlus = () =>
    ["Coordination", "Admin", "Super Admin"].includes(user?.niveau_acces);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        realUser: rawUser,
        viewAs: viewAsActive,
        viewAsOptions,
        startViewAs,
        stopViewAs,
        login,
        loginWithData,
        logout,
        changePassword,
        mustChangePassword,
        onboardingSeen,
        markOnboardingSeen,
        canValidate,
        canManage,
        isSuperAdmin,
        isAdmin,
        isAdminOrReadOnly,
        isGestionnairePlus,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
