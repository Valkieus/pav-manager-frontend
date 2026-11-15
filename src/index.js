import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import "@/utils/pwaInstall"; // enregistre le listener beforeinstallprompt le plus tot possible
import { isChunkError, reloadForNewVersion } from "@/lib/lazyWithRetry";

// Nouvelle version déployée pendant qu'un onglet est ouvert : un chunk JS
// introuvable déclenche un rechargement unique au lieu d'un écran d'erreur.
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkError(e.reason)) reloadForNewVersion();
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Pages préchargées en arrière-plan une fois l'application affichée (voir lib/lazyWithRetry.js).
import { prefetchLazyRoutes } from './lib/lazyWithRetry';
window.addEventListener('load', () => setTimeout(prefetchLazyRoutes, 1500));
