import { delimiterGroup, MOIS_NOMS, applyNameCase, MOIS_ABBR, DEFAULT_SECTIONS } from './constants';
// Bibliothèque lourde (~330 Ko) : chargée seulement quand on exporte, pas à l'ouverture de la page.
let XLSX;
export const loadXLSX = async () => { XLSX = XLSX || (await import('xlsx-js-style')); };

// ---------------------------------------------------------------------------
// PNG export engine — dedicated, data-driven, independent of the on-screen
// table. It builds an SVG entirely from the planning data (never screenshots
// the interactive DOM), so there is no leftover UI chrome, no dependency on
// live layout/viewport, and no risk of an intrinsically-tall capture. Width
// is derived from the computed height so the output is always a true
// landscape image, close to the original Excel layout, with borders/colors/
// grayed cells preserved and nothing rotated or cut off.
// ---------------------------------------------------------------------------
export const EXPORT_FONT = "Arial, Helvetica, sans-serif";

export function createTextMeasurer() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  return (text, fontPx, weight = "400") => {
    ctx.font = `${weight} ${fontPx}px ${EXPORT_FONT}`;
    return ctx.measureText(text).width;
  };
}

export function wrapExportText(measure, text, maxWidth, fontPx, weight = "400") {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (measure(test, fontPx, weight) > maxWidth) {
      lines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  lines.push(current);
  return lines;
}

export function escapeXml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
}

