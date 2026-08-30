import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const { syncThemeFromServer } = useTheme();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
      syncThemeFromServer(res.data.theme_preference);
      setMustChangePassword(res.data.must_change_password || false);
      setOnboardingSeen(res.data.onboarding_seen !== false);
    } catch (err) {
      console.error('Auth error:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (username, password) => {
    const res = await axios.post(`${API}/auth/login`, { username, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    syncThemeFromServer(userData.theme_preference);
    setMustChangePassword(userData.must_change_password || false);
    setOnboardingSeen(userData.onboarding_seen !== false);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
    setOnboardingSeen(true);
  };

  const changePassword = async (newPassword) => {
    await axios.post(`${API}/auth/change-password`, { new_password: newPassword });
    setMustChangePassword(false);
    setUser(prev => ({ ...prev, must_change_password: false }));
  };

  // Called once the first-login onboarding guide has been dismissed, so it
  // never shows again for this account.
  const markOnboardingSeen = async () => {
    setOnboardingSeen(true);
    setUser(prev => (prev ? { ...prev, onboarding_seen: true } : prev));
    try {
      await axios.put(`${API}/auth/me/onboarding-seen`);
    } catch (err) {
      console.error('Onboarding seen update failed:', err);
    }
  };

  const canValidate = () => {
    if (!user) return false;
    return ['Super Admin', 'Admin', 'Responsable'].includes(user.niveau_acces);
  };

  const canManage = () => {
    if (!user) return false;
    return ['Super Admin', 'Admin', 'Responsable', 'Gestionnaire'].includes(user.niveau_acces);
  };

  const isSuperAdmin = () => user?.niveau_acces === 'Super Admin';
  // Write-capable admin (creates/edits/deletes across business modules). Does
  // NOT include "Admin (lecture seule)", which is intentionally read-only —
  // use isAdminOrReadOnly() below for view-scope checks (dashboard scope,
  // supervision tabs) that the read-only role should still see.
  const isAdmin = () => ['Super Admin', 'Admin'].includes(user?.niveau_acces);
  // Unrestricted VIEW scope (dashboard branches, coordination/direction views,
  // supervision panels) — includes the read-only Admin role, since it should
  // see everything Admin sees, just without any write controls.
  const isAdminOrReadOnly = () => ['Super Admin', 'Admin', 'Admin (lecture seule)'].includes(user?.niveau_acces);
  // Gestionnaire+ : utilisé pour des réglages de personnalisation fine
  // (ex. étiquette affichée dans l'organigramme) qu'on ne veut pas ouvrir à
  // Responsable, mais pas non plus restreindre au seul Admin/Super Admin.
  const isGestionnairePlus = () => ['Gestionnaire', 'Admin', 'Super Admin'].includes(user?.niveau_acces);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
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
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
