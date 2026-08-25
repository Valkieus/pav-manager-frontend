// iOS Safari does not reliably honor `<a download>`: clicking a download
// link there either does nothing visible, silently drops the file, or (at
// best) drops it into the Files app under "Downloads" — never into Photos,
// which is where most people look for a PNG. There is no reliable way to
// detect "the download actually landed somewhere the user can find it" on
// iOS, so instead of `<a download>` we prefer the native Share Sheet (which
// has a direct "Save Image" / "Save to Files" action the OS handles for
// us), and fall back to an in-page overlay the user can long-press to save
// manually.
//
// isIOS(): also covers iPadOS 13+, which reports as "MacIntel" but is
// touch-capable (real Macs are not).
export function isIOS() {
  return /iP(hone|od|ad)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Historically this opened a blank tab synchronously (before any `await`)
// so a later window.location assignment could dodge Safari's popup
// blocker. That whole approach turned out to be fundamentally unsafe in
// this app's context:
//   - In regular Safari it could behave like an in-place navigation of the
//     CURRENT tab instead of a real new one, making the app look like it
//     "reloaded" when the user just wanted to export a PNG.
//   - In "Add to Home Screen" standalone mode there is no real
//     multi-window support at all — window.open() there can silently fail
//     or strand the webview on a permanent blank screen with no way back,
//     which is exactly the white-page reports this replaces.
// Kept as a no-op (always returns null) purely so existing call sites don't
// need to change — downloadOrShareFile() below no longer opens any
// window/tab on iOS at all.
export function reserveTabForIOSFallback() {
  return null;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Renders the file directly inside the current page — no new window/tab —
// as a full-screen overlay with either an <img> (for images, so the user
// can long-press → "Save Image") or a real `download` link (for anything
// else, so the user's own tap drives Safari's normal save/open handling).
function showInPageFallback(dataUrl, filename, isImage) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(17,17,17,0.96);'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'padding:24px;gap:16px;';

  const hint = document.createElement('p');
  hint.style.cssText =
    'color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:14px;'
    + 'text-align:center;max-width:320px;margin:0;';

  if (isImage) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = filename;
    img.style.cssText = 'max-width:100%;max-height:65vh;object-fit:contain;border-radius:8px;';
    overlay.appendChild(img);
    hint.textContent = 'Appuie et maintiens ton doigt sur l’image, puis choisis "Enregistrer l’image" pour la sauvegarder dans Photos.';
    overlay.appendChild(hint);
  } else {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.textContent = 'Télécharger ' + filename;
    link.style.cssText =
      'padding:12px 24px;border-radius:8px;background:#1F3A5F;color:#fff;'
      + 'font-weight:600;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;';
    overlay.appendChild(link);
    hint.textContent = 'Appuie sur le bouton pour télécharger le fichier.';
    overlay.appendChild(hint);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.style.cssText =
    'padding:10px 24px;border-radius:8px;border:1px solid #fff;background:transparent;'
    + 'color:#fff;font-weight:600;font-family:system-ui,-apple-system,sans-serif;';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
}

// Delivers `blob` to the user as `filename`, trying the best available
// method for the current browser, and returns a short status string so the
// caller can pick the right toast message:
//   'shared'    — handed off to the native share sheet (user still has to
//                 tap "Save Image"/"Save to Files" there, but that's the OS
//                 UI, not something we control)
//   'cancelled' — user dismissed the share sheet
//   'downloaded'— classic same-tab download via <a download> (desktop /
//                 Android Chrome, where this actually works)
//   'opened'    — iOS fallback: file shown in an in-page overlay; the user
//                 needs to long-press it (images) or tap the download
//                 button (other files)
//   'blocked'   — couldn't read the file to display it
export async function downloadOrShareFile(blob, filename, { title, preOpenedWindow } = {}) {
  // preOpenedWindow only ever exists from the now-disabled
  // reserveTabForIOSFallback() — close it defensively in case any caller
  // still has an old cached build reserving one.
  if (preOpenedWindow && !preOpenedWindow.closed) {
    try { preOpenedWindow.close(); } catch {
      // ignore
    }
  }

  let file = null;
  try {
    file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  } catch {
    // Some older WebKit versions don't support the File constructor with a
    // Blob source — fall through to the non-share paths below.
  }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || filename });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
      // Share API present but failed for another reason — fall through and
      // try the other delivery methods below instead of giving up.
    }
  }

  if (!isIOS()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return 'downloaded';
  }

  // iOS with no working Share API: never open a new window/tab (see
  // reserveTabForIOSFallback's comment above for why) — show it in-page.
  let dataUrl;
  try {
    dataUrl = await blobToDataURL(blob);
  } catch {
    return 'blocked';
  }
  showInPageFallback(dataUrl, filename, (blob.type || '').startsWith('image/'));
  return 'opened';
}

// Standard toast copy for each status, in French, matching the app's tone.
export function downloadStatusMessage(status, { kind = "L'image" } = {}) {
  switch (status) {
    case 'shared': return null; // the share sheet is its own confirmation
    case 'cancelled': return null;
    case 'downloaded': return `${kind} a été téléchargée`;
    case 'opened': return null; // the on-screen overlay already carries its own instructions
    case 'blocked': return "Impossible d'afficher le fichier — réessaie";
    default: return null;
  }
}
