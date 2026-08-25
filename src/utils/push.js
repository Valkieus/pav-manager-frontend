// Web Push (VAPID) — abonnement navigateur/téléphone pour de vraies
// notifications système (bannière même app/onglet fermé), en complément de
// la cloche in-app. Best-effort partout : sur un navigateur/OS qui ne
// supporte pas l'API Push (ex. Safari iOS hors PWA installée < 16.4), les
// fonctions ci-dessous se contentent de renvoyer `false`/`null` sans jamais
// lever d'erreur bloquante pour le reste de l'app.

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// La applicationServerKey attendue par PushManager.subscribe() doit être un
// Uint8Array, pas la chaîne base64url brute renvoyée par le backend.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// iOS/anciens navigateurs peuvent laisser `serviceWorker.ready` ou
// `pushManager.subscribe()` ne jamais se résoudre (ni succès ni rejet) dans
// certains cas limites — sans garde-fou, le bouton reste bloqué en spinner
// indéfiniment et l'utilisateur voit "rien ne se passe", sans aucune erreur.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Délai dépassé (${label})`)), ms)),
  ]);
}

export async function getPushSubscriptionState() {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'sw-ready');
    const sub = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: !!sub, permission: Notification.permission };
  } catch (err) {
    console.error('[push] getPushSubscriptionState failed:', err);
    return { supported: true, subscribed: false, permission: Notification.permission };
  }
}

export async function subscribeToPush(axios) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const { data: vapid } = await withTimeout(axios.get(`${API}/push/vapid-public-key`), 10000, 'vapid-key');
    if (!vapid?.enabled || !vapid?.public_key) return { ok: false, reason: 'server_disabled' };

    const reg = await withTimeout(navigator.serviceWorker.ready, 10000, 'sw-ready');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.public_key),
        }),
        10000,
        'pm-subscribe'
      );
    }
    const json = sub.toJSON();
    await withTimeout(axios.post(`${API}/push/subscribe`, { endpoint: json.endpoint, keys: json.keys }), 10000, 'post-subscribe');
    return { ok: true };
  } catch (err) {
    console.error('[push] subscribeToPush failed:', err);
    return { ok: false, reason: 'error', error: err, message: err?.message || String(err) };
  }
}

export async function unsubscribeFromPush(axios) {
  if (!isPushSupported()) return { ok: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await axios.post(`${API}/push/unsubscribe`, { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}
