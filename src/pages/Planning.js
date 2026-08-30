import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  CalendarDays,
  Loader2,
  Printer,
  Save,
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Trash2,
  ImageDown,
  CalendarOff,
  FolderPlus,
  Ban,
  Combine,
  Split,
  X,
  Pencil,
  Eraser,
  PartyPopper,
  CheckCircle2,
  EyeOff,
  Cloud,
  CopyPlus,
  ArrowLeftRight,
  FileSpreadsheet,
  Download,
  ChevronDown,
} from 'lucide-react';
import PlanningEvenementSection from './PlanningEvenementSection';
import { getCachedTechniciens, setCachedTechniciens } from '../lib/technicienCache';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';
import * as XLSX from 'xlsx-js-style';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Name-case display transform applied to assigned names — pure CSS
// text-transform, so it's view-only and never mutates the stored value
// (typing/autocomplete still work against the real name). Names in this
// roster are single words in practice, so CSS "capitalize" (first letter of
// each word) reads the same as "first letter only".
const NAME_CASE_CSS = { normal: 'none', upper: 'uppercase', lower: 'lowercase', capitalize: 'capitalize' };

// Same transform, applied directly to the string — used by the PNG export
// path (SVG rasterized via <img>/canvas), where relying on the browser to
// honor a CSS text-transform on foreign-object-free SVG <text> is less
// predictable than just rendering the already-cased string.
function applyNameCase(value, nameCase) {
  if (!value) return value;
  switch (nameCase) {
    case 'upper': return value.toUpperCase();
    case 'lower': return value.toLowerCase();
    case 'capitalize':
      return value.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    default: return value;
  }
}

const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040];
// Le planning ne remonte pas avant août 2026 (mise en service de l'app) et
// ne va pas au-delà de 2040 — les mois/années hors de cette plage ne sont
// pas sélectionnables.
const MIN_YEAR = 2026;
const MIN_MONTH_IN_MIN_YEAR = 8; // Août
const MAX_YEAR = 2040;

const THEME = {
  vendredi: {
    band: 'bg-[#BDD7EE] text-[#1F4E78]',
    title: 'text-[#1F4E78]',
    subtitle: 'bg-[#BDD7EE] text-[#1F4E78]',
    tab: 'data-[state=active]:bg-blue-500 data-[state=active]:text-white',
  },
  dimanche: {
    band: 'bg-[#FCE4D6] text-[#C55A11]',
    title: 'text-[#C55A11]',
    subtitle: 'bg-[#FCE4D6] text-[#C55A11]',
    tab: 'data-[state=active]:bg-orange-500 data-[state=active]:text-white',
  }
};