export function buildPlanningExportSVG({
  activeDay,
  currentMonth,
  currentYear,
  currentDates,
  daySections,
  affectations,
  blockedCells,
  titreOverrides,
  dateLabels,
  formatDate,
  nameCase,
  layout = "landscape", // "story" : colonnes étroites pour un export vertical 9:16
}) {
  const story = layout === "story";
  const measure = createTextMeasurer();

  // Couleurs alignées sur l'analyse pixel par pixel du PNG de référence
  // fourni par l'utilisateur (28/09/2026) : bleu #A6C8EB (bandes/en-têtes),
  // gris #AEAEAE (cases grisées/bloquées), fond blanc, traits noirs.
  const BAND_COLOR = activeDay === "dimanche" ? "#FCE4D6" : "#A6C8EB";
  const TITLE_COLOR = activeDay === "dimanche" ? "#C55A11" : "#1F4E78";
  const GREY = "#AEAEAE";
  const BORDER = "#000000";
  const WHITE = "#FFFFFF";

  // Tailles augmentées + padding encore resserré (retour 28/09/2026 :
  // toujours besoin de zoomer). On repousse encore plus loin dans la même
  // direction : marges/gouttières réduites au minimum lisible, police un
  // cran plus grande, interligne resserré à la taille de police — c'est
  // l'espace gagné ici qui permet à la police de monter sans agrandir le
  // fichier.
  // Fix 28/09/2026 (analyse pixel par pixel du PNG de référence fournie par
  // l'utilisateur) : reproduction fidèle de sa grille — 5 colonnes de
  // largeur STRICTEMENT ÉGALE (étiquette = colonnes de dates, ~252px sur
  // l'image de référence en 1280 large), bandes de section nettement plus
  // grandes/hautes (REGIE/CADREURS/RÉGISSEURS/DIFFUSION ~31-32px avec police
  // ~20-22px), lignes standard ~18px, en-tête affectation/dates ~35px,
  // titre/sous-titre/espace ~30/32/17px.
  // Fix 28/09/2026 (retour GPT/utilisateur : "l'export n'est pas le
  // tableau affiché, il faut un rendu compact, dense, sans grand vide")
  // : toutes les constantes ci-dessous sont resserrées par rapport à la
  // version précédente pour produire un PNG plus dense (moins de marge,
  // bandes de section moins hautes, lignes standard plus basses), et le
  // canvas final n'est plus jamais forcé à 1280x1032 — voir
  // svgToPngDataUrl plus bas, qui rasterise désormais à la taille
  // naturelle du SVG (x2 pour la netteté), ratio inchangé, donc plus
  // aucune déformation.
  const FONT_TITLE = 19;
  const FONT_SUB = 12;
  const FONT_HEADER = 12;
  const FONT_BAND = 15;
  const FONT_LABEL = 11;
  const FONT_CELL = 11;
  const LINE_H = 13;

  // Fix 28/09/2026 (retour utilisateur : le ratio naturel ~0,93 était trop
  // vertical vs la référence ~1,24) : colonnes élargies de 150 à 200 pour
  // rapprocher le ratio naturel largeur/hauteur du SVG de la référence,
  // sans jamais réintroduire de resize/canvas forcé (voir svgToPngDataUrl).
  let LABEL_W = story ? 118 : 200;
  let DATE_W = story ? 98 : 200;
  const PAD = 3;
  const MARGIN = 8;

  const nDates = currentDates.length || 1;
  const hasAnyDateLabel = currentDates.some(
    (d) => dateLabels?.[activeDay]?.[d],
  );
  const HEADER_H = hasAnyDateLabel ? 34 : 26;
  const BAND_H = 22;

  // ---- Pass 1: compute row heights for both tables from the real data ----
  const buildTableLayout = (tableSections) => {
    const rows = [];
    (tableSections || []).forEach((section) => {
      if (!section.standalone) {
        rows.push({ kind: "band", text: section.name, height: BAND_H });
      }
      section.roles.forEach((role, roleIdx) => {
        const prevRole = section.roles[roleIdx - 1];
        // Même règle que le rendu à l'écran/impression (voir isGroupBoundary
        // dans le tableau live) : une ligne séparatrice en gras entre deux
        // postes différents, ou quand le poste précédent a
        // separateurApres=true — manquait dans l'export PNG jusqu'ici.
        const groupBoundary =
          roleIdx > 0 &&
          prevRole &&
          (delimiterGroup(section.name, role.label) !==
            delimiterGroup(section.name, prevRole.label) ||
            !!prevRole.separateurApres);
        const slotHeights = [];
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          let h = 15;
          for (let dateIdx = 0; dateIdx < nDates; dateIdx++) {
            const key = `${role.key}_${slotIdx}`;
            const value = affectations[key]?.[dateIdx] || "";
            if (value) {
              const lines = wrapExportText(
                measure,
                value,
                DATE_W - PAD * 2,
                FONT_CELL,
                "500",
              );
              const needed = lines.length * LINE_H + 8;
              if (needed > h) h = needed;
            }
          }
          slotHeights.push(h);
        }
        const labelLines = wrapExportText(
          measure,
          role.label,
          LABEL_W - PAD * 2,
          FONT_LABEL,
          "600",
        );
        const neededLabelH = labelLines.length * LINE_H + 8;
        const mergedHeight = slotHeights.reduce((a, b) => a + b, 0);
        if (neededLabelH > mergedHeight) {
          const extra = neededLabelH - mergedHeight;
          const per = extra / role.slots;
          for (let i = 0; i < slotHeights.length; i++) slotHeights[i] += per;
        }
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          rows.push({
            kind: "role",
            role,
            slotIdx,
            height: slotHeights[slotIdx],
            labelLines: slotIdx === 0 ? labelLines : null,
            groupBoundary: slotIdx === 0 ? groupBoundary : false,
          });
        }
      });
    });
    return rows;
  };

  const rows1 = buildTableLayout(daySections.table1 || []);
  const rows2 = buildTableLayout(daySections.table2 || []);

  const tableHeight = (rows) =>
    HEADER_H + rows.reduce((a, r) => a + r.height, 0);
  const TABLE_GAP = 16;
  const TITLE_H = 24;
  const SUB_H = 20;
  const TOP_GAP = 8;
  const FOOTER_GAP = 5;
  const FOOTER_TEXT =
    "SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU DÉPARTEMENT";
  const FONT_FOOTER = 9;
  const FOOTER_H = FONT_FOOTER + 4;

  const table1H = tableHeight(rows1);
  const table2H = tableHeight(rows2);

  let contentWidth = LABEL_W + DATE_W * nDates;
  const totalHeight =
    MARGIN * 2 +
    TITLE_H +
    SUB_H +
    TOP_GAP +
    table1H +
    TABLE_GAP +
    table2H +
    FOOTER_GAP +
    FOOTER_H;

  // ---- Pass 2: largeur du canvas ----
  // Fix 28/09/2026 (retour utilisateur) : le forçage précédent d'un ratio
  // paysage 1.5 étirait DATE_W (largeur des colonnes de noms) bien au-delà
  // du texte réel dès que le tableau était haut (beaucoup de lignes), ce
  // qui laissait un grand vide à gauche/droite de chaque nom centré — donc
  // illisible malgré une police plus grande. On garde simplement la largeur
  // naturelle du contenu (étiquette + colonnes de dates dimensionnées pour
  // le texte), sans l'étirer pour atteindre un ratio arbitraire.
  const totalWidth = contentWidth + MARGIN * 2;

  // ---- Pass 3: draw ----
  const svgParts = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
  );
  svgParts.push(
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${WHITE}"/>`,
  );

  let y = MARGIN;
  const cx = totalWidth / 2;

  const titleText =
    titreOverrides?.[activeDay]?.titre ||
    `${(MOIS_NOMS[currentMonth - 1] || "").toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`;
  svgParts.push(
    `<text x="${cx}" y="${y + TITLE_H / 2 + FONT_TITLE * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_TITLE}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(titleText)}</text>`,
  );
  y += TITLE_H;

  const subText =
    titreOverrides?.[activeDay]?.sous_titre ||
    (activeDay === "dimanche"
      ? "RDV à partir de 8h00 en salle 114"
      : "RDV à partir de 18h30 en salle 114");
  svgParts.push(
    `<rect x="${MARGIN}" y="${y}" width="${contentWidth}" height="${SUB_H}" fill="${BAND_COLOR}"/>`,
  );
  svgParts.push(
    `<text x="${cx}" y="${y + SUB_H / 2 + FONT_SUB * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_SUB}" font-weight="600" fill="${TITLE_COLOR}">${escapeXml(subText)}</text>`,
  );
  y += SUB_H + TOP_GAP;

  const drawTable = (rows) => {
    let x = MARGIN;
    svgParts.push(
      `<rect x="${x}" y="${y}" width="${LABEL_W}" height="${HEADER_H}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`,
    );
    svgParts.push(
      `<text x="${x + LABEL_W / 2}" y="${y + HEADER_H / 2 + FONT_HEADER * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_HEADER}" font-weight="700" fill="${TITLE_COLOR}">AFFECTATION</text>`,
    );
    let hx = x + LABEL_W;
    currentDates.forEach((date) => {
      svgParts.push(
        `<rect x="${hx}" y="${y}" width="${DATE_W}" height="${HEADER_H}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`,
      );
      const label = formatDate(date);
      const guestLabel = dateLabels?.[activeDay]?.[date];
      const dCy = guestLabel
        ? y + HEADER_H / 2 - 6
        : y + HEADER_H / 2 + FONT_HEADER * 0.35;
      svgParts.push(
        `<text x="${hx + DATE_W / 2}" y="${dCy}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_HEADER}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(label)}</text>`,
      );
      if (guestLabel) {
        const gLines = wrapExportText(
          measure,
          guestLabel,
          DATE_W - PAD * 2,
          9,
          "400",
        );
        gLines.slice(0, 2).forEach((line, i) => {
          svgParts.push(
            `<text x="${hx + DATE_W / 2}" y="${y + HEADER_H / 2 + 6 + i * 10}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="9" fill="${TITLE_COLOR}">${escapeXml(line)}</text>`,
          );
        });
      }
      hx += DATE_W;
    });
    y += HEADER_H;

    let i = 0;
    while (i < rows.length) {
      const row = rows[i];
      if (row.kind === "band") {
        svgParts.push(
          `<rect x="${MARGIN}" y="${y}" width="${contentWidth}" height="${row.height}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`,
        );
        svgParts.push(
          `<text x="${cx}" y="${y + row.height / 2 + FONT_BAND * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_BAND}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(row.text)}</text>`,
        );
        y += row.height;
        i += 1;
        continue;
      }
      const role = row.role;
      const slotRows = [];
      let j = i;
      while (
        j < rows.length &&
        rows[j].kind === "role" &&
        rows[j].role === role
      ) {
        slotRows.push(rows[j]);
        j += 1;
      }
      const rowTopY = y;
      const mergedH = slotRows.reduce((a, r) => a + r.height, 0);
      svgParts.push(
        `<rect x="${MARGIN}" y="${rowTopY}" width="${LABEL_W}" height="${mergedH}" fill="${WHITE}" stroke="${BORDER}"/>`,
      );
      const lLines = slotRows[0].labelLines || [role.label];
      const lBlockH = lLines.length * LINE_H;
      const lStartY = rowTopY + mergedH / 2 - lBlockH / 2 + LINE_H * 0.75;
      // Fix 28/09/2026 (référence utilisateur) : étiquettes de poste
      // centrées horizontalement (pas alignées à gauche comme un tableau
      // Excel classique) — c'est le rendu observé sur le PNG de référence.
      lLines.forEach((line, li) => {
        svgParts.push(
          `<text x="${MARGIN + LABEL_W / 2}" y="${lStartY + li * LINE_H}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_LABEL}" font-weight="600" fill="#111111">${escapeXml(line)}</text>`,
        );
      });
      let sy = rowTopY;
      slotRows.forEach((sr) => {
        let cx2 = MARGIN + LABEL_W;
        currentDates.forEach((_, dateIdx) => {
          const key = `${role.key}_${sr.slotIdx}`;
          const value = affectations[key]?.[dateIdx] || "";
          const singleBlocked = !!blockedCells[key]?.[dateIdx];
          const isBlocked = role.blocked || singleBlocked;
          svgParts.push(
            `<rect x="${cx2}" y="${sy}" width="${DATE_W}" height="${sr.height}" fill="${isBlocked ? GREY : WHITE}" stroke="${BORDER}"/>`,
          );
          if (!isBlocked && value) {
            const casedValue = applyNameCase(value, nameCase);
            const vLines = wrapExportText(
              measure,
              casedValue,
              DATE_W - PAD * 2,
              FONT_CELL,
              "500",
            );
            const vBlockH = vLines.length * LINE_H;
            const vStartY = sy + sr.height / 2 - vBlockH / 2 + LINE_H * 0.75;
            vLines.forEach((line, li) => {
              svgParts.push(
                `<text x="${cx2 + DATE_W / 2}" y="${vStartY + li * LINE_H}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_CELL}" font-weight="500" fill="#111111">${escapeXml(line)}</text>`,
              );
            });
          }
          cx2 += DATE_W;
        });
        sy += sr.height;
      });
      if (row.groupBoundary) {
        const THICK = 3;
        svgParts.push(
          `<rect x="${MARGIN}" y="${rowTopY - THICK / 2}" width="${contentWidth}" height="${THICK}" fill="${BORDER}"/>`,
        );
      }
      y += mergedH;
      i = j;
    }
  };

  drawTable(rows1);
  y += TABLE_GAP;
  drawTable(rows2);

  // Standard disclaimer, centered under the whole planning — mirrors the
  // on-screen/print footer so the PNG export matches what gets printed.
  y += FOOTER_GAP;
  const footerLines = wrapExportText(
    measure,
    FOOTER_TEXT,
    contentWidth - PAD * 2,
    FONT_FOOTER,
    "600",
  );
  footerLines.forEach((line, li) => {
    svgParts.push(
      `<text x="${cx}" y="${y + FONT_FOOTER * 0.85 + li * (FONT_FOOTER + 4)}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_FOOTER}" font-weight="600" font-style="italic" fill="#555555">${escapeXml(line)}</text>`,
    );
  });

  svgParts.push("</svg>");
  // Fix 28/09/2026 : log de diagnostic (ratio obtenu très différent de ce
  // qui était attendu côté calcul manuel) — permet de vérifier en un
  // export les dimensions naturelles réelles produites par le SVG, sans
  // deviner. Voir la console navigateur (F12) après un export PNG.
  console.log(
    `[Export PNG] SVG naturel: ${totalWidth}x${totalHeight} (ratio=${(totalWidth / totalHeight).toFixed(3)}) | LABEL_W=${LABEL_W} DATE_W=${DATE_W} nDates=${nDates}`,
  );
  return { svg: svgParts.join(""), width: totalWidth, height: totalHeight };
}

