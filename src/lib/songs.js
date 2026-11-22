import { openSso } from "./openSso";

// Ouvre CEC Songs UNIQUEMENT par la connexion unique PAV (jeton à usage unique, 2 min) : jamais de lien direct.
// Même onglet sur téléphone (la fenêtre vide puis redirigée ne marche pas sur iPhone), nouvel onglet sur ordinateur.
export const openSongsSite = () => openSso("/songs/sso-handoff", "Impossible d'ouvrir CEC Songs");
