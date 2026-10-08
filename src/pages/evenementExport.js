import { groupRoles, fmtDateLong } from './evenementTemplates';

const EXPORT_FONT = 'Arial, Helvetica, sans-serif';
export const PEACH = '#F5C6AC';
export const PEACH_BAND = '#FCE4D6';
export const PEACH_TEXT = '#C55A11';

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

export async function svgToPngDataUrl(svgString, width, height, scale = 2) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Export SVG d'un planning événement : même mise en page que l'écran
// (titre, ligne RDV, en-tête AFFECTATION + colonnes, catégories, en-tête
// répété avant les régisseurs) — généré depuis les données, jamais une
// capture d'écran.
export function buildEvenementExportSVG({ titre, rdv, cols, sections, roles, affectations, blockedCells }) {
  const LABEL_W = 230;
  const COL_W = 190;
  const ROW_H = 30;
  const BAND_H = 34;
  const TITLE_H = 60;
  const RDV_H = rdv ? 34 : 0;
  const GAP = 12;
  const colsN = Math.max(cols.length, 1);
  const width = LABEL_W + COL_W * colsN;
  const headLines = cols.map((c) => String(c.label || '').split('\n').filter((l) => l.trim() !== ''));
  const maxLines = Math.max(1, ...headLines.map((l) => l.length + 1));
  const HEADER_H = 12 + maxLines * 17;

  const parts = [];
  let y = 0;
  const text = (x, ty, str, size, weight, fill, anchor = 'middle') => {
    parts.push(`<text x="${x}" y="${ty}" text-anchor="${anchor}" font-family="${EXPORT_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(str)}</text>`);
  };

  parts.push(`<text x="${width / 2}" y="${TITLE_H - 18}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="30" font-weight="700" fill="${PEACH_TEXT}">${escapeXml(titre)}</text>`);
  y = TITLE_H;
  if (rdv) {
    parts.push(`<rect x="0" y="${y}" width="${LABEL_W + COL_W * colsN}" height="${RDV_H}" fill="${PEACH}" stroke="#000" />`);
    text(width / 2, y + RDV_H / 2 + 6, rdv, 18, 400, '#000');
    y += RDV_H + 8;
  }

  const drawHeader = () => {
    parts.push(`<rect x="0" y="${y}" width="${LABEL_W}" height="${HEADER_H}" fill="${PEACH}" stroke="#000" stroke-width="1.5" />`);
    text(LABEL_W / 2, y + HEADER_H / 2 + 6, 'AFFECTATION', 16, 700, '#000');
    cols.forEach((c, i) => {
      const x = LABEL_W + i * COL_W;
      parts.push(`<rect x="${x}" y="${y}" width="${COL_W}" height="${HEADER_H}" fill="${PEACH}" stroke="#000" stroke-width="1.5" />`);
      const lines = [fmtDateLong(c.date), ...headLines[i]];
      const startY = y + (HEADER_H - lines.length * 17) / 2 + 13;
      lines.forEach((l, li) => text(x + COL_W / 2, startY + li * 17, l, li === 0 ? 14 : 13, li === 0 ? 700 : 400, '#000'));
    });
    y += HEADER_H;
  };

  const groups = groupRoles(sections, roles);
  const hasCols = cols.length > 0;
  if (hasCols) drawHeader();
  groups.forEach((g, gi) => {
    if (g.repeat_header && gi > 0) {
      y += GAP;
      drawHeader();
    }
    if (g.name && !g.standalone) {
      parts.push(`<rect x="0" y="${y}" width="${width}" height="${BAND_H}" fill="${PEACH_BAND}" stroke="#000" stroke-width="1.5" />`);
      text(width / 2, y + BAND_H / 2 + 7, g.name, 20, 700, PEACH_TEXT);
      y += BAND_H;
    }
    g.roles.forEach((role) => {
      const slots = role.slots || 1;
      parts.push(`<rect x="0" y="${y}" width="${LABEL_W}" height="${ROW_H * slots}" fill="${PEACH}" stroke="#000" />`);
      text(10, y + (ROW_H * slots) / 2 + 5, role.label, 13, 700, '#000', 'start');
      for (let s = 0; s < slots; s++) {
        const key = `${role.key}_${s}`;
        cols.forEach((c, ci) => {
          const x = LABEL_W + ci * COL_W;
          const blocked = !!(blockedCells[key] || [])[ci];
          const nom = (affectations[key] || [])[ci];
          parts.push(`<rect x="${x}" y="${y + s * ROW_H}" width="${COL_W}" height="${ROW_H}" fill="${blocked ? '#d1d5db' : '#ffffff'}" stroke="#000" />`);
          if (!blocked && nom) text(x + COL_W / 2, y + s * ROW_H + ROW_H / 2 + 5, String(nom).toUpperCase(), 12, 500, '#000');
        });
      }
      y += ROW_H * slots;
    });
  });

  y += 24;
  text(width / 2, y, 'Planning événement — PAV Manager', 10, 400, '#6b7280');
  const height = y + 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />${parts.join('')}</svg>`;
  return { svg, width, height };
}