// Builds an .xlsx workbook mirroring the current planning view — same data
// walk as buildPlanningExportSVG above (title/subtitle, table1, table2,
// footer), but emitting spreadsheet rows instead of SVG draw commands.
// Uses xlsx-js-style rather than plain "xlsx": the community "xlsx"
// package silently drops cell style writes (fills/bold survive in memory
// but never make it into the .xlsx file), so a colored/bold export needs
// this fork instead — same API, styles actually persist.
// Construit UNE feuille (worksheet) pour un jour donné (vendredi OU
// dimanche) — extrait de l'ancien buildPlanningExportXLSX qui ne
// produisait qu'un seul onglet à la fois. Réutilisé deux fois par
// buildPlanningExportXLSX ci-dessous pour produire un classeur avec les
// deux jours dans deux onglets nommés (demande 28/09/2026 : "exporte les
// deux pages vendredi dimanche avec deux feuilles").
export function buildPlanningDayWorksheet({
  activeDay,
  currentMonth,
  currentYear,
  currentDates,
  daySections,
  affectations,
  blockedCells,
  titreOverrides,
  dateLabels,
  formatDate,
  nameCase,
}) {
  const BAND_HEX = activeDay === "dimanche" ? "FCE4D6" : "BDD7EE";
  const TITLE_HEX = activeDay === "dimanche" ? "C55A11" : "1F4E78";
  const GREY_HEX = "D1D5DB";
  const THIN = { style: "thin", color: { rgb: "000000" } };
  const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

  const nDates = currentDates.length || 1;
  const nCols = 1 + nDates;

  const aoa = [];
  const merges = [];
  const styleOps = [];
  const addRow = (cells) => {
    aoa.push(cells);
    return aoa.length - 1;
  };
  const setStyle = (r, c, style) => styleOps.push({ r, c, style });
  const styleRange = (r, c1, c2, style) => {
    for (let c = c1; c <= c2; c++) setStyle(r, c, style);
  };

  const titleText =
    titreOverrides?.[activeDay]?.titre ||
    `${(MOIS_NOMS[currentMonth - 1] || "").toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`;
  let r = addRow([titleText, ...Array(nDates).fill(null)]);
  merges.push({ s: { r, c: 0 }, e: { r, c: nCols - 1 } });
  setStyle(r, 0, {
    font: { bold: true, sz: 16, color: { rgb: TITLE_HEX } },
    alignment: { horizontal: "center", vertical: "center" },
  });

  const subText =
    titreOverrides?.[activeDay]?.sous_titre ||
    (activeDay === "dimanche"
      ? "RDV à partir de 8h00 en salle 114"
      : "RDV à partir de 18h30 en salle 114");
  r = addRow([subText, ...Array(nDates).fill(null)]);
  merges.push({ s: { r, c: 0 }, e: { r, c: nCols - 1 } });
  styleRange(r, 0, nCols - 1, {
    font: { bold: true, color: { rgb: TITLE_HEX } },
    fill: { fgColor: { rgb: BAND_HEX } },
    alignment: { horizontal: "center", vertical: "center" },
  });

  addRow(Array(nCols).fill(null));

  const drawTable = (tableSections) => {
    const headerCells = ["AFFECTATION"];
    currentDates.forEach((date) => {
      const guestLabel = dateLabels?.[activeDay]?.[date];
      headerCells.push(
        guestLabel ? `${formatDate(date)}\n${guestLabel}` : formatDate(date),
      );
    });
    const headerRow = addRow(headerCells);
    styleRange(headerRow, 0, nCols - 1, {
      font: { bold: true, color: { rgb: TITLE_HEX } },
      fill: { fgColor: { rgb: BAND_HEX } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: CELL_BORDER,
    });
    setStyle(headerRow, 0, {
      font: { bold: true, color: { rgb: TITLE_HEX } },
      fill: { fgColor: { rgb: BAND_HEX } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: CELL_BORDER,
    });

    (tableSections || []).forEach((section) => {
      if (!section.standalone) {
        const bandRow = addRow([section.name, ...Array(nDates).fill(null)]);
        merges.push({
          s: { r: bandRow, c: 0 },
          e: { r: bandRow, c: nCols - 1 },
        });
        styleRange(bandRow, 0, nCols - 1, {
          font: { bold: true, color: { rgb: TITLE_HEX } },
          fill: { fgColor: { rgb: BAND_HEX } },
          alignment: { horizontal: "center", vertical: "center" },
          border: CELL_BORDER,
        });
      }
      section.roles.forEach((role) => {
        const firstRow = aoa.length;
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          const key = `${role.key}_${slotIdx}`;
          const rowCells = [slotIdx === 0 ? role.label : ""];
          currentDates.forEach((_, dateIdx) => {
            const singleBlocked = !!blockedCells[key]?.[dateIdx];
            const isBlocked = role.blocked || singleBlocked;
            const raw = affectations[key]?.[dateIdx] || "";
            rowCells.push(isBlocked ? "" : applyNameCase(raw, nameCase));
          });
          const rowIdx = addRow(rowCells);
          setStyle(rowIdx, 0, {
            font: { bold: true },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: CELL_BORDER,
          });
          currentDates.forEach((_, dateIdx) => {
            const singleBlocked = !!blockedCells[key]?.[dateIdx];
            const isBlocked = role.blocked || singleBlocked;
            const cellStyle = {
              alignment: { horizontal: "center", vertical: "center" },
              border: CELL_BORDER,
            };
            if (isBlocked) cellStyle.fill = { fgColor: { rgb: GREY_HEX } };
            setStyle(rowIdx, 1 + dateIdx, cellStyle);
          });
        }
        if (role.slots > 1) {
          merges.push({
            s: { r: firstRow, c: 0 },
            e: { r: firstRow + role.slots - 1, c: 0 },
          });
        }
      });
    });
  };

  drawTable(daySections.table1 || []);
  addRow(Array(nCols).fill(null));
  drawTable(daySections.table2 || []);

  addRow(Array(nCols).fill(null));
  const footerRow = addRow([
    "SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU DÉPARTEMENT",
    ...Array(nDates).fill(null),
  ]);
  merges.push({ s: { r: footerRow, c: 0 }, e: { r: footerRow, c: nCols - 1 } });
  styleRange(footerRow, 0, nCols - 1, {
    font: { italic: true, sz: 9, color: { rgb: "555555" } },
    alignment: { horizontal: "center" },
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 24 }, ...Array(nDates).fill({ wch: 24 })];
  styleOps.forEach(({ r: rr, c: cc, style }) => {
    const ref = XLSX.utils.encode_cell({ r: rr, c: cc });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  });
  return ws;
}

// Classeur complet : un onglet par jour (Vendredi puis Dimanche), nommés
// "V-JANV-2026" / "D-JANV-2026" (jour-mois-année, comme demandé) plutôt que
// de ne jamais exporter qu'un seul des deux jours à la fois.
export function buildPlanningExportXLSX({
  currentMonth,
  currentYear,
  dates,
  sections,
  affectations,
  blockedCells,
  titreOverrides,
  dateLabels,
  formatDate,
  nameCase,
}) {
  const moisAbbr = MOIS_ABBR[currentMonth - 1] || "";
  const wb = XLSX.utils.book_new();
  [
    { day: "vendredi", prefix: "V" },
    { day: "dimanche", prefix: "D" },
  ].forEach(({ day, prefix }) => {
    const daySections = sections[day] || DEFAULT_SECTIONS[day];
    const currentDates = dates[day] || [];
    const ws = buildPlanningDayWorksheet({
      activeDay: day,
      currentMonth,
      currentYear,
      currentDates,
      daySections,
      affectations,
      blockedCells,
      titreOverrides,
      dateLabels,
      formatDate,
      nameCase,
    });
    const sheetName = `${prefix}-${moisAbbr}-${currentYear}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// Fix 28/09/2026 (diagnostic + consigne utilisateur) : le canvas cible
// fixe 1280x1032 a été supprimé — il forçait un étirement non uniforme
// (largeur et hauteur indépendantes) qui déformait le tableau dès que son
// ratio naturel s'écartait de 1,2403:1. Le PNG est maintenant rasterisé
// strictement à la taille naturelle du SVG (celle calculée par
// buildPlanningExportSVG à partir du contenu réel) multipliée par `scale`
// pour la netteté — largeur et hauteur suivent le même facteur, donc le
// ratio ne bouge jamais. Si une largeur cible fixe est nécessaire un jour,
// calculer la hauteur à partir du ratio naturel plutôt que de fixer les
// deux dimensions : targetHeight = naturalHeight * (targetWidth / naturalWidth).
export async function svgToPngDataUrl(svgString, width, height, scale = 2) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Export vertical « story » 9:16 (1080 x 1920) : le planning (construit avec le layout "story")
// est mis à la largeur de l'image, centré verticalement ; s'il est trop haut il est réduit pour tenir.
export async function svgToStoryPngDataUrl(svgString, width, height) {
  const OUT_W = 1080;
  const OUT_H = 1920;
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    const MARGIN = 24;
    const scale = Math.min((OUT_W - MARGIN * 2) / width, (OUT_H - MARGIN * 2) / height);
    const dw = width * scale;
    const dh = height * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
    return { dataUrl: canvas.toDataURL("image/png"), width: OUT_W, height: OUT_H };
  } finally {
    URL.revokeObjectURL(url);
  }
}
