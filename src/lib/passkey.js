import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ENROLLED_KEY = "pav_passkey_enrolled";
// Identifiant de la clé Face ID de cet appareil : permet de lancer Face ID
// directement, sans afficher la liste des « passkeys » à choisir.
const CRED_KEY = "pav_passkey_cred_id";
const savedCredId = () => { try { return localStorage.getItem(CRED_KEY); } catch (e) { return null; } };
const saveCredId = (id) => { try { localStorage.setItem(CRED_KEY, id); } catch (e) { /* ignore */ } };
export const forgetPasskeyCredId = () => { try { localStorage.removeItem(CRED_KEY); } catch (e) { /* ignore */ } };

const toBuf = (b64u) => {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
};
const toB64u = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Face ID / Touch ID / empreinte / Windows Hello disponible sur cet appareil ?
export async function passkeySupported() {
  try {
    return !!(window.PublicKeyCredential && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch (e) { return false; }
}
export const passkeyEnrolledHere = () => { try { return localStorage.getItem(ENROLLED_KEY) === "1"; } catch (e) { return false; } };

// Active Face ID / empreinte sur cet appareil (utilisateur connecté).
export async function enrollPasskey(label) {
  const { data } = await axios.post(`${API}/auth/passkey/register/options`);
  const o = data.options;
  const cred = await navigator.credentials.create({
    publicKey: {
      ...o,
      challenge: toBuf(o.challenge),
      user: { ...o.user, id: toBuf(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
    },
  });
  await axios.post(`${API}/auth/passkey/register/verify`, {
    challenge_id: data.challenge_id,
    label,
    credential: {
      id: cred.id,
      rawId: toB64u(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      response: {
        clientDataJSON: toB64u(cred.response.clientDataJSON),
        attestationObject: toB64u(cred.response.attestationObject),
        transports: cred.response.getTransports ? cred.response.getTransports() : undefined,
      },
    },
  });
  try { localStorage.setItem(ENROLLED_KEY, "1"); } catch (e) { /* ignore */ }
  saveCredId(cred.id);
}

// Connexion par Face ID / empreinte : renvoie { access_token, user } comme la connexion classique.
// Une seule demande Face ID à la fois : un second appel (bouton touché pendant le lancement automatique,
// page remontée, double déclenchement) réutilise la demande déjà en cours au lieu d'ouvrir un 2e écran « passkey ».
let _loginInFlight = null;
export function passkeyLogin() {
  if (!_loginInFlight) {
    _loginInFlight = _passkeyLogin().finally(() => { _loginInFlight = null; });
  }
  return _loginInFlight;
}

async function _passkeyLogin() {
  const { data } = await axios.post(`${API}/auth/passkey/login/options`);
  const o = data.options;
  const preferred = savedCredId();
  const allow = preferred
    ? [{ type: "public-key", id: toBuf(preferred) }]
    : (o.allowCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) }));
  const cred = await navigator.credentials.get({
    publicKey: { ...o, challenge: toBuf(o.challenge), allowCredentials: allow },
  });
  let res;
  try {
    res = await axios.post(`${API}/auth/passkey/login/verify`, {
    challenge_id: data.challenge_id,
    credential: {
      id: cred.id,
      rawId: toB64u(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      response: {
        clientDataJSON: toB64u(cred.response.clientDataJSON),
        authenticatorData: toB64u(cred.response.authenticatorData),
        signature: toB64u(cred.response.signature),
        userHandle: cred.response.userHandle ? toB64u(cred.response.userHandle) : undefined,
      },
    },
  });
  } catch (err) {
    // Clé introuvable côté serveur (supprimée…) : on oublie l'identifiant mémorisé.
    if (preferred) forgetPasskeyCredId();
    throw err;
  }
  saveCredId(cred.id);
  return res.data;
}