// Memoized cell component for better performance
const PlanningCell = memo(({ value, canEdit, onChange, blocked, datalistId, nameCase }) => {
  const textTransform = NAME_CASE_CSS[nameCase] || 'none';
  if (blocked) {
    return <span className="w-full h-7 block bg-gray-300 dark:bg-gray-600 print:bg-gray-300"></span>;
  }
  if (!canEdit) {
    // Names from the Effectif must stay fully legible: wrap instead of
    // clipping, and keep a title tooltip as a fallback.
    return (
      <span
        className="text-center block text-xs leading-tight py-1 px-0.5 font-medium break-words whitespace-normal"
        style={{ textTransform }}
        title={value || ''}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      type="text"
      list={datalistId || 'tech-list'}
      title={value || ''}
      className="w-full h-7 text-xs border-0 bg-transparent px-1 focus:outline-none focus:ring-1 focus:ring-primary rounded"
      style={{ textTransform }}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="-"
    />
  );
});

PlanningCell.displayName = 'PlanningCell';

// Canonical poste taxonomy — mirrors the backend's POSTES list. Used to
// figure out, for any given role cell in the table, which "poste" category
// it belongs to, so the assignment dropdown can be filtered to only the
// people qualified for it (per their fiche Effectif) rather than showing
// the entire staff roster on every single cell.
function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function canonPoste(sectionName, label) {
  if (!label) return null;
  const lu = stripAccents(label).toUpperCase().trim();
  if (lu.startsWith('CAMERA')) return 'Cadreur (Caméra)';
  if (/^POSTE \d+$/.test(lu)) return 'Régisseur';
  if (lu === 'SUPERVISION') {
    if (sectionName === 'REGISSEURS') return 'Supervision Régisseurs';
    if (sectionName === 'DIFFUSION') return 'Supervision Diffusion';
    return 'Supervision Régie';
  }
  if (lu.startsWith('OPERATEUR VDO')) return 'Opérateur VDO';
  if (lu.startsWith('OPERATEUR INCRUSTATION')) return 'Opérateur Incrustation';
  if (lu === 'SANCTUAIRE' || lu.startsWith('SALLE') || lu === 'GYMNASE' || lu === 'POLY 3') return 'Diffusion (Salles)';
  const compact = lu.replace(/[^A-Z]/g, '');
  if (compact === 'REALISATEUR') return 'Réalisateur';
  if (compact === 'ASSISTANTREALISATEURTRUQUISTE') return 'Assistant réalisateur / truquiste';
  if (compact === 'ETALONNEUR') return 'Étalonneur';
  if (compact === 'ANIMATEURVDOVFX') return 'Animateur VDO / VFX';
  if (compact === 'INTERCOMENREGISTREMENTFCP') return 'Intercom / Enregistrement FCP';
  // Custom/renamed roles: use the label itself as its own poste category —
  // nobody will be pre-tagged for it, so the fallback below shows everyone.
  return label.trim();
}

function slugPoste(poste) {
  return stripAccents(poste || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Default planning structure — mirrors the reference paper planning exactly:
// two tables per day (REGIE+CADREURS, then REGISSEURS+DIFFUSION), with a
// standalone "Supervision" row above the REGIE band on the first table.
const DEFAULT_SECTIONS = {
  dimanche: {
    table1: [
      { name: 'SUPERVISION', standalone: true, roles: [
        { key: 'supervision', label: 'Supervision', slots: 1 },
      ]},
      { name: 'REGIE', roles: [
        { key: 'realisateur', label: 'Réalisateur', slots: 1 },
        { key: 'assistant_realisateur', label: 'Assistant réalisateur / truquiste', slots: 1 },
        { key: 'etalonneur', label: 'Étalonneur', slots: 1 },
        { key: 'operateur_vdo_a', label: 'Opérateur VDO A', slots: 1 },
        { key: 'operateur_vdo_b', label: 'Opérateur VDO B', slots: 1 },
        { key: 'operateur_vdo_c', label: 'Opérateur VDO C', slots: 1 },
        { key: 'operateur_incrustation_a', label: 'Opérateur Incrustation A', slots: 1 },
        { key: 'operateur_incrustation_b', label: 'Opérateur Incrustation B', slots: 1 },
        { key: 'operateur_incrustation_c', label: 'Opérateur Incrustation C', slots: 1 },
        { key: 'animateur_vfx_1', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'animateur_vfx_2', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'animateur_vfx_3', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'intercom_fcp', label: 'Intercom / Enregistrement FCP', slots: 1 },
      ]},
      { name: 'CADREURS', roles: [
        { key: 'camera_1', label: 'Caméra 1', slots: 2 },
        { key: 'camera_2', label: 'Caméra 2', slots: 2 },
        { key: 'camera_3', label: 'Caméra 3', slots: 2 },
        { key: 'camera_4', label: 'Caméra 4', slots: 2 },
        { key: 'camera_5', label: 'Caméra 5', slots: 2 },
        { key: 'camera_6', label: 'Caméra 6', slots: 2 },
      ]},
    ],
    table2: [
      { name: 'REGISSEURS', roles: [
        { key: 'regisseur_supervision', label: 'Supervision', slots: 1 },
        { key: 'regisseur_poste_1', label: 'Poste 1', slots: 1 },
        { key: 'regisseur_poste_2', label: 'Poste 2', slots: 1 },
        { key: 'regisseur_poste_3', label: 'Poste 3', slots: 1 },
        { key: 'regisseur_poste_4', label: 'Poste 4', slots: 1 },
      ]},
      { name: 'DIFFUSION', roles: [
        { key: 'diffusion_supervision', label: 'Supervision', slots: 1 },
        { key: 'diffusion_sanctuaire_1', label: 'Sanctuaire', slots: 1 },
        { key: 'diffusion_sanctuaire_2', label: 'Sanctuaire', slots: 1 },
        { key: 'diffusion_sanctuaire_3', label: 'Sanctuaire', slots: 1 },
        { key: 'diffusion_salle_annexe_1', label: 'Salle Annexe 1', slots: 1 },
        { key: 'diffusion_salle_annexe_2', label: 'Salle Annexe 2', slots: 1 },
        { key: 'diffusion_poly_3', label: 'Poly 3', slots: 1, blocked: true },
        { key: 'diffusion_gymnase', label: 'Gymnase', slots: 1, blocked: true },
      ]},
    ]
  },
  vendredi: {
    table1: [
      { name: 'SUPERVISION', standalone: true, roles: [
        { key: 'v_supervision', label: 'Supervision', slots: 1 },
      ]},
      { name: 'REGIE', roles: [
        { key: 'v_realisateur', label: 'Réalisateur', slots: 1 },
        { key: 'v_assistant_realisateur', label: 'Assistant réalisateur / truquiste', slots: 1 },
        { key: 'v_etalonneur', label: 'Étalonneur', slots: 1 },
        { key: 'v_operateur_vdo_a', label: 'Opérateur VDO A', slots: 1 },
        { key: 'v_operateur_vdo_b', label: 'Opérateur VDO B', slots: 1 },
        { key: 'v_operateur_vdo_c', label: 'Opérateur VDO C', slots: 1 },
        { key: 'v_operateur_incrustation_a', label: 'Opérateur Incrustation A', slots: 1 },
        { key: 'v_operateur_incrustation_b', label: 'Opérateur Incrustation B', slots: 1 },
        { key: 'v_operateur_incrustation_c', label: 'Opérateur Incrustation C', slots: 1 },
        { key: 'v_animateur_vfx_1', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'v_animateur_vfx_2', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'v_animateur_vfx_3', label: 'Animateur VDO / VFX', slots: 1 },
        { key: 'v_intercom_fcp', label: 'Intercom / Enregistrement FCP', slots: 1 },
      ]},
      { name: 'CADREURS', roles: [
        { key: 'v_camera_1', label: 'Caméra 1', slots: 2 },
        { key: 'v_camera_2', label: 'Caméra 2', slots: 2 },
        { key: 'v_camera_3', label: 'Caméra 3', slots: 2 },
        { key: 'v_camera_4', label: 'Caméra 4', slots: 2 },
        { key: 'v_camera_5', label: 'Caméra 5', slots: 2 },
        { key: 'v_camera_6_7', label: 'Caméra 6 et 7', slots: 3 },
      ]},
    ],
    table2: [
      { name: 'REGISSEURS', roles: [
        { key: 'v_regisseur_supervision', label: 'Supervision', slots: 1 },
        { key: 'v_regisseur_poste_1', label: 'Poste 1', slots: 1 },
        { key: 'v_regisseur_poste_2', label: 'Poste 2', slots: 1 },
        { key: 'v_regisseur_poste_3', label: 'Poste 3', slots: 1 },
      ]},
      { name: 'DIFFUSION', roles: [
        { key: 'v_diffusion_supervision', label: 'Supervision', slots: 1 },
        { key: 'v_diffusion_sanctuaire_1', label: 'Sanctuaire', slots: 1 },
        { key: 'v_diffusion_sanctuaire_2', label: 'Sanctuaire', slots: 1 },
        { key: 'v_diffusion_sanctuaire_3', label: 'Sanctuaire', slots: 1 },
        { key: 'v_diffusion_salle_poly_1', label: 'Salle Poly 1', slots: 1, blocked: true },
        { key: 'v_diffusion_salle_poly_2', label: 'Salle Poly 2', slots: 1, blocked: true },
        { key: 'v_diffusion_gymnase', label: 'Gymnase', slots: 1, blocked: true },
      ]},
    ]
  }
};

function countRows(sections) {
  // Standalone sections (e.g. the Supervision row) never render a separate
  // band row, so they don't contribute the "+1" a normal section does.
  return sections.reduce((acc, s) => acc + s.roles.reduce((a, r) => a + r.slots, 0) + (s.standalone ? 0 : 1), 0);
}

// ---------------------------------------------------------------------------
// PNG export engine — dedicated, data-driven, independent of the on-screen
// table. It builds an SVG entirely from the planning data (never screenshots
// the interactive DOM), so there is no leftover UI chrome, no dependency on
// live layout/viewport, and no risk of an intrinsically-tall capture. Width
// is derived from the computed height so the output is always a true
// landscape image, close to the original Excel layout, with borders/colors/
// grayed cells preserved and nothing rotated or cut off.
// ---------------------------------------------------------------------------
const EXPORT_FONT = 'Arial, Helvetica, sans-serif';

function createTextMeasurer() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return (text, fontPx, weight = '400') => {
    ctx.font = `${weight} ${fontPx}px ${EXPORT_FONT}`;
    return ctx.measureText(text).width;
  };
}

function wrapExportText(measure, text, maxWidth, fontPx, weight = '400') {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
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

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function buildPlanningExportSVG({
  activeDay, currentMonth, currentYear, currentDates, daySections,
  affectations, blockedCells, titreOverrides, dateLabels, formatDate, nameCase,
}) {
  const measure = createTextMeasurer();

  const BAND_COLOR = activeDay === 'dimanche' ? '#FCE4D6' : '#BDD7EE';
  const TITLE_COLOR = activeDay === 'dimanche' ? '#C55A11' : '#1F4E78';
  const GREY = '#D1D5DB';
  const BORDER = '#000000';
  const WHITE = '#FFFFFF';

  const FONT_TITLE = 20;
  const FONT_SUB = 12;
  const FONT_HEADER = 11.5;
  const FONT_BAND = 11.5;
  const FONT_LABEL = 10.5;
  const FONT_CELL = 10.5;
  const LINE_H = 12;

  let LABEL_W = 208;
  let DATE_W = 118;
  const PAD = 5;
  const MARGIN = 18;

  const nDates = currentDates.length || 1;
  const hasAnyDateLabel = currentDates.some((d) => dateLabels?.[activeDay]?.[d]);
  const HEADER_H = hasAnyDateLabel ? 44 : 30;
  const BAND_H = 20;

  // ---- Pass 1: compute row heights for both tables from the real data ----
  const buildTableLayout = (tableSections) => {
    const rows = [];
    (tableSections || []).forEach((section) => {
      if (!section.standalone) {
        rows.push({ kind: 'band', text: section.name, height: BAND_H });
      }
      section.roles.forEach((role) => {
        const slotHeights = [];
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          let h = 18;
          for (let dateIdx = 0; dateIdx < nDates; dateIdx++) {
            const key = `${role.key}_${slotIdx}`;
            const value = affectations[key]?.[dateIdx] || '';
            if (value) {
              const lines = wrapExportText(measure, value, DATE_W - PAD * 2, FONT_CELL, '500');
              const needed = lines.length * LINE_H + 8;
              if (needed > h) h = needed;
            }
          }
          slotHeights.push(h);
        }
        const labelLines = wrapExportText(measure, role.label, LABEL_W - PAD * 2, FONT_LABEL, '600');
        const neededLabelH = labelLines.length * LINE_H + 8;
        const mergedHeight = slotHeights.reduce((a, b) => a + b, 0);
        if (neededLabelH > mergedHeight) {
          const extra = neededLabelH - mergedHeight;
          const per = extra / role.slots;
          for (let i = 0; i < slotHeights.length; i++) slotHeights[i] += per;
        }
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          rows.push({
            kind: 'role',
            role,
            slotIdx,
            height: slotHeights[slotIdx],
            labelLines: slotIdx === 0 ? labelLines : null,
          });
        }
      });
    });
    return rows;
  };

  const rows1 = buildTableLayout(daySections.table1 || []);
  const rows2 = buildTableLayout(daySections.table2 || []);

  const tableHeight = (rows) => HEADER_H + rows.reduce((a, r) => a + r.height, 0);
  const TABLE_GAP = 14;
  const TITLE_H = 30;
  const SUB_H = 22;
  const TOP_GAP = 6;
  const FOOTER_GAP = 10;
  const FOOTER_TEXT = 'SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU DÉPARTEMENT';
  const FONT_FOOTER = 10;
  const FOOTER_H = FONT_FOOTER + 4;

  const table1H = tableHeight(rows1);
  const table2H = tableHeight(rows2);

  let contentWidth = LABEL_W + DATE_W * nDates;
  const totalHeight = MARGIN * 2 + TITLE_H + SUB_H + TOP_GAP + table1H + TABLE_GAP + table2H + FOOTER_GAP + FOOTER_H;

  // ---- Pass 2: derive a true-landscape width from the computed height ----
  // (rather than picking an arbitrary canvas size and hoping the content
  // fits it, or rotating/stretching the result afterwards).
  const TARGET_RATIO = 1.5;
  const desiredWidth = Math.max(contentWidth + MARGIN * 2, Math.ceil(totalHeight * TARGET_RATIO));
  if (desiredWidth > contentWidth + MARGIN * 2) {
    const extra = desiredWidth - (contentWidth + MARGIN * 2);
    DATE_W += extra / nDates;
    contentWidth = LABEL_W + DATE_W * nDates;
  }
  const totalWidth = contentWidth + MARGIN * 2;

  // ---- Pass 3: draw ----
  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`);
  svgParts.push(`<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${WHITE}"/>`);

  let y = MARGIN;
  const cx = totalWidth / 2;

  const titleText = titreOverrides?.[activeDay]?.titre
    || `${(MOIS_NOMS[currentMonth - 1] || '').toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`;
  svgParts.push(`<text x="${cx}" y="${y + TITLE_H / 2 + FONT_TITLE * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_TITLE}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(titleText)}</text>`);
  y += TITLE_H;

  const subText = titreOverrides?.[activeDay]?.sous_titre
    || (activeDay === 'dimanche' ? 'RDV à partir de 8h00 en salle 114' : 'RDV à partir de 18h30 en salle 114');
  svgParts.push(`<rect x="${MARGIN}" y="${y}" width="${contentWidth}" height="${SUB_H}" fill="${BAND_COLOR}"/>`);
  svgParts.push(`<text x="${cx}" y="${y + SUB_H / 2 + FONT_SUB * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_SUB}" font-weight="600" fill="${TITLE_COLOR}">${escapeXml(subText)}</text>`);
  y += SUB_H + TOP_GAP;

  const drawTable = (rows) => {
    let x = MARGIN;
    svgParts.push(`<rect x="${x}" y="${y}" width="${LABEL_W}" height="${HEADER_H}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`);
    svgParts.push(`<text x="${x + PAD}" y="${y + HEADER_H / 2 + FONT_HEADER * 0.35}" font-family="${EXPORT_FONT}" font-size="${FONT_HEADER}" font-weight="700" fill="${TITLE_COLOR}">AFFECTATION</text>`);
    let hx = x + LABEL_W;
    currentDates.forEach((date) => {
      svgParts.push(`<rect x="${hx}" y="${y}" width="${DATE_W}" height="${HEADER_H}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`);
      const label = formatDate(date);
      const guestLabel = dateLabels?.[activeDay]?.[date];
      const dCy = guestLabel ? y + HEADER_H / 2 - 6 : y + HEADER_H / 2 + FONT_HEADER * 0.35;
      svgParts.push(`<text x="${hx + DATE_W / 2}" y="${dCy}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_HEADER}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(label)}</text>`);
      if (guestLabel) {
        const gLines = wrapExportText(measure, guestLabel, DATE_W - PAD * 2, 9, '400');
        gLines.slice(0, 2).forEach((line, i) => {
          svgParts.push(`<text x="${hx + DATE_W / 2}" y="${y + HEADER_H / 2 + 6 + i * 10}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="9" fill="${TITLE_COLOR}">${escapeXml(line)}</text>`);
        });
      }
      hx += DATE_W;
    });
    y += HEADER_H;

    let i = 0;
    while (i < rows.length) {
      const row = rows[i];
      if (row.kind === 'band') {
        svgParts.push(`<rect x="${MARGIN}" y="${y}" width="${contentWidth}" height="${row.height}" fill="${BAND_COLOR}" stroke="${BORDER}"/>`);
        svgParts.push(`<text x="${cx}" y="${y + row.height / 2 + FONT_BAND * 0.35}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_BAND}" font-weight="700" fill="${TITLE_COLOR}">${escapeXml(row.text)}</text>`);
        y += row.height;
        i += 1;
        continue;
      }
      const role = row.role;
      const slotRows = [];
      let j = i;
      while (j < rows.length && rows[j].kind === 'role' && rows[j].role === role) {
        slotRows.push(rows[j]);
        j += 1;
      }
      const rowTopY = y;
      const mergedH = slotRows.reduce((a, r) => a + r.height, 0);
      svgParts.push(`<rect x="${MARGIN}" y="${rowTopY}" width="${LABEL_W}" height="${mergedH}" fill="${WHITE}" stroke="${BORDER}"/>`);
      const lLines = slotRows[0].labelLines || [role.label];
      const lBlockH = lLines.length * LINE_H;
      const lStartY = rowTopY + mergedH / 2 - lBlockH / 2 + LINE_H * 0.75;
      lLines.forEach((line, li) => {
        svgParts.push(`<text x="${MARGIN + PAD}" y="${lStartY + li * LINE_H}" font-family="${EXPORT_FONT}" font-size="${FONT_LABEL}" font-weight="600" fill="#111111">${escapeXml(line)}</text>`);
      });
      let sy = rowTopY;
      slotRows.forEach((sr) => {
        let cx2 = MARGIN + LABEL_W;
        currentDates.forEach((_, dateIdx) => {
          const key = `${role.key}_${sr.slotIdx}`;
          const value = affectations[key]?.[dateIdx] || '';
          const singleBlocked = !!(blockedCells[key]?.[dateIdx]);
          const isBlocked = role.blocked || singleBlocked;
          svgParts.push(`<rect x="${cx2}" y="${sy}" width="${DATE_W}" height="${sr.height}" fill="${isBlocked ? GREY : WHITE}" stroke="${BORDER}"/>`);
          if (!isBlocked && value) {
            const casedValue = applyNameCase(value, nameCase);
            const vLines = wrapExportText(measure, casedValue, DATE_W - PAD * 2, FONT_CELL, '500');
            const vBlockH = vLines.length * LINE_H;
            const vStartY = sy + sr.height / 2 - vBlockH / 2 + LINE_H * 0.75;
            vLines.forEach((line, li) => {
              svgParts.push(`<text x="${cx2 + DATE_W / 2}" y="${vStartY + li * LINE_H}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_CELL}" font-weight="500" fill="#111111">${escapeXml(line)}</text>`);
            });
          }
          cx2 += DATE_W;
        });
        sy += sr.height;
      });
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
  const footerLines = wrapExportText(measure, FOOTER_TEXT, contentWidth - PAD * 2, FONT_FOOTER, '600');
  footerLines.forEach((line, li) => {
    svgParts.push(`<text x="${cx}" y="${y + FONT_FOOTER * 0.85 + li * (FONT_FOOTER + 4)}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="${FONT_FOOTER}" font-weight="600" font-style="italic" fill="#555555">${escapeXml(line)}</text>`);
  });

  svgParts.push('</svg>');
  return { svg: svgParts.join(''), width: totalWidth, height: totalHeight };
}

// Builds an .xlsx workbook mirroring the current planning view — same data
// walk as buildPlanningExportSVG above (title/subtitle, table1, table2,
// footer), but emitting spreadsheet rows instead of SVG draw commands.
// Uses xlsx-js-style rather than plain "xlsx": the community "xlsx"
// package silently drops cell style writes (fills/bold survive in memory
// but never make it into the .xlsx file), so a colored/bold export needs
// this fork instead — same API, styles actually persist.
function buildPlanningExportXLSX({
  activeDay, currentMonth, currentYear, currentDates, daySections,
  affectations, blockedCells, titreOverrides, dateLabels, formatDate, nameCase,
}) {
  const BAND_HEX = activeDay === 'dimanche' ? 'FCE4D6' : 'BDD7EE';
  const TITLE_HEX = activeDay === 'dimanche' ? 'C55A11' : '1F4E78';
  const GREY_HEX = 'D1D5DB';
  const THIN = { style: 'thin', color: { rgb: '000000' } };
  const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

  const nDates = currentDates.length || 1;
  const nCols = 1 + nDates;

  const aoa = [];
  const merges = [];
  const styleOps = [];
  const addRow = (cells) => { aoa.push(cells); return aoa.length - 1; };
  const setStyle = (r, c, style) => styleOps.push({ r, c, style });
  const styleRange = (r, c1, c2, style) => { for (let c = c1; c <= c2; c++) setStyle(r, c, style); };

  const titleText = titreOverrides?.[activeDay]?.titre
    || `${(MOIS_NOMS[currentMonth - 1] || '').toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`;
  let r = addRow([titleText, ...Array(nDates).fill(null)]);
  merges.push({ s: { r, c: 0 }, e: { r, c: nCols - 1 } });
  setStyle(r, 0, { font: { bold: true, sz: 16, color: { rgb: TITLE_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } });

  const subText = titreOverrides?.[activeDay]?.sous_titre
    || (activeDay === 'dimanche' ? 'RDV à partir de 8h00 en salle 114' : 'RDV à partir de 18h30 en salle 114');
  r = addRow([subText, ...Array(nDates).fill(null)]);
  merges.push({ s: { r, c: 0 }, e: { r, c: nCols - 1 } });
  styleRange(r, 0, nCols - 1, { font: { bold: true, color: { rgb: TITLE_HEX } }, fill: { fgColor: { rgb: BAND_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } });

  addRow(Array(nCols).fill(null));

  const drawTable = (tableSections) => {
    const headerCells = ['AFFECTATION'];
    currentDates.forEach((date) => {
      const guestLabel = dateLabels?.[activeDay]?.[date];
      headerCells.push(guestLabel ? `${formatDate(date)}\n${guestLabel}` : formatDate(date));
    });
    const headerRow = addRow(headerCells);
    styleRange(headerRow, 0, nCols - 1, {
      font: { bold: true, color: { rgb: TITLE_HEX } },
      fill: { fgColor: { rgb: BAND_HEX } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: CELL_BORDER,
    });
    setStyle(headerRow, 0, {
      font: { bold: true, color: { rgb: TITLE_HEX } },
      fill: { fgColor: { rgb: BAND_HEX } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: CELL_BORDER,
    });

    (tableSections || []).forEach((section) => {
      if (!section.standalone) {
        const bandRow = addRow([section.name, ...Array(nDates).fill(null)]);
        merges.push({ s: { r: bandRow, c: 0 }, e: { r: bandRow, c: nCols - 1 } });
        styleRange(bandRow, 0, nCols - 1, {
          font: { bold: true, color: { rgb: TITLE_HEX } },
          fill: { fgColor: { rgb: BAND_HEX } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: CELL_BORDER,
        });
      }
      section.roles.forEach((role) => {
        const firstRow = aoa.length;
        for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
          const key = `${role.key}_${slotIdx}`;
          const rowCells = [slotIdx === 0 ? role.label : ''];
          currentDates.forEach((_, dateIdx) => {
            const singleBlocked = !!(blockedCells[key]?.[dateIdx]);
            const isBlocked = role.blocked || singleBlocked;
            const raw = affectations[key]?.[dateIdx] || '';
            rowCells.push(isBlocked ? '' : applyNameCase(raw, nameCase));
          });
          const rowIdx = addRow(rowCells);
          setStyle(rowIdx, 0, { font: { bold: true }, alignment: { vertical: 'center', wrapText: true }, border: CELL_BORDER });
          currentDates.forEach((_, dateIdx) => {
            const singleBlocked = !!(blockedCells[key]?.[dateIdx]);
            const isBlocked = role.blocked || singleBlocked;
            const cellStyle = { alignment: { horizontal: 'center', vertical: 'center' }, border: CELL_BORDER };
            if (isBlocked) cellStyle.fill = { fgColor: { rgb: GREY_HEX } };
            setStyle(rowIdx, 1 + dateIdx, cellStyle);
          });
        }
        if (role.slots > 1) {
          merges.push({ s: { r: firstRow, c: 0 }, e: { r: firstRow + role.slots - 1, c: 0 } });
        }
      });
    });
  };

  drawTable(daySections.table1 || []);
  addRow(Array(nCols).fill(null));
  drawTable(daySections.table2 || []);

  addRow(Array(nCols).fill(null));
  const footerRow = addRow(['SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU DÉPARTEMENT', ...Array(nDates).fill(null)]);
  merges.push({ s: { r: footerRow, c: 0 }, e: { r: footerRow, c: nCols - 1 } });
  styleRange(footerRow, 0, nCols - 1, { font: { italic: true, sz: 9, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 28 }, ...Array(nDates).fill({ wch: 16 })];
  styleOps.forEach(({ r: rr, c: cc, style }) => {
    const ref = XLSX.utils.encode_cell({ r: rr, c: cc });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, activeDay === 'dimanche' ? 'Dimanche' : 'Vendredi');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


async function svgToPngDataUrl(svgString, width, height, scale = 2) {
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
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Phones: the Planning table has fixed column widths (220px label + 115px
// per date) so it can't reflow to fit a narrow screen — on desktop/tablet
// that's fine, it just scrolls horizontally (overflow-x-auto). On phones
// we instead scale the whole table down to fit, same technique used for
// the mobile Organigramme, so nothing needs to be scrolled to be seen.
//
// The table itself has a `w-full` (width:100%) class. Measuring its
// wrapper's own auto/shrink-to-fit width would create a circular
// reference (wrapper's width depends on the table's content, but the
// table's width depends on the wrapper being 100% of it) — in practice
// this made the browser fall back to a nonsensical ~1,000,000px "natural"
// width. To avoid that entirely, the caller passes the already-known
// natural width (sum of the fixed column widths) as `naturalWidth`, and
// we give the inner wrapper that exact width explicitly — that breaks the
// circularity outright, so both the width AND the resulting height are
// laid out correctly by the browser with no measurement voodoo needed.
// justify-center on the outer wrapper keeps the shrunk table centered.
const ScaleToFitMobile = ({ children, naturalWidth }) => {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [wrapHeight, setWrapHeight] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const compute = () => {
      const isMobile = mq.matches;
      setActive(isMobile);
      const wrapper = wrapperRef.current;
      const inner = innerRef.current;
      if (!isMobile || !wrapper || !inner || !naturalWidth) {
        setScale(1);
        setWrapHeight(null);
        return;
      }
      const available = wrapper.clientWidth;
      const naturalHeight = inner.scrollHeight;
      if (!available) return;
      const next = Math.min(1, (available - 4) / naturalWidth);
      setScale(next);
      setWrapHeight(Math.ceil(naturalHeight * next));
    };
    compute();
    const t = setTimeout(compute, 100);
    const mqListener = () => compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    if (mq.addEventListener) mq.addEventListener('change', mqListener);
    else mq.addListener(mqListener);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
      if (mq.removeEventListener) mq.removeEventListener('change', mqListener);
      else mq.removeListener(mqListener);
    };
  }, [naturalWidth]);

  return (
    <div
      ref={wrapperRef}
      className={active ? 'w-full overflow-hidden flex justify-center' : 'w-full overflow-x-auto'}
      style={active && wrapHeight ? { height: wrapHeight } : undefined}
    >
      <div
        ref={innerRef}
        style={active ? { width: naturalWidth, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'top center' } : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default function Planning() {
  const { canValidate, isAdmin, canManage, isSuperAdmin, user } = useAuth();
  // "Publier" est réservé à Gestionnaire+ (Gestionnaire, Admin, Super Admin)
  // — un Responsable remplit le brouillon mais ne peut pas le rendre visible
  // aux Techniciens lui-même.
  const isGestionnairePlus = ['Super Admin', 'Admin', 'Gestionnaire'].includes(user?.niveau_acces);
  const isTechnicien = user?.niveau_acces === 'Technicien';
  // Les plannings événements ne sont plus un onglet à part : "Planning
  // événement" bascule ce composant sur PlanningEvenementSection (liste +
  // éditeur dédié) sans toucher au rendu du planning équipe habituel.
  const [evenementView, setEvenementView] = useState(false);
  const [techniciens, setTechniciens] = useState([]);
  const [planning, setPlanning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Brouillon/publié : un planning fraîchement créé ou modifié par un
  // Responsable+ reste invisible pour les Techniciens tant qu'un
  // Gestionnaire+ n'a pas cliqué "Publier". `notPublished` capture le cas où
  // le backend a explicitement signalé un brouillon non publié (404
  // "not_published") plutôt qu'une absence totale de planning.
  const [notPublished, setNotPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Enregistrement automatique : 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const autoSaveTimerRef = useRef(null);
  const skipNextAutoSaveRef = useRef(true);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(2026);
  const [activeDay, setActiveDay] = useState('vendredi');
  // Planning scoping for the Responsable role — a Responsable in a
  // poste/section-scoped group (e.g. Planning_cadreurs) can only fill in
  // cells within their scope; enforced for real on the backend, mirrored
  // here so the UI reflects it instead of just erroring on save.
  const [planningScope, setPlanningScope] = useState({ is_restricted: false, full_control: true, scope: [] });
  const [dates, setDates] = useState({ dimanche: [], vendredi: [] });
  const [affectations, setAffectations] = useState({});
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [notes, setNotes] = useState({ dimanche: '', vendredi: '' });
  const [absences, setAbsences] = useState({ dimanche: '', vendredi: '' });
  const [monthAbsences, setMonthAbsences] = useState([]);
  const [editSectionDialog, setEditSectionDialog] = useState(null);
  const [editRoleLabel, setEditRoleLabel] = useState('');

  // Category (section) add/rename
  const [addCategoryDialog, setAddCategoryDialog] = useState(null); // tableKey or null
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryDialog, setEditCategoryDialog] = useState(null); // { tableKey, sectionIdx, day }
  const [editCategoryLabel, setEditCategoryLabel] = useState('');

  // Group/merge roles (e.g. "Caméra 1-6")
  const [groupModeSection, setGroupModeSection] = useState(null); // { tableKey, sectionIdx, day }
  const [selectedForGroup, setSelectedForGroup] = useState([]);

  // Single-cell gray toggle — blockedCells[`${roleKey}_${slotIdx}`][dateIdx] = true
  // grays just that one case, independent of the whole-row `role.blocked` flag.
  const [cellBlockMode, setCellBlockMode] = useState(false);
  const [blockedCells, setBlockedCells] = useState({});

  // Gestionnaire+ voit le planning en lecture simple par défaut ; il faut
  // cliquer "Editer" pour faire apparaître les boutons/champs d'édition
  // (griser, ajouter poste/catégorie, éditer dates, en-tête, absences/notes,
  // panneau d'affectation...). N'affecte jamais la vue Technicien, qui reste
  // toujours en lecture seule.
  const [planningEditMode, setPlanningEditMode] = useState(false);
  const toggleEditMode = () => {
    setPlanningEditMode((v) => {
      const next = !v;
      if (!next) {
        // On quitte le mode édition : referme les sous-modes en cours pour
        // éviter un état incohérent (case grisée en attente, groupement...).
        setCellBlockMode(false);
        setGroupModeSection(null);
        setSelectedForGroup([]);
      }
      return next;
    });
  };

  // Date editing
  const [editDatesDialog, setEditDatesDialog] = useState(false);
  const [editingDates, setEditingDates] = useState([]);
  const [newDate, setNewDate] = useState('');

  // Custom header title/subtitle per day — empty/absent means "use the
  // auto-generated MOIS ANNEE - JOUR / RDV à... text" (unchanged behavior).
  const [titreOverrides, setTitreOverrides] = useState({
    dimanche: { titre: '', sous_titre: '' },
    vendredi: { titre: '', sous_titre: '' },
  });
  const [editHeaderDialog, setEditHeaderDialog] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({ titre: '', sous_titre: '' });

  // Free-text label shown under a specific date (e.g. guest name, "Fête des
  // pères"), keyed by day then by ISO date string.
  const [dateLabels, setDateLabels] = useState({ dimanche: {}, vendredi: {} });
  // Affichage des noms sur la grille : normal / upper / lower / capitalize.
  // Réglable uniquement par Gestionnaire+ en mode édition ; pur CSS
  // text-transform côté affichage, la donnée stockée reste inchangée.
  const [affichageNoms, setAffichageNoms] = useState('normal');
  const [editDateLabelDialog, setEditDateLabelDialog] = useState(null); // ISO date string or null
  const [dateLabelDraft, setDateLabelDraft] = useState('');

  const printRef = useRef(null);

  // Memoized technicien names for performance. Deduped defensively — a
  // fiche could list the same poste in both poste_principal and
  // postes_secondaires (bad legacy data), or the roster could momentarily
  // contain a repeated entry, and neither should ever show a name twice in
  // an assignment dropdown.
  const technicienNames = useMemo(() =>
    Array.from(new Set(techniciens.map(t => t.nom))).sort(),
    [techniciens]
  );

  // Names filtered per poste category (poste_principal or postes_secondaires
  // on the fiche Effectif). Falls back to the full roster for any poste
  // nobody has been tagged with yet, so an incomplete backfill never blocks
  // an assignment — it just means the dropdown isn't narrowed down yet.
  const namesByPoste = useMemo(() => {
    const map = {};
    techniciens.forEach((t) => {
      const postes = new Set([t.poste_principal, ...(t.postes_secondaires || [])].filter(Boolean));
      postes.forEach((p) => {
        if (!map[p]) map[p] = new Set();
        map[p].add(t.nom);
      });
    });
    const sorted = {};
    Object.keys(map).forEach((p) => { sorted[p] = Array.from(map[p]).sort(); });
    return sorted;
  }, [techniciens]);

  const namesForPoste = useCallback((poste) => {
    const list = namesByPoste[poste];
    return (list && list.length > 0) ? list : technicienNames;
  }, [namesByPoste, technicienNames]);

  // Every distinct poste category present in the active day's two tables —
  // used to render exactly the datalists that are actually referenced,
  // rather than one for every possible poste (including custom/renamed roles
  // whose canonPoste() falls back to the label itself).
  const distinctPostesToday = useMemo(() => {
    const daySecs = sections[activeDay] || DEFAULT_SECTIONS[activeDay];
    const set = new Set();
    ['table1', 'table2'].forEach((tableKey) => {
      (daySecs[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => {
          const p = canonPoste(section.name, role.label);
          if (p) set.add(p);
        });
      });
    });
    return Array.from(set);
  }, [sections, activeDay]);

  useEffect(() => {
    axios.get(`${API}/me/planning-scope`)
      .then((res) => setPlanningScope(res.data))
      .catch(() => setPlanningScope({ is_restricted: false, full_control: true, scope: [] }));
  }, []);

  // A cell is editable if the user can validate at all, and — for a scoped
  // Responsable — only within their group's sections/postes. Mirrors the
  // real enforcement on PUT /planning server-side; this just keeps the UI
  // from offering edits that would be rejected on save.
  const canEditPlanningCell = useCallback((sectionName, roleKey) => {
    if (!planningEditMode) return false;
    if (!canValidate()) return false;
    if (!planningScope.is_restricted) return true;
    const scope = planningScope.scope || [];
    if (scope.includes(sectionName)) return true;
    return scope.some((pattern) => pattern && roleKey.includes(pattern));
  }, [planningScope, canValidate, planningEditMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = getCachedTechniciens();
      if (cached) {
        setTechniciens(cached);
      } else {
        const techRes = await axios.get(`${API}/techniciens`);
        setCachedTechniciens(techRes.data);
        setTechniciens(techRes.data);
      }

      try {
        const planningRes = await axios.get(`${API}/planning/${currentYear}/${currentMonth}`);
        setPlanning(planningRes.data);
        setNotPublished(false);
        setDates(planningRes.data.dates || { dimanche: [], vendredi: [] });
        setAffectations(planningRes.data.affectations || {});
        setSections(planningRes.data.sections || DEFAULT_SECTIONS);
        setNotes(planningRes.data.notes || { dimanche: '', vendredi: '' });
        setAbsences(planningRes.data.absences || { dimanche: '', vendredi: '' });
        setBlockedCells(planningRes.data.blocked_cells || {});
        setTitreOverrides(planningRes.data.titre_overrides || {
          dimanche: { titre: '', sous_titre: '' },
          vendredi: { titre: '', sous_titre: '' },
        });
        setDateLabels(planningRes.data.date_labels || { dimanche: {}, vendredi: {} });
        setAffichageNoms(planningRes.data.affichage_noms || 'normal');
      } catch (e) {
        // "not_published" : le planning existe mais reste un brouillon —
        // distingué de "aucun planning" pour afficher le bon message.
        setNotPublished(e.response?.data?.detail === 'not_published');
        const dimanches = getDaysOfMonth(currentYear, currentMonth, 0);
        const vendredis = getDaysOfMonth(currentYear, currentMonth, 5);
        setDates({ dimanche: dimanches, vendredi: vendredis });
        setAffectations({});
        setSections(DEFAULT_SECTIONS);
        setNotes({ dimanche: '', vendredi: '' });
        setAbsences({ dimanche: '', vendredi: '' });
        setBlockedCells({});
        setTitreOverrides({
          dimanche: { titre: '', sous_titre: '' },
          vendredi: { titre: '', sous_titre: '' },
        });
        setDateLabels({ dimanche: {}, vendredi: {} });
        setAffichageNoms('normal');
        setPlanning(null);
      }
      // Un changement de mois recharge des données fraîches — la prochaine
      // modification d'état déclenchée par ce chargement ne doit pas être
      // interprétée comme une action utilisateur par l'autosave.
      skipNextAutoSaveRef.current = true;
      setAutoSaveStatus('idle');
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Gestionnaire+ get a heads-up banner listing any self-declared absences
  // that overlap the month currently on screen, so they can plan around
  // them. Scoped server-side to the user's own branch(es) already.
  useEffect(() => {
    if (!canManage()) {
      setMonthAbsences([]);
      return;
    }
    axios.get(`${API}/absences`, { params: { mois: currentMonth, annee: currentYear } })
      .then((res) => setMonthAbsences(res.data))
      .catch(() => setMonthAbsences([]));
  }, [currentMonth, currentYear, canManage]);

  // Keep isPrinting in sync with the native print dialog so the Absences
  // and Notes columns can both be hidden from the printed output.
  useEffect(() => {
    const onBeforePrint = () => setIsPrinting(true);
    const onAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  const getDaysOfMonth = (year, month, dayOfWeek) => {
    const days = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === dayOfWeek) {
        // Build the date string from local components (never toISOString(),
        // which converts to UTC and can shift the day by one depending on
        // the browser's timezone).
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        days.push(`${y}-${m}-${d}`);
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay() === 0 ? 'Dimanche' : 'Vendredi';
    return `${day} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleAffectationChange = useCallback((roleKey, slotIdx, dateIdx, value) => {
    const key = `${roleKey}_${slotIdx}`;
    setAffectations(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [dateIdx]: value === '__none__' ? '' : value
      }
    }));
  }, []);

  const buildPlanningPayload = useCallback(() => ({
    mois: currentMonth,
    annee: currentYear,
    dates,
    affectations,
    sections,
    notes,
    absences,
    blocked_cells: blockedCells,
    titre_overrides: titreOverrides,
    date_labels: dateLabels,
    affichage_noms: affichageNoms,
  }), [currentMonth, currentYear, dates, affectations, sections, notes, absences, blockedCells, titreOverrides, dateLabels, affichageNoms]);

  const handleSave = async () => {
    setSaving(true);
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    try {
      const data = buildPlanningPayload();
      if (planning?.id) {
        await axios.put(`${API}/planning/${planning.id}`, data);
      } else {
        await axios.post(`${API}/planning`, data);
      }
      toast.success('Planning enregistré');
      setAutoSaveStatus('saved');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
      setAutoSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Enregistrement automatique : dès qu'une donnée éditable change (grille,
  // absences/notes, sections, en-tête, libellés de date...), une sauvegarde
  // se déclenche 1,5s après la dernière frappe — plus besoin de penser à
  // cliquer "Enregistrer" pour que les autres utilisateurs voient la mise à
  // jour. Le premier rendu après un chargement (fetchData) est ignoré via
  // skipNextAutoSaveRef pour ne jamais sauvegarder "pour rien" juste après
  // avoir ouvert la page ou changé de mois.
  useEffect(() => {
    if (!canManage()) return undefined;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return undefined;
    }
    setAutoSaveStatus('pending');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const data = buildPlanningPayload();
        if (planning?.id) {
          await axios.put(`${API}/planning/${planning.id}`, data);
        } else {
          const res = await axios.post(`${API}/planning`, data);
          setPlanning(res.data);
        }
        setAutoSaveStatus('saved');
      } catch (err) {
        setAutoSaveStatus('error');
        toast.error(err.response?.data?.detail || "Échec de l'enregistrement automatique");
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affectations, notes, absences, sections, blockedCells, titreOverrides, dateLabels, affichageNoms]);

  const handlePublish = async () => {
    if (!planning?.id) return;
    setPublishing(true);
    try {
      const res = await axios.put(`${API}/planning/${planning.id}/publish`);
      setPlanning(res.data);
      toast.success('Planning publié — visible pour tous les Techniciens');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPublishing(false);
    }
  };

  // Remplit les cases vides du mois affiché avec ce qui était en place le
  // mois précédent — demande explicite d'un Responsable pour éviter de
  // ressaisir chaque mois. Respecte le même périmètre par groupe qu'une
  // édition manuelle (le backend ne copie que ce que l'utilisateur a le
  // droit d'éditer) ; sauve d'abord le planning courant pour ne pas perdre
  // des saisies en cours, puis appelle l'endpoint dédié.
  const [duplicating, setDuplicating] = useState(false);
  const handleDuplicateLastMonth = async () => {
    if (!planning?.id) {
      toast.error("Enregistrez d'abord ce planning avant de dupliquer le mois précédent.");
      return;
    }
    if (!window.confirm(
      `Remplir les cases vides de ${MOIS_NOMS[currentMonth - 1]} ${currentYear} avec les affectations du mois précédent ?\n\n` +
      `Seules les cases actuellement vides et dans votre périmètre seront complétées — rien n'est écrasé.`
    )) return;
    setDuplicating(true);
    try {
      await handleSave();
      const res = await axios.post(`${API}/planning/${planning.id}/duplicate-last-month`);
      setPlanning(res.data.planning);
      const { filled_count, skipped_out_of_scope } = res.data;
      if (filled_count === 0) {
        toast.info(skipped_out_of_scope > 0
          ? "Aucune case remplie : les cases restantes sont hors de votre périmètre."
          : "Aucune case à remplir — soit tout est déjà rempli, soit le mois précédent n'avait rien à cet endroit.");
      } else {
        toast.success(`${filled_count} case(s) remplie(s) depuis le mois précédent.` + (skipped_out_of_scope > 0 ? ` (${skipped_out_of_scope} hors de votre périmètre, ignorée(s))` : ''));
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la duplication');
    } finally {
      setDuplicating(false);
    }
  };

  // Demande de Nathalie (22/08/2026) : copier rapidement ce qui a été saisi un
  // jour (Dimanche ou Vendredi) vers l'autre jour du même mois, plutôt que de
  // ressaisir deux fois la même équipe quand elle est identique les deux
  // jours. Purement côté frontend (état local uniquement) : la correspondance
  // entre les rôles des deux jours se fait par nom de base (le préfixe "v_"
  // identifie les clés Vendredi, cf. handleResetPlanningVierge plus haut) en
  // lisant les sections REELLES de CE planning (pas DEFAULT_SECTIONS), pour
  // que ça marche même si les catégories ont été renommées/ajoutées. Écrase
  // les cases du jour cible (comportement voulu : "copier" doit remplacer,
  // pas juste compléter) — l'autosave existant se charge d'enregistrer.
  const [copyDaysDialog, setCopyDaysDialog] = useState(false);
  const [copyDaysDirection, setCopyDaysDirection] = useState('dimanche_to_vendredi');

  const handleCopyBetweenDays = () => {
    const fromDay = copyDaysDirection === 'dimanche_to_vendredi' ? 'dimanche' : 'vendredi';
    const toDay = copyDaysDirection === 'dimanche_to_vendredi' ? 'vendredi' : 'dimanche';
    const baseKey = (key, day) => (day === 'vendredi' && key.startsWith('v_')) ? key.slice(2) : key;

    const fromSections = sections[fromDay] || DEFAULT_SECTIONS[fromDay];
    const toSections = sections[toDay] || DEFAULT_SECTIONS[toDay];

    const toRolesByBase = {};
    ['table1', 'table2'].forEach((tableKey) => {
      (toSections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => { toRolesByBase[baseKey(role.key, toDay)] = role; });
      });
    });

    let copiedCount = 0;
    const updated = { ...affectations };
    ['table1', 'table2'].forEach((tableKey) => {
      (fromSections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => {
          const target = toRolesByBase[baseKey(role.key, fromDay)];
          if (!target) return; // pas de rôle équivalent en face — on ignore silencieusement
          const maxSlots = Math.max(role.slots || 1, target.slots || 1);
          for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
            const val = affectations[`${role.key}_${slotIdx}`];
            if (val) {
              updated[`${target.key}_${slotIdx}`] = val;
              copiedCount++;
            }
          }
        });
      });
    });

    setAffectations(updated);
    setCopyDaysDialog(false);
    const fromLabel = fromDay === 'dimanche' ? 'Dimanche' : 'Vendredi';
    const toLabel = toDay === 'dimanche' ? 'Dimanche' : 'Vendredi';
    if (copiedCount === 0) {
      toast.info(`Rien à copier : aucune case remplie côté ${fromLabel}, ou aucun rôle équivalent côté ${toLabel}.`);
    } else {
      toast.success(`${copiedCount} case(s) copiée(s) de ${fromLabel} vers ${toLabel} — enregistrement automatique en cours.`);
    }
  };

  const handleUnpublish = async () => {
    if (!planning?.id) return;
    if (!window.confirm('Repasser ce planning en brouillon ? Il redeviendra invisible pour les Techniciens.')) return;
    setPublishing(true);
    try {
      const res = await axios.put(`${API}/planning/${planning.id}/unpublish`);
      setPlanning(res.data);
      toast.success('Planning repassé en brouillon');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPublishing(false);
    }
  };

  // Wipes just the currently active day (Dimanche or Vendredi) back to its
  // default blank state — sections, affectations, cases grisées, notes,
  // absences, en-tête personnalisé et libellés de date. Dimanche role keys
  // have no prefix and Vendredi keys are all prefixed "v_", so clearing one
  // day's keys never touches the other day's data. This only updates local
  // state — the user still has to click "Enregistrer" to persist it, same
  // as every other edit in this page.
  const handleResetPlanningVierge = () => {
    const dayLabel = activeDay === 'dimanche' ? 'Dimanche' : 'Vendredi';
    if (!window.confirm(
      `Réinitialiser complètement le planning ${dayLabel} de ${MOIS_NOMS[currentMonth - 1]} ${currentYear} ?\n\n` +
      `Toutes les affectations, cases grisées, notes, absences et personnalisations de ce jour seront effacées. ` +
      `L'autre jour (${dayLabel === 'Dimanche' ? 'Vendredi' : 'Dimanche'}) n'est pas concerné.\n\n` +
      `Cliquez ensuite sur "Enregistrer" pour confirmer.`
    )) return;

    const currentDaySections = sections[activeDay] || DEFAULT_SECTIONS[activeDay];
    const keysToClear = new Set();
    ['table1', 'table2'].forEach((tableKey) => {
      (currentDaySections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => keysToClear.add(role.key));
      });
    });

    const stripKeys = (obj) => {
      const updated = { ...obj };
      keysToClear.forEach((key) => {
        for (let slotIdx = 0; slotIdx < 6; slotIdx++) {
          delete updated[`${key}_${slotIdx}`];
        }
      });
      return updated;
    };

    setSections((prev) => ({ ...prev, [activeDay]: DEFAULT_SECTIONS[activeDay] }));
    setAffectations(stripKeys);
    setBlockedCells(stripKeys);
    setNotes((prev) => ({ ...prev, [activeDay]: '' }));
    setAbsences((prev) => ({ ...prev, [activeDay]: '' }));
    setTitreOverrides((prev) => ({ ...prev, [activeDay]: { titre: '', sous_titre: '' } }));
    setDateLabels((prev) => ({ ...prev, [activeDay]: {} }));
    toast.success(`Planning ${dayLabel} vidé — cliquez sur "Enregistrer" pour confirmer`);
  };

  const openEditHeader = () => {
    setHeaderDraft({
      titre: titreOverrides[activeDay]?.titre || '',
      sous_titre: titreOverrides[activeDay]?.sous_titre || '',
    });
    setEditHeaderDialog(true);
  };

  const saveHeaderDraft = () => {
    setTitreOverrides((prev) => ({ ...prev, [activeDay]: { ...headerDraft } }));
    setEditHeaderDialog(false);
    toast.success('En-tête mis à jour — cliquez sur "Enregistrer" pour confirmer');
  };

  const resetHeaderDraft = () => {
    setTitreOverrides((prev) => ({ ...prev, [activeDay]: { titre: '', sous_titre: '' } }));
    setEditHeaderDialog(false);
    toast.success('En-tête réinitialisé — cliquez sur "Enregistrer" pour confirmer');
  };

  const openEditDateLabel = (dateStr) => {
    setDateLabelDraft(dateLabels[activeDay]?.[dateStr] || '');
    setEditDateLabelDialog(dateStr);
  };

  const saveDateLabelDraft = () => {
    setDateLabels((prev) => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], [editDateLabelDialog]: dateLabelDraft },
    }));
    setEditDateLabelDialog(null);
  };

  const clearDateLabelDraft = () => {
    setDateLabels((prev) => {
      const updated = { ...prev[activeDay] };
      delete updated[editDateLabelDialog];
      return { ...prev, [activeDay]: updated };
    });
    setEditDateLabelDialog(null);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => window.print(), 50);
  };

  // Dedicated export engine: builds a standalone SVG from the real planning
  // data (never screenshots the interactive table), so the width is always
  // derived from the computed height — a genuine landscape PNG, not a
  // rotated/stretched/padded capture of the on-screen DOM. See
  // buildPlanningExportSVG / svgToPngDataUrl above.
  const handleExportPng = async () => {
    // Must happen synchronously, before any `await` below, or Safari on iOS
    // silently blocks the fallback tab (see utils/fileDownload.js).
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingPng(true);
    try {
      const { svg, width, height } = buildPlanningExportSVG({
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
        nameCase: affichageNoms,
      });
      const { dataUrl, width: pngW, height: pngH } = await svgToPngDataUrl(svg, width, height, 2);
      if (pngW <= pngH) {
        // Should never happen given the width-from-height calculation above,
        // but log loudly rather than silently ship a portrait result.
        console.warn('Export PNG: résultat non-paysage inattendu', pngW, pngH);
      }
      const moisSlug = (MOIS_NOMS[currentMonth - 1] || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const filename = `planning-${moisSlug}-${currentYear}-${activeDay}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      const msg = downloadStatusMessage(status);
      if (status === 'blocked') toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export PNG");
    } finally {
      setExportingPng(false);
    }
  };

  // Mirrors handleExportPng's structure — same source data, same filename
  // pattern, same download helper — just producing a workbook instead of a
  // PNG. See buildPlanningExportXLSX above.
  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      const blob = buildPlanningExportXLSX({
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
        nameCase: affichageNoms,
      });
      const moisSlug = (MOIS_NOMS[currentMonth - 1] || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const filename = `planning-${moisSlug}-${currentYear}-${activeDay}.xlsx`;
      const status = await downloadOrShareFile(blob, filename, { title: filename });
      let msg;
      if (status === 'blocked') msg = "Impossible d'enregistrer le fichier — réessaie";
      else if (status === 'downloaded') msg = 'Le fichier Excel a été téléchargé';
      else msg = downloadStatusMessage(status);
      if (status === 'blocked') toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportingXlsx(false);
    }
  };


  const handleEditRole = (tableKey, sectionIdx, roleIdx, day) => {
    const role = sections[day][tableKey][sectionIdx].roles[roleIdx];
    setEditRoleLabel(role.label);
    setEditSectionDialog({ tableKey, sectionIdx, roleIdx, day });
  };

  const saveRoleLabel = () => {
    if (!editSectionDialog) return;
    const { tableKey, sectionIdx, roleIdx, day } = editSectionDialog;
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = { ...updated[day][tableKey][sectionIdx] };
      updated[day][tableKey][sectionIdx].roles = [...updated[day][tableKey][sectionIdx].roles];
      updated[day][tableKey][sectionIdx].roles[roleIdx] = {
        ...updated[day][tableKey][sectionIdx].roles[roleIdx],
        label: editRoleLabel
      };
      return updated;
    });
    setEditSectionDialog(null);
    toast.success('Poste renommé');
  };

  // Date editing functions
  const openEditDates = () => {
    setEditingDates([...dates[activeDay]]);
    setNewDate('');
    setEditDatesDialog(true);
  };

  const addDate = () => {
    if (!newDate) return;
    if (editingDates.includes(newDate)) {
      toast.error('Cette date existe déjà');
      return;
    }
    const updated = [...editingDates, newDate].sort();
    setEditingDates(updated);
    setNewDate('');
  };

  const removeDate = (dateToRemove) => {
    setEditingDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const saveDates = () => {
    setDates(prev => ({
      ...prev,
      [activeDay]: editingDates
    }));
    setEditDatesDialog(false);
    toast.success('Dates mises à jour');
  };

  const resetDatesToDefault = () => {
    const dayOfWeek = activeDay === 'dimanche' ? 0 : 5;
    const defaultDates = getDaysOfMonth(currentYear, currentMonth, dayOfWeek);
    setEditingDates(defaultDates);
  };

  const addRole = (tableKey, sectionIdx, day) => {
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = { ...updated[day][tableKey][sectionIdx] };
      updated[day][tableKey][sectionIdx].roles = [
        ...updated[day][tableKey][sectionIdx].roles,
        { key: `custom_${Date.now()}`, label: 'Nouveau poste', slots: 1 }
      ];
      return updated;
    });
  };

  const removeRole = (tableKey, sectionIdx, roleIdx, day) => {
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = { ...updated[day][tableKey][sectionIdx] };
      updated[day][tableKey][sectionIdx].roles = updated[day][tableKey][sectionIdx].roles.filter((_, i) => i !== roleIdx);
      return updated;
    });
  };

  // Mark/unmark a single cell as blocked (grayed-out) — independent of the
  // whole-row toggle above, for the case where only one date/poste needs to
  // be greyed rather than the entire row.
  const toggleCellBlocked = (roleKey, slotIdx, dateIdx) => {
    const key = `${roleKey}_${slotIdx}`;
    setBlockedCells(prev => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: { ...current, [dateIdx]: !current[dateIdx] }
      };
    });
  };

  // Mark/unmark a role as blocked (grayed-out, unavailable) — same visual
  // treatment as Poly 1/2/Gymnase, but toggleable on any poste.
  const toggleBlocked = (tableKey, sectionIdx, roleIdx, day) => {
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = { ...updated[day][tableKey][sectionIdx] };
      const roles = [...updated[day][tableKey][sectionIdx].roles];
      roles[roleIdx] = { ...roles[roleIdx], blocked: !roles[roleIdx].blocked };
      updated[day][tableKey][sectionIdx].roles = roles;
      return updated;
    });
  };

  // Add a brand new category (section) to a table for the active day.
  const openAddCategory = (tableKey) => {
    setNewCategoryName('');
    setAddCategoryDialog(tableKey);
  };

  const saveNewCategory = () => {
    if (!newCategoryName.trim() || !addCategoryDialog) return;
    const tableKey = addCategoryDialog;
    setSections(prev => {
      const day = activeDay;
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [
        ...prev[day][tableKey],
        { name: newCategoryName.trim().toUpperCase(), roles: [] }
      ];
      return updated;
    });
    setAddCategoryDialog(null);
    toast.success('Catégorie ajoutée');
  };

  const removeSection = (tableKey, sectionIdx, day) => {
    if (!window.confirm('Supprimer cette catégorie et tous ses postes ?')) return;
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = prev[day][tableKey].filter((_, i) => i !== sectionIdx);
      return updated;
    });
    toast.success('Catégorie supprimée');
  };

  const handleEditCategory = (tableKey, sectionIdx, day) => {
    setEditCategoryLabel(sections[day][tableKey][sectionIdx].name);
    setEditCategoryDialog({ tableKey, sectionIdx, day });
  };

  const saveCategoryLabel = () => {
    if (!editCategoryDialog) return;
    const { tableKey, sectionIdx, day } = editCategoryDialog;
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = { ...updated[day][tableKey][sectionIdx], name: editCategoryLabel.trim().toUpperCase() || updated[day][tableKey][sectionIdx].name };
      return updated;
    });
    setEditCategoryDialog(null);
    toast.success('Catégorie renommée');
  };

  // Group/merge multiple postes into one shared row (e.g. "Caméra 1-6").
  const toggleGroupMode = (tableKey, sectionIdx, day) => {
    const isSame = groupModeSection
      && groupModeSection.tableKey === tableKey
      && groupModeSection.sectionIdx === sectionIdx
      && groupModeSection.day === day;
    setGroupModeSection(isSame ? null : { tableKey, sectionIdx, day });
    setSelectedForGroup([]);
  };

  const toggleRoleSelectedForGroup = (roleIdx) => {
    setSelectedForGroup(prev =>
      prev.includes(roleIdx) ? prev.filter(i => i !== roleIdx) : [...prev, roleIdx]
    );
  };

  const mergeSelectedRoles = () => {
    if (!groupModeSection || selectedForGroup.length < 2) return;
    const { tableKey, sectionIdx, day } = groupModeSection;
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      const section = { ...updated[day][tableKey][sectionIdx] };
      const roles = [...section.roles];
      const sortedIdx = [...selectedForGroup].sort((a, b) => a - b);
      const selectedRoles = sortedIdx.map(i => roles[i]);
      const mergedLabel = selectedRoles.map(r => r.label).join(' / ');
      const mergedSlots = selectedRoles.reduce((acc, r) => acc + r.slots, 0);
      // mergedFrom keeps the original roles' key/label/slots so "Défusionner"
      // can restore them exactly later — the sub-roles' own affectation keys
      // are left untouched by the merge (see below), so their existing data
      // survives the round trip automatically.
      const mergedRole = {
        key: `grouped_${Date.now()}`,
        label: mergedLabel,
        slots: mergedSlots,
        mergedFrom: selectedRoles.map(r => ({ key: r.key, label: r.label, slots: r.slots })),
      };
      const firstIdx = sortedIdx[0];
      const newRoles = roles.filter((_, i) => !sortedIdx.includes(i));
      newRoles.splice(firstIdx, 0, mergedRole);
      section.roles = newRoles;
      updated[day][tableKey][sectionIdx] = section;
      return updated;
    });
    setGroupModeSection(null);
    setSelectedForGroup([]);
    toast.success('Postes regroupés');
  };

  // Undo a merge: restores the original separate roles in place of the
  // merged one. The sub-roles' original affectation/blocked-cell keys were
  // never touched by the merge, so their pre-merge data reappears as soon as
  // the section references those keys again. Any data typed while the row
  // was merged (stored under the merged role's own key) is folded back into
  // the matching sub-role slot — in the same consecutive-slot order used
  // when merging — so nothing entered in the meantime is silently dropped.
  const splitMergedRole = (tableKey, sectionIdx, roleIdx, day) => {
    const role = sections[day]?.[tableKey]?.[sectionIdx]?.roles?.[roleIdx];
    if (!role || !role.mergedFrom || role.mergedFrom.length === 0) return;
    if (!window.confirm(`Défusionner « ${role.label} » en ${role.mergedFrom.length} postes séparés ?`)) return;

    const mergedKey = role.key;
    const subRoles = role.mergedFrom;
    let globalSlot = 0;
    const slotRanges = subRoles.map((sr) => {
      const range = { key: sr.key, slots: sr.slots, startSlot: globalSlot };
      globalSlot += sr.slots;
      return range;
    });

    const redistribute = (prev) => {
      const updated = { ...prev };
      slotRanges.forEach(({ key, slots, startSlot }) => {
        for (let localSlot = 0; localSlot < slots; localSlot++) {
          const mergedSlotKey = `${mergedKey}_${startSlot + localSlot}`;
          const subKey = `${key}_${localSlot}`;
          const mergedData = updated[mergedSlotKey];
          if (mergedData && Object.values(mergedData).some((v) => v)) {
            updated[subKey] = { ...(updated[subKey] || {}), ...mergedData };
          }
          delete updated[mergedSlotKey];
        }
      });
      return updated;
    };

    setAffectations(redistribute);
    setBlockedCells(redistribute);
    setSections(prev => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      const section = { ...updated[day][tableKey][sectionIdx] };
      const roles = [...section.roles];
      const restoredRoles = subRoles.map((sr) => ({ key: sr.key, label: sr.label, slots: sr.slots }));
      roles.splice(roleIdx, 1, ...restoredRoles);
      section.roles = roles;
      updated[day][tableKey][sectionIdx] = section;
      return updated;
    });
    toast.success('Postes défusionnés — cliquez sur "Enregistrer" pour confirmer');
  };

  const currentDates = dates[activeDay] || [];
  const daySections = sections[activeDay] || DEFAULT_SECTIONS[activeDay];
  const theme = THEME[activeDay];
  const isMembre = user?.niveau_acces === 'Technicien';

  // Panneau latéral "Déjà affectés / Pas encore affectés" pour Gestionnaire+
  // en édition : recalculé en direct à chaque frappe dans la grille, sur
  // l'ensemble du mois (dimanche + vendredi confondus), pas juste le jour
  // actif — pour donner une vue d'ensemble de qui manque encore ce mois-ci.
  const assignedNamesSet = useMemo(() => {
    const found = new Set();
    ['dimanche', 'vendredi'].forEach((day) => {
      const daySecs = sections[day] || DEFAULT_SECTIONS[day];
      [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach((section) => {
        (section.roles || []).forEach((role) => {
          for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
            const raw = affectations[`${role.key}_${slotIdx}`];
            // Certaines valeurs sauvegardées en base sont des dict {"0": "Nom"}
            // plutôt que des tableaux (artefact de sérialisation JS côté
            // ancien code) — on gère les deux formes ici comme côté backend.
            const vals = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
            vals.forEach((value) => {
              if (value && value.trim()) found.add(value.trim().toLowerCase());
            });
          }
        });
      });
    });
    return found;
  }, [affectations, sections]);

  const assignmentRoster = useMemo(() => {
    const assigned = [];
    const notAssigned = [];
    (techniciens || []).forEach((t) => {
      const name = (t.nom || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      let matched = assignedNamesSet.has(key);
      if (!matched) {
        for (const scheduled of assignedNamesSet) {
          if (scheduled.includes(key) || key.includes(scheduled)) { matched = true; break; }
        }
      }
      (matched ? assigned : notAssigned).push(name);
    });
    assigned.sort();
    notAssigned.sort();
    return { assigned, notAssigned };
  }, [techniciens, assignedNamesSet]);

  // Names actually typed into the affectation grid for a given date, across
  // both Vendredi and Dimanche tables — used to detect when someone who
  // declared themselves absent has (accidentally) been scheduled anyway.
  const namesScheduledOnDate = (dateStr) => {
    const found = new Set();
    ['dimanche', 'vendredi'].forEach((day) => {
      const dayDates = dates[day] || [];
      const dateIdx = dayDates.indexOf(dateStr);
      if (dateIdx === -1) return;
      const daySecs = sections[day] || DEFAULT_SECTIONS[day];
      [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach((section) => {
        section.roles.forEach((role) => {
          for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
            const value = affectations[`${role.key}_${slotIdx}`]?.[dateIdx];
            if (value && value.trim()) found.add(value.trim().toLowerCase());
          }
        });
      });
    });
    return found;
  };

  const nameMatches = (scheduledSet, fullName) => {
    const target = fullName.trim().toLowerCase();
    if (!target) return false;
    if (scheduledSet.has(target)) return true;
    for (const scheduled of scheduledSet) {
      if (scheduled.includes(target) || target.includes(scheduled)) return true;
    }
    return false;
  };

  // Only surface an absence in the banner once it actually collides with the
  // grid — i.e. the person is scheduled on a date they said they're
  // unavailable. This re-evaluates on every render, so the banner appears,
  // disappears, and reappears live as cells are edited.
  const conflictingAbsences = monthAbsences.filter((a) => {
    const start = new Date(a.date_debut + 'T00:00:00');
    const end = new Date(a.date_fin + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      if (nameMatches(namesScheduledOnDate(dateStr), a.full_name)) return true;
    }
    return false;
  });

  if (evenementView) {
    return <PlanningEvenementSection onBack={() => setEvenementView(false)} technicienNames={technicienNames} isSuperAdmin={isSuperAdmin} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTable = (tableKey, tableSections) => {
    return (
      <table className="w-full border-collapse text-sm mb-4 print:mb-2" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col className="col-label" style={{ width: '220px' }} />
          {currentDates.map((_, i) => <col key={i} className="col-date" style={{ width: '115px' }} />)}
          {canValidate() && planningEditMode && <col style={{ width: '28px' }} className="print:hidden-col" />}
        </colgroup>
        <thead>
          <tr>
            <th className={`border border-black p-2 text-left font-bold ${theme.band}`}>AFFECTATION</th>
            {currentDates.map((date, idx) => (
              <th key={idx} className={`border border-black p-1 font-bold text-center whitespace-nowrap text-xs sm:text-sm ${theme.band}`}>
                <div className="flex items-center justify-center gap-1">
                  <span>{formatDate(date)}</span>
                  {canManage() && planningEditMode && (
                    <button
                      type="button"
                      className="print:hidden shrink-0 opacity-60 hover:opacity-100"
                      title="Ajouter/modifier un texte sous cette date"
                      onClick={() => openEditDateLabel(date)}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {dateLabels[activeDay]?.[date] && (
                  <div className="font-normal normal-case text-[10px] sm:text-xs whitespace-normal leading-tight mt-0.5">
                    {dateLabels[activeDay][date]}
                  </div>
                )}
              </th>
            ))}
            {canValidate() && planningEditMode && <th className={`border border-black print:hidden ${theme.band}`}></th>}
          </tr>
        </thead>
        <tbody>
          {tableSections.map((section, sectionIdx) => {
            const isGroupModeHere = groupModeSection
              && groupModeSection.tableKey === tableKey
              && groupModeSection.sectionIdx === sectionIdx
              && groupModeSection.day === activeDay;
            return (
            <React.Fragment key={section.name + sectionIdx}>
              {!section.standalone && (
                <tr>
                  <td
                    colSpan={currentDates.length + (canValidate() && planningEditMode && !planningScope.is_restricted ? 2 : 1)}
                    className={`border border-black p-1 font-bold text-center ${theme.band}`}
                  >
                    <span
                      className={canValidate() && planningEditMode && !planningScope.is_restricted ? 'cursor-pointer hover:underline' : ''}
                      onClick={() => canValidate() && planningEditMode && !planningScope.is_restricted && handleEditCategory(tableKey, sectionIdx, activeDay)}
                    >
                      {section.name}
                    </span>
                    {canValidate() && planningEditMode && !planningScope.is_restricted && (
                      <span className="inline-flex items-center gap-1 ml-2 print:hidden align-middle">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          title="Ajouter un poste"
                          onClick={() => addRole(tableKey, sectionIdx, activeDay)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-6 w-6 p-0 ${isGroupModeHere ? 'bg-primary/30' : ''}`}
                          title="Grouper des postes ensemble"
                          onClick={() => toggleGroupMode(tableKey, sectionIdx, activeDay)}
                        >
                          <Combine className="w-3 h-3" />
                        </Button>
                        {isGroupModeHere && selectedForGroup.length >= 2 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 text-xs px-2"
                            onClick={mergeSelectedRoles}
                          >
                            Fusionner ({selectedForGroup.length})
                          </Button>
                        )}
                        {isGroupModeHere && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            title="Annuler le groupement"
                            onClick={() => toggleGroupMode(tableKey, sectionIdx, activeDay)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          title="Supprimer la catégorie"
                          onClick={() => removeSection(tableKey, sectionIdx, activeDay)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              )}
              {section.roles.map((role, roleIdx) => {
                const posteCategory = canonPoste(section.name, role.label);
                const datalistId = `tech-list-${slugPoste(posteCategory)}`;
                return (
                <React.Fragment key={role.key}>
                  {Array.from({ length: role.slots }).map((_, slotIdx) => (
                    <tr key={`${role.key}_${slotIdx}`} className="hover:bg-muted/50">
                      {slotIdx === 0 ? (
                        <td
                          className="border border-black p-2 font-medium bg-white"
                          rowSpan={role.slots}
                        >
                          <div className="flex items-center gap-2">
                            {isGroupModeHere && (
                              <input
                                type="checkbox"
                                className="print:hidden shrink-0"
                                checked={selectedForGroup.includes(roleIdx)}
                                onChange={() => toggleRoleSelectedForGroup(roleIdx)}
                              />
                            )}
                            <span
                              className={!isGroupModeHere && canValidate() && planningEditMode && !planningScope.is_restricted ? 'cursor-pointer hover:underline flex-1' : 'flex-1'}
                              onClick={() => !isGroupModeHere && canValidate() && planningEditMode && !planningScope.is_restricted && handleEditRole(tableKey, sectionIdx, roleIdx, activeDay)}
                            >
                              {role.label}
                            </span>
                          </div>
                        </td>
                      ) : null}
                      {currentDates.map((_, dateIdx) => {
                        const key = `${role.key}_${slotIdx}`;
                        const value = affectations[key]?.[dateIdx] || '';
                        const singleCellBlocked = !!(blockedCells[key]?.[dateIdx]);
                        const cellBlocked = role.blocked || singleCellBlocked;
                        const cellModeActive = cellBlockMode && canValidate() && planningEditMode && !role.blocked;
                        return (
                          <td
                            key={dateIdx}
                            className={`border border-black p-1 ${cellBlocked ? 'bg-gray-300 print:bg-gray-300' : 'bg-white'} ${cellModeActive ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary' : ''}`}
                            onClick={() => cellModeActive && toggleCellBlocked(role.key, slotIdx, dateIdx)}
                          >
                            {cellModeActive ? (
                              <div className="w-full h-7 flex items-center justify-center">
                                {singleCellBlocked ? (
                                  <Ban className="w-3.5 h-3.5 text-amber-600" />
                                ) : (
                                  <span className="text-xs text-muted-foreground/50">{value || '-'}</span>
                                )}
                              </div>
                            ) : (
                              <PlanningCell
                                value={value}
                                blocked={cellBlocked}
                                canEdit={canEditPlanningCell(section.name, role.key)}
                                datalistId={datalistId}
                                nameCase={affichageNoms}
                                onChange={(v) => handleAffectationChange(role.key, slotIdx, dateIdx, v === '' ? '__none__' : v)}
                              />
                            )}
                          </td>
                        );
                      })}
                      {canValidate() && planningEditMode && !planningScope.is_restricted && slotIdx === 0 && (
                        <td className="border border-black p-1 print:hidden" rowSpan={role.slots}>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-6 w-6 p-0 ${role.blocked ? 'text-amber-600' : 'text-muted-foreground'}`}
                              title={role.blocked ? 'Rendre disponible' : 'Griser (marquer indisponible)'}
                              onClick={() => toggleBlocked(tableKey, sectionIdx, roleIdx, activeDay)}
                            >
                              <Ban className="w-3 h-3" />
                            </Button>
                            {role.mergedFrom && role.mergedFrom.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-blue-600"
                                title="Défusionner ces postes"
                                onClick={() => splitMergedRole(tableKey, sectionIdx, roleIdx, activeDay)}
                              >
                                <Split className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              title="Supprimer le poste"
                              onClick={() => removeRole(tableKey, sectionIdx, roleIdx, activeDay)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
                );
              })}
            </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6 print:space-y-0" data-testid="planning-page">
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header - hidden on print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Planning générale
            {canManage() && planning && !planning.is_published && (
              <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 print:hidden">
                Brouillon — invisible pour les Techniciens
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Planification mensuelle des équipes</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-menu-btn" className="flex-1 sm:flex-none">
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Exporter</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint} data-testid="print-btn">
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPng} disabled={exportingPng} data-testid="export-png-btn">
                {exportingPng ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />}
                Enregistrer en PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx} disabled={exportingXlsx} data-testid="export-xlsx-btn">
                {exportingXlsx ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                Enregistrer en Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage() && (
            <Button variant="outline" onClick={() => setEvenementView(true)} data-testid="planning-evenement-btn" className="flex-1 sm:flex-none">
              <PartyPopper className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Planning événement</span>
            </Button>
          )}
          {canValidate() && planningEditMode && !planningScope.is_restricted && (
            <Button
              variant="outline"
              onClick={handleResetPlanningVierge}
              data-testid="reset-planning-btn"
              className="flex-1 sm:flex-none text-destructive hover:text-destructive"
            >
              <Eraser className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Planning vierge</span>
            </Button>
          )}
          {canManage() && planningEditMode && planning?.id && (
            <Button
              variant="outline"
              onClick={handleDuplicateLastMonth}
              disabled={duplicating || saving}
              data-testid="duplicate-last-month-btn"
              className="flex-1 sm:flex-none"
              title="Remplir les cases vides avec le mois précédent"
            >
              {duplicating ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <CopyPlus className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">Dupliquer le mois dernier</span>
            </Button>
          )}
          {canManage() && planningEditMode && planning?.id && (
            <Button
              variant="outline"
              onClick={() => setCopyDaysDialog(true)}
              data-testid="copy-between-days-btn"
              className="flex-1 sm:flex-none"
              title="Copier ce qui est rempli d'un jour vers l'autre (même mois)"
            >
              <ArrowLeftRight className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Copier Dimanche ⇄ Vendredi</span>
            </Button>
          )}
          {canManage() && planningEditMode && (
            <Button onClick={handleSave} disabled={saving} data-testid="save-btn" className="flex-1 sm:flex-none">
              {saving ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Save className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">Enregistrer</span>
            </Button>
          )}
          {canManage() && planningEditMode && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 print:hidden" data-testid="autosave-status">
              {autoSaveStatus === 'saving' && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement...</>)}
              {autoSaveStatus === 'saved' && (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Enregistré automatiquement</>)}
              {autoSaveStatus === 'pending' && (<><Cloud className="w-3.5 h-3.5" /> Modifications en attente...</>)}
              {autoSaveStatus === 'error' && (<span className="text-destructive">Échec de l'enregistrement auto</span>)}
            </span>
          )}
          {isGestionnairePlus && planning?.id && (
            planning.is_published ? (
              <Button
                variant="outline"
                onClick={handleUnpublish}
                disabled={publishing}
                data-testid="unpublish-btn"
                className="flex-1 sm:flex-none"
                title="Repasser en brouillon (invisible pour les Techniciens)"
              >
                {publishing ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <EyeOff className="w-4 h-4 sm:mr-2" />}
                <span className="hidden sm:inline">Dépublier</span>
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={publishing}
                data-testid="publish-btn"
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
                title="Rendre ce planning visible pour tous les Techniciens"
              >
                {publishing ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 sm:mr-2" />}
                <span className="hidden sm:inline">Publier</span>
              </Button>
            )
          )}
          {canManage() && (
            <Button
              variant={planningEditMode ? 'secondary' : 'default'}
              onClick={toggleEditMode}
              data-testid="toggle-edit-mode-btn"
              className="flex-1 sm:flex-none"
            >
              {planningEditMode ? <X className="w-4 h-4 sm:mr-2" /> : <Pencil className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">{planningEditMode ? "Terminer l'édition" : 'Editer'}</span>
            </Button>
          )}
        </div>
      </div>

      {isTechnicien && notPublished && (
        <div className="print:hidden rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex items-start gap-2.5">
          <EyeOff className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900 dark:text-amber-300">
            Le planning de ce mois est en cours de préparation et n'a pas encore été publié — reviens un peu plus tard.
          </p>
        </div>
      )}

      {/* Month Navigation - hidden on print. Membre accounts only ever see
          the current month, so navigation is replaced with a plain label. */}
      <Card className="print:hidden">
        <CardContent className="p-3 sm:p-4">
          {isMembre ? (
            <div className="text-center font-medium text-sm sm:text-base">
              {MOIS_NOMS[currentMonth - 1]} {currentYear}
              <span className="text-muted-foreground text-xs sm:text-sm font-normal ml-2">(mois en cours)</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={currentYear === MIN_YEAR && currentMonth <= MIN_MONTH_IN_MIN_YEAR}
                onClick={() => {
                  if (currentYear === MIN_YEAR && currentMonth <= MIN_MONTH_IN_MIN_YEAR) return;
                  if (currentMonth === 1) {
                    setCurrentMonth(12);
                    setCurrentYear(prev => Math.max(MIN_YEAR, prev - 1));
                  } else {
                    setCurrentMonth(prev => prev - 1);
                  }
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <Select value={String(currentMonth)} onValueChange={(v) => setCurrentMonth(parseInt(v))}>
                  <SelectTrigger className="w-[104px] sm:w-[140px] text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOIS_NOMS.map((nom, idx) => {
                      const monthNum = idx + 1;
                      if (currentYear === MIN_YEAR && monthNum < MIN_MONTH_IN_MIN_YEAR) return null;
                      return <SelectItem key={idx} value={String(monthNum)}>{nom}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>

                <Select
                  value={String(currentYear)}
                  onValueChange={(v) => {
                    const year = parseInt(v);
                    setCurrentYear(year);
                    if (year === MIN_YEAR && currentMonth < MIN_MONTH_IN_MIN_YEAR) {
                      setCurrentMonth(MIN_MONTH_IN_MIN_YEAR);
                    }
                  }}
                >
                  <SelectTrigger className="w-[76px] sm:w-[100px] text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={currentYear === MAX_YEAR && currentMonth >= 12}
                onClick={() => {
                  if (currentYear === MAX_YEAR && currentMonth >= 12) return;
                  if (currentMonth === 12) {
                    setCurrentMonth(1);
                    setCurrentYear(prev => Math.min(MAX_YEAR, prev + 1));
                  } else {
                    setCurrentMonth(prev => prev + 1);
                  }
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Tabs */}
      <Tabs value={activeDay} onValueChange={setActiveDay} className="print:hidden">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vendredi" className={THEME.vendredi.tab}>
            Vendredi
          </TabsTrigger>
          <TabsTrigger value="dimanche" className={THEME.dimanche.tab}>
            Dimanche
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Absence CONFLICT banner for Gestionnaire+ — kept outside printRef so
          it never shows up in print or PNG export. Unlike a static "here's
          who's absent this month" list, this only appears once someone who
          declared themselves unavailable is actually typed into a grid cell
          on a colliding date — so it appears, disappears, and reappears live
          as the affectations are edited. */}
      {canManage() && conflictingAbsences.length > 0 && (
        <div className="print:hidden rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 space-y-2">
          <p className="font-semibold text-sm text-red-800 dark:text-red-400 flex items-center gap-2">
            <CalendarOff className="w-4 h-4" />
            Conflit planning / absence — personne planifiée malgré une absence déclarée
          </p>
          <div className="space-y-1">
            {conflictingAbsences.map((a) => (
              <p key={a.id} className="text-sm text-red-900 dark:text-red-300">
                <span className="font-medium">{a.full_name}</span> indisponible du{' '}
                {new Date(a.date_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                {' '}au{' '}
                {new Date(a.date_fin + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                {' — '}{a.raison}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Printable / exportable planning area + panneau latéral d'affectation
          pour Gestionnaire+. Le panneau est en dehors de printRef (jamais
          exporté/imprimé) et se recalcule en direct pendant l'édition. */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full">
      <div ref={printRef} className="bg-white text-black p-2 sm:p-4 print:p-0">
        <div className={`text-center font-bold text-base sm:text-xl mb-1 ${theme.title}`}>
          {titreOverrides[activeDay]?.titre
            || `${MOIS_NOMS[currentMonth - 1].toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`}
        </div>
        <div className={`text-center font-semibold text-xs sm:text-sm py-1 mb-3 ${theme.subtitle}`}>
          {titreOverrides[activeDay]?.sous_titre
            || (activeDay === 'dimanche'
              ? 'RDV à partir de 8h00 en salle 114'
              : 'RDV à partir de 18h30 en salle 114')}
        </div>
        {canManage() && planningEditMode && !planningScope.is_restricted && (
          <div className="flex justify-center mb-2 print:hidden">
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={openEditHeader}>
              <Settings className="w-3 h-3 mr-1" /> Modifier l'en-tête
            </Button>
          </div>
        )}

        {isGestionnairePlus && planningEditMode && (
          <div className="flex justify-end items-center gap-2 mb-2 print:hidden">
            <span className="text-xs text-muted-foreground hidden sm:inline">Affichage des noms</span>
            <Select value={affichageNoms} onValueChange={setAffichageNoms}>
              <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="affichage-noms-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="upper">MAJUSCULE</SelectItem>
                <SelectItem value="lower">minuscule</SelectItem>
                <SelectItem value="capitalize">Première lettre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {canValidate() && planningEditMode && !planningScope.is_restricted && (
          <div className="flex justify-end items-center gap-2 mb-2 print:hidden">
            {cellBlockMode && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Cliquez sur une case pour la griser / dégriser
              </span>
            )}
            <Button
              variant={cellBlockMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCellBlockMode((v) => !v)}
            >
              <Ban className="w-4 h-4 mr-2" />
              {cellBlockMode ? 'Terminer' : 'Griser une case'}
            </Button>
            <Button variant="outline" size="sm" onClick={openEditDates}>
              <Settings className="w-4 h-4 mr-2" />
              Éditer dates
            </Button>
          </div>
        )}

        <Card className="print:shadow-none print:border-0 bg-white text-black">
          <CardContent className="p-0">
            {/* Sum of the fixed colgroup widths in renderTable (220px label
                + 115px per date column + 28px validate column) — passed in
                directly rather than measured, since measuring a `w-full`
                table's own wrapper creates a circular width reference. */}
            <ScaleToFitMobile
              key={`t1-${activeDay}-${currentDates.length}`}
              naturalWidth={220 + currentDates.length * 115 + (canValidate() && planningEditMode ? 28 : 0) + 4}
            >
              {renderTable('table1', daySections.table1)}
            </ScaleToFitMobile>
            {canValidate() && planningEditMode && !planningScope.is_restricted && (
              <div className="flex justify-end px-2 pb-3 print:hidden">
                <Button size="sm" variant="outline" onClick={() => openAddCategory('table1')}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Ajouter catégorie
                </Button>
              </div>
            )}
            <ScaleToFitMobile
              key={`t2-${activeDay}-${currentDates.length}`}
              naturalWidth={220 + currentDates.length * 115 + (canValidate() && planningEditMode ? 28 : 0) + 4}
            >
              {renderTable('table2', daySections.table2)}
            </ScaleToFitMobile>
            {canValidate() && planningEditMode && !planningScope.is_restricted && (
              <div className="flex justify-end px-2 pb-3 print:hidden">
                <Button size="sm" variant="outline" onClick={() => openAddCategory('table2')}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Ajouter catégorie
                </Button>
              </div>
            )}

            {/* One datalist per poste category actually used today, each
                pre-filtered to the people qualified for it — plus the
                unfiltered "tech-list" as a safety-net fallback id. */}
            {distinctPostesToday.map((poste) => (
              <datalist key={poste} id={`tech-list-${slugPoste(poste)}`}>
                {namesForPoste(poste).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ))}
            <datalist id="tech-list">
              {technicienNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-2 italic font-semibold">
          SOUS RÉSERVE DE CHANGEMENTS ÉVENTUELS FAITS PAR LE RESPONSABLE DU DÉPARTEMENT
        </p>
      </div>

      {/* Absences / Notes — deliberately kept outside printRef so the print
          and PNG export never need any hide-this-column logic at all: these
          fields simply aren't part of the exported area. Gestionnaire+ only,
          et seulement en mode édition. */}
      {canManage() && planningEditMode && (
        <Card className="print:hidden">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Absences de l'équipe</label>
              <textarea
                className="w-full min-h-[120px] text-sm border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring p-2 resize-y"
                value={absences[activeDay] || ''}
                onChange={(e) => setAbsences(prev => ({ ...prev, [activeDay]: e.target.value }))}
                placeholder="Absences de l'équipe..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Notes / informations pertinentes</label>
              <textarea
                className="w-full min-h-[120px] text-sm border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring p-2 resize-y"
                value={notes[activeDay] || ''}
                onChange={(e) => setNotes(prev => ({ ...prev, [activeDay]: e.target.value }))}
                placeholder="Notes / informations pertinentes..."
              />
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {canManage() && planningEditMode && (
        <aside className="w-full lg:w-72 shrink-0 print:hidden lg:sticky lg:top-4">
          <Card>
            <CardContent className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                  Déjà affectés ce mois-ci ({assignmentRoster.assigned.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {assignmentRoster.assigned.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Personne pour l'instant.</p>
                  ) : assignmentRoster.assigned.map((n) => (
                    <Badge key={n} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{n}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                  Pas encore affectés ({assignmentRoster.notAssigned.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {assignmentRoster.notAssigned.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Tout le monde est affecté.</p>
                  ) : assignmentRoster.notAssigned.map((n) => (
                    <Badge key={n} variant="outline">{n}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      )}
      </div>

      {/* Edit Header (title/subtitle) Dialog */}
      <Dialog open={editHeaderDialog} onOpenChange={(open) => !open && setEditHeaderDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'en-tête ({activeDay === 'dimanche' ? 'Dimanche' : 'Vendredi'})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titre principal</label>
              <Input
                value={headerDraft.titre}
                onChange={(e) => setHeaderDraft((prev) => ({ ...prev, titre: e.target.value }))}
                placeholder={`${MOIS_NOMS[currentMonth - 1].toUpperCase()} ${currentYear} - ${activeDay.toUpperCase()}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sous-titre</label>
              <Input
                value={headerDraft.sous_titre}
                onChange={(e) => setHeaderDraft((prev) => ({ ...prev, sous_titre: e.target.value }))}
                placeholder={activeDay === 'dimanche' ? 'RDV à partir de 8h00 en salle 114' : 'RDV à partir de 18h30 en salle 114'}
              />
            </div>
            <p className="text-xs text-muted-foreground">Laissez vide pour revenir au texte généré automatiquement.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={resetHeaderDraft}>
                Réinitialiser
              </Button>
              <Button className="flex-1" onClick={saveHeaderDraft}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Date Label Dialog */}
      <Dialog open={!!editDateLabelDialog} onOpenChange={(open) => !open && setEditDateLabelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Texte sous la date{editDateLabelDialog ? ` (${formatDate(editDateLabelDialog)})` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={dateLabelDraft}
              onChange={(e) => setDateLabelDraft(e.target.value)}
              placeholder="Ex : Invité : Jonathan Stockstill, ou Fête des pères"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={clearDateLabelDraft}>
                Effacer
              </Button>
              <Button className="flex-1" onClick={saveDateLabelDraft}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editSectionDialog} onOpenChange={() => setEditSectionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le poste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editRoleLabel}
              onChange={(e) => setEditRoleLabel(e.target.value)}
              placeholder="Nom du poste"
            />
            <Button onClick={saveRoleLabel} className="w-full">
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={!!addCategoryDialog} onOpenChange={(open) => !open && setAddCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ex: PHOTOGRAPHES"
              onKeyDown={(e) => e.key === 'Enter' && saveNewCategory()}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAddCategoryDialog(null)}>
                Annuler
              </Button>
              <Button onClick={saveNewCategory} className="flex-1">
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editCategoryDialog} onOpenChange={(open) => !open && setEditCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editCategoryLabel}
              onChange={(e) => setEditCategoryLabel(e.target.value)}
              placeholder="Nom de la catégorie"
              onKeyDown={(e) => e.key === 'Enter' && saveCategoryLabel()}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditCategoryDialog(null)}>
                Annuler
              </Button>
              <Button onClick={saveCategoryLabel} className="flex-1">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copier Dimanche <-> Vendredi (demande Nathalie 22/08/2026) */}
      <Dialog open={copyDaysDialog} onOpenChange={setCopyDaysDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" />
              Copier entre Dimanche et Vendredi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copie les cases remplies d'un jour vers les rôles équivalents de l'autre jour, pour ce même mois ({MOIS_NOMS[currentMonth - 1]} {currentYear}). Les cases déjà remplies côté destination seront remplacées.
            </p>
            <Select value={copyDaysDirection} onValueChange={setCopyDaysDirection}>
              <SelectTrigger data-testid="copy-days-direction-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dimanche_to_vendredi">Dimanche → Vendredi</SelectItem>
                <SelectItem value="vendredi_to_dimanche">Vendredi → Dimanche</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCopyDaysDialog(false)}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={handleCopyBetweenDays} data-testid="copy-days-confirm-btn">
                Copier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dates Dialog */}
      <Dialog open={editDatesDialog} onOpenChange={setEditDatesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Éditer les dates - {activeDay === 'dimanche' ? 'Dimanches' : 'Vendredis'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1"
              />
              <Button onClick={addDate} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            <div className="border rounded-lg p-2 max-h-[250px] overflow-y-auto space-y-1">
              {editingDates.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Aucune date. Ajoutez-en ou réinitialisez.
                </p>
              ) : (
                editingDates.map((date) => (
                  <div
                    key={date}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded"
                  >
                    <span className="font-medium">
                      {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => removeDate(date)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetDatesToDefault}
                className="flex-1"
              >
                Réinitialiser
              </Button>
              <Button onClick={saveDates} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
