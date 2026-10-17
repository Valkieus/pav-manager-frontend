
// Bibliothèque lourde (~330 Ko) : chargée seulement quand on exporte, pas à l'ouverture de la page.
export let XLSX;

export const loadXLSX = async () => { XLSX = XLSX || (await import('xlsx-js-style')); };

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Couleurs distinctives par branche
export const BRANCH_COLORS = {
  Live: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-300 dark:border-red-700",
    dot: "bg-red-500",
  },
  "Post-Prod": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  Studio: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-700",
    dot: "bg-purple-500",
  },
  Technique: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  Production: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  Diffusion: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-300 dark:border-cyan-700",
    dot: "bg-cyan-500",
  },
  Animation: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-300 dark:border-orange-700",
    dot: "bg-orange-500",
  },
  Coordination: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-300 dark:border-indigo-700",
    dot: "bg-indigo-500",
  },
  Supervision: {
    bg: "bg-slate-100 dark:bg-slate-900/30",
    text: "text-slate-700 dark:text-slate-400",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
  Régisseurs: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-300 dark:border-pink-700",
    dot: "bg-pink-500",
  },
  Logistique: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-300 dark:border-pink-700",
    dot: "bg-pink-500",
  },
};

// Fenêtre « fiche » : centrée sur PC, plein écran sur téléphone (zones de sécurité iOS/Android respectées).
export const SHEET_CLASS =
  "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:max-h-[90vh] sm:rounded-xl max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none";

export const NIVEAU_ORDER = { Expert: 0, Confirmé: 1, Intermédiaire: 2, Débutant: 3, Novice: 4 };

export const getBranchColor = (branche) =>
  BRANCH_COLORS[branche] || {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
    dot: "bg-gray-500",
  };
