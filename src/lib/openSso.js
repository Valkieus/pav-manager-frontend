import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Téléphone, tablette ou application installée : on navigue dans le même onglet. Le trucage « ouvrir une fenêtre vide puis la rediriger après la
// réponse du serveur » ne marche pas sur iPhone / iPad (fenêtre bloquée ou restée blanche) : c'est pourquoi PAV LED et CEC Songs « ne s'ouvraient pas ».
export const prefersSameTab = () => {
  const ua = navigator.userAgent || "";
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  return /iPhone|iPad|iPod|Android/i.test(ua) || touchMac || standalone;
};

const DEFAULT_403 = {
  "/led/sso-handoff": "PAV LED est réservé aux équipes Animation et Réalisation (et aux responsables) : demande à un responsable de t'ajouter à un groupe LED.",
  "/songs/sso-handoff": "L'accès à CEC Songs a été retiré pour ce compte : demande à un administrateur.",
};

/** Demande un lien de connexion unique (SSO) au serveur puis ouvre le site : même onglet sur téléphone, nouvel onglet sur ordinateur. */
export async function openSso(path, failLabel) {
  const sameTab = prefersSameTab();
  const win = sameTab ? null : window.open("", "_blank");
  try {
    const res = await axios.post(`${API}${path}`);
    const url = res.data.redirect_url;
    if (win && !win.closed) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    if (win) win.close();
    const status = err.response?.status;
    toast.error((status === 403 && DEFAULT_403[path]) || err.response?.data?.detail || failLabel);
  }
}
