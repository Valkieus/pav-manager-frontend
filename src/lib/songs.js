import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Ouvre CEC Songs UNIQUEMENT par la connexion unique PAV (jeton à usage unique, 2 min) : jamais de lien direct.
// La fenêtre est ouverte tout de suite (clic utilisateur) pour éviter le blocage des fenêtres surgissantes.
export async function openSongsSite() {
  const win = window.open("", "_blank");
  try {
    const res = await axios.post(`${API}/songs/sso-handoff`);
    if (win) win.location.href = res.data.redirect_url;
    else window.location.href = res.data.redirect_url;
  } catch (err) {
    if (win) win.close();
    toast.error(err.response?.data?.detail || "Impossible d'ouvrir CEC Songs");
  }
}
