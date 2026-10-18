// Rendu du badge PAV : gabarit (public/badge-template.png) + photo + « Prénom / NOM ».
// Tout se fait dans un <canvas> côté navigateur : aperçu, PNG et PDF sortent du même dessin.
const W = 726;
const H = 507;
const SCALE = 2;
const PHOTO = { x: 29, y: 150, w: 263, h: 263, r: 18, inset: 7 };
const NAME_BOX = { x: 312, w: 394, cy: 282 };

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { prenom: parts[0] || '', nom: parts.slice(1).join(' ').toUpperCase() };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, weight, maxPx, maxWidth) {
  let size = maxPx;
  do {
    ctx.font = `${weight} ${size}px Inter, "Helvetica Neue", Arial, sans-serif`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 16);
}

export async function renderBadge(canvas, { photoUrl, prenom, nom }) {
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  const template = await loadImage(`${process.env.PUBLIC_URL || ''}/badge-template.png`);
  ctx.drawImage(template, 0, 0, W, H);

  // Le texte d'abord : il doit apparaître même si la photo ne peut pas être chargée.
  drawNames(ctx, prenom, nom);

  let photoOk = true;
  if (photoUrl) {
    photoOk = false;
    const img = await loadPhoto(photoUrl);
    if (img) {
      const { x, y, w, h, r, inset } = PHOTO;
      const ix = x + inset, iy = y + inset, iw = w - inset * 2, ih = h - inset * 2;
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, r - 6);
      ctx.clip();
      const s = Math.max(iw / img.width, ih / img.height); // cover
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      ctx.restore();
      photoOk = true;
    }
  }
  return { canvas, photoOk };
}

// Plusieurs essais : <img> avec CORS, puis fetch -> blob (selon ce que le navigateur / le service worker acceptent).
async function loadPhoto(url) {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${url}${url.includes('?') ? '&' : '?'}cb=1`;
    });
  } catch (e) { /* essai suivant */ }
  try {
    const blob = await (await fetch(url, { cache: 'reload' })).blob();
    const objUrl = URL.createObjectURL(blob);
    try { return await loadImage(objUrl); } finally { URL.revokeObjectURL(objUrl); }
  } catch (e) {
    return null;
  }
}

function drawNames(ctx, prenom, nom) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2f2f2f';
  const cx = NAME_BOX.x + NAME_BOX.w / 2;
  fitText(ctx, prenom, 700, 54, NAME_BOX.w);
  ctx.fillText(prenom, cx, NAME_BOX.cy - 38);
  fitText(ctx, nom, 800, 60, NAME_BOX.w);
  ctx.fillText(nom, cx, NAME_BOX.cy + 38);
}

export const badgeFileName = (prenom, nom, ext) =>
  `badge-${`${prenom}-${nom}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pav'}.${ext}`;

export function downloadPng(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

export async function downloadPdf(canvas, name) {
  const { jsPDF } = await import('jspdf');
  const wMm = 90;
  const hMm = (wMm * H) / W;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [wMm, hMm] });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, wMm, hMm);
  pdf.save(name);
}
