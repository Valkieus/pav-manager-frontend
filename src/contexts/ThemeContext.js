import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const ThemeContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Applique une preference recue du backend (au login ou au refresh de
  // /auth/me) sans la renvoyer au serveur - evite une boucle PUT inutile.
  // C'est cette fonction (appelee depuis AuthContext) qui fait de la
  // preference stockee cote serveur la source de verite, tout en gardant
  // le localStorage comme cache rapide pour eviter un flash au chargement.
  const syncThemeFromServer = useCallback((serverTheme) => {
    if (serverTheme === 'light' || serverTheme === 'dark') {
      setThemeState(serverTheme);
    }
  }, []);

  const persistTheme = useCallback((next) => {
    setThemeState(next);
    axios.put(`${API}/me/theme`, { theme: next }).catch(() => {});
  }, []);

  const setTheme = useCallback((next) => persistTheme(next), [persistTheme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      axios.put(`${API}/me/theme`, { theme: next }).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, syncThemeFromServer }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
