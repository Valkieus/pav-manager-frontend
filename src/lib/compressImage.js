// Allège une photo avant l'envoi (une photo d'iPhone fait plusieurs Mo) : côté long ≤ maxSide, JPEG.
// Échec ou gain nul → le fichier d'origine est envoyé tel quel (jamais de perte).
export async function compressImage(file, { maxSide = 1600, quality = 0.88, skipUnder = 700 * 1024 } = {}) {
  try {
    if (!file || !/^image\/(jpeg|png)$/.test(file.type) || file.size <= skipUnder) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); // respecte le sens de la photo (EXIF)
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  }
}
