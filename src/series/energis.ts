import { numberValue, timestamp, type Meter, type EnergisMeta } from './model';
export type Grid = (string | number | null)[][];
const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
const nodeHeader = (v: unknown) => /^(uzel|cislo uzlu|id uzlu)$/.test(norm(v));
const sumHeader = (v: unknown) => /^(suma|sum|soucet|celkem)(\s|$)/.test(norm(v));
export interface Imported {
  node: string;
  description: string;
  from: string;
  to: string;
  unit: string;
  sum?: number;
  issue?: string;
}
function dateToken(text: string): string | undefined {
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(text);
  if (iso) return iso[1];
  const cz = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text);
  if (cz) return `${cz[3]}-${cz[2].padStart(2, '0')}-${cz[1].padStart(2, '0')}`;
}
function nextDate(date: string, days = 1) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// End boundaries are explicit in labels; aggregation metadata is used only when unambiguous.
function period(
  label: string,
  fallback: string | undefined,
  aggregation: string,
): { from: string; to: string } | undefined {
  const date = dateToken(label) ?? fallback;
  if (!date) return;
  const range = /(\d{1,2}):(\d{2})\s*[-–]\s*(?:(\d{1,2}):)?(\d{2})/.exec(label);
  if (range) {
    const fromTime = `${range[1].padStart(2, '0')}:${range[2]}`;
    const start = timestamp(date, fromTime);
    const endHour =
      range[3] !== undefined ? +range[3] : +range[1] + (+range[4] <= +range[2] ? 1 : 0);
    const endMinute = +range[4];
    if (endHour > 24 || endMinute > 59 || (endHour === 24 && endMinute !== 0))
      throw Error('Neplatná hranice intervalu Energis.');
    let to = timestamp(
      endHour === 24 ? nextDate(date) : date,
      `${String(endHour % 24).padStart(2, '0')}:${range[4]}`,
    );
    if (to <= start)
      to = timestamp(nextDate(date), `${String(endHour % 24).padStart(2, '0')}:${range[4]}`);
    return { from: start, to };
  }
  const t = /(\d{1,2}):(\d{2})/.exec(label);
  if (t) {
    const from = timestamp(date, `${t[1].padStart(2, '0')}:${t[2]}`);
    const quarter = /([1-4])\s*\/\s*4/.exec(aggregation);
    const mins = quarter ? +quarter[1] * 15 : /hodin/.test(aggregation) ? 60 : undefined;
    if (!mins) return;
    return { from, to: new Date(Date.parse(from + 'Z') + mins * 60000).toISOString().slice(0, 16) };
  }
  if (dateToken(label) && /denni/.test(aggregation))
    return { from: timestamp(date, '00:00'), to: timestamp(nextDate(date), '00:00') };
  if (dateToken(label) && /mesicni|rocni/.test(aggregation)) {
    const d = new Date(`${date}T00:00:00Z`);
    if (/mesicni/.test(aggregation)) d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return { from: timestamp(date, '00:00'), to: timestamp(d.toISOString().slice(0, 10), '00:00') };
  }
}
export function parseText(text: string): Grid {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = clean.includes('\t') ? '\t' : clean.includes(';') ? ';' : ',';
  const rows: Grid = [];
  let row: (string | number | null)[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (quoted && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === '\n')) {
      row.push(cell.replace(/\r$/, ''));
      cell = '';
      if (c === '\n') {
        rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw Error('Neukončené uvozovky v TXT/CSV.');
  row.push(cell.replace(/\r$/, ''));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseGrid(grid: Grid, selectedNodes: Set<string>): Imported[] {
  const allText = grid
    .flat()
    .map((v) => String(v ?? ''))
    .join(' ');
  const aggregation = norm(allText);
  const fallback = dateToken(allText);
  const headerIndex = grid.findIndex((row) => row.some(nodeHeader));
  if (headerIndex < 0) throw Error('V exportu nebyla nalezena hlavička UZEL.');
  const nodeCol = grid[headerIndex].findIndex(nodeHeader);
  const timeIndex = grid.findIndex((row) =>
    row.some((c) => /^(cas|datum a cas|datum)$/.test(norm(c))),
  );
  const header = timeIndex >= 0 ? grid[timeIndex] : grid[headerIndex];
  let currentDate = fallback;
  let lastFrom = '';
  const periods = header.map((c) => {
    const text = String(c ?? '');
    const explicitDate = dateToken(text);
    if (explicitDate) currentDate = explicitDate;
    let parsed = period(text, currentDate, aggregation);
    if (parsed && !explicitDate && lastFrom && parsed.from < lastFrom && currentDate) {
      currentDate = nextDate(currentDate);
      parsed = period(text, currentDate, aggregation);
    }
    if (parsed) lastFrom = parsed.from;
    return parsed;
  });
  const sumCol = header.findIndex(sumHeader);
  const descCol = grid[headerIndex].findIndex((c) => /popis|umisteni/.test(norm(c)));
  const unitCol = grid[headerIndex].findIndex((c) => /jednotk/.test(norm(c)));
  const result: Imported[] = [];
  function collect(node: string, values: (string | number | null)[], description = '', unit = '') {
    if (!selectedNodes.has(node)) return;
    const p = periods.filter((x): x is { from: string; to: string } => !!x);
    const from = p[0]?.from ?? '',
      to = p.at(-1)?.to ?? '';
    const out: Imported = { node, description, unit, from, to };
    if (!p.length) {
      out.issue = 'Nelze jednoznačně určit interval Energisu.';
      result.push(out);
      return;
    }
    if (p.some((v, i) => i > 0 && p[i - 1].to !== v.from)) {
      out.issue = 'Intervaly Energisu nejsou souvislé nebo se překrývají.';
      result.push(out);
      return;
    }
    try {
      let sum = 0;
      periods.forEach((p, i) => {
        if (p) sum += numberValue(String(values[i] ?? ''));
      });
      if (!Number.isFinite(sum)) throw Error('Součet je příliš velký.');
      if (sumCol >= 0 && String(values[sumCol] ?? '').trim()) {
        const total = numberValue(String(values[sumCol]));
        if (Math.abs(total - sum) > 1e-7 * Math.max(1, total, sum))
          throw Error('SUMA nesouhlasí se součtem intervalů.');
        sum = total;
      }
      out.sum = sum;
    } catch (e) {
      out.issue = (e as Error).message;
    }
    result.push(out);
  }
  const meterCol = grid[headerIndex].findIndex((c) => /^merak$/.test(norm(c)));
  // Separate metadata table and data section are joined by UZEL or Měřák, never row position.
  if (timeIndex > headerIndex && meterCol >= 0) {
    const dataRows = grid.slice(timeIndex + 1);
    for (const meta of grid.slice(headerIndex + 1, timeIndex)) {
      const node = String(meta[nodeCol] ?? '').trim();
      if (!selectedNodes.has(node)) continue;
      const key = String(meta[meterCol] ?? '').trim();
      const rows = dataRows.filter((r) =>
        r
          .slice(0, Math.max(1, periods.findIndex(Boolean)))
          .some((v) => String(v ?? '').trim() === node || (key && String(v ?? '').trim() === key)),
      );
      if (rows.length === 1)
        collect(node, rows[0], String(meta[descCol] ?? ''), String(meta[unitCol] ?? ''));
      else if (rows.length > 1)
        result.push({
          node,
          from: '',
          to: '',
          description: '',
          unit: '',
          issue: 'Duplicitní UZEL / Měřák v importu.',
        });
    }
  } else {
    // Row-oriented exports: UZEL, description, unit, interval columns.
    for (let i = headerIndex + 1; i < grid.length; i++) {
      const row = grid[i];
      const node = String(row[nodeCol] ?? '').trim();
      if (/^\d+$/.test(node))
        collect(node, row, String(row[descCol] ?? ''), String(row[unitCol] ?? ''));
    }
  }
  // Metadata-oriented exports: Uzel row identifies each data row through Měřák.
  if (timeIndex > headerIndex) {
    const meterIndex = grid.findIndex((row) => row.some((c) => /^merak$/.test(norm(c))));
    const nodeRow = grid[headerIndex];
    const dataRows = grid.slice(timeIndex + 1);
    for (let c = nodeCol + 1; c < nodeRow.length; c++) {
      const node = String(nodeRow[c] ?? '').trim();
      if (!selectedNodes.has(node)) continue;
      const key = meterIndex >= 0 ? String(grid[meterIndex][c] ?? '').trim() : '';
      const rows = dataRows.filter((r) =>
        r
          .slice(0, Math.max(1, periods.findIndex(Boolean)))
          .some((v) => String(v ?? '').trim() === node || (key && String(v ?? '').trim() === key)),
      );
      const descRow = grid.find((r) => r.some((v) => /popis uzlu/.test(norm(v))));
      const unitRow = grid.find((r) => r.some((v) => /^jednotka$/.test(norm(v))));
      if (rows.length === 1)
        collect(node, rows[0], String(descRow?.[c] ?? ''), String(unitRow?.[c] ?? ''));
      else if (rows.length > 1)
        result.push({
          node,
          from: '',
          to: '',
          description: '',
          unit: '',
          issue: 'Duplicitní UZEL / Měřák v importu.',
        });
    }
  }
  const grouped = new Map<string, Imported[]>();
  for (const r of result) grouped.set(r.node, [...(grouped.get(r.node) ?? []), r]);
  return [...selectedNodes].map((node) => {
    const rows = grouped.get(node) ?? [];
    if (!rows.length)
      return {
        node,
        from: '',
        to: '',
        unit: '',
        description: '',
        issue: 'UZEL v importu nenalezen',
      };
    if (rows.length > 1)
      return { ...rows[0], sum: undefined, issue: 'Duplicitní UZEL v importu – ruční kontrola.' };
    return rows[0];
  });
}
export async function parseEnergis(file: File, meters: Meter[]): Promise<Imported[]> {
  if (file.size > 30 * 1024 * 1024) throw Error('Soubor je příliš velký (maximum 30 MB).');
  const nodes = new Set(meters.map((m) => m.node).filter(Boolean));
  if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheets = book.worksheets
      .map((s) => {
        const grid: Grid = [];
        s.eachRow({ includeEmpty: true }, (row) => {
          const values: (string | number | null)[] = [];
          row.eachCell({ includeEmpty: true }, (c, i) => {
            const v = c.value;
            values[i - 1] =
              typeof v === 'number' ? v : v instanceof Date ? v.toISOString().slice(0, 16) : c.text;
          });
          grid.push(values);
        });
        return grid;
      })
      .filter((g) => g.some((r) => r.some(nodeHeader)));
    if (sheets.length !== 1) throw Error('Export musí obsahovat jeden jednoznačný list s UZLY.');
    return parseGrid(sheets[0], nodes);
  }
  if (!/\.(txt|csv|tsv)$/i.test(file.name)) throw Error('Vyberte XLSX nebo TXT/TSV/CSV.');
  const bytes = await file.arrayBuffer();
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (text.includes('\uFFFD')) text = new TextDecoder('windows-1250').decode(bytes);
  return parseGrid(parseText(text), nodes);
}
export function importMetadata(
  r: Imported,
  file: string,
  boundary: 'previous' | 'next',
  reading: string,
): EnergisMeta | undefined {
  if (r.issue || r.sum === undefined) return;
  return {
    file,
    node: r.node,
    from: r.from,
    to: r.to,
    unit: r.unit,
    sum: r.sum,
    boundary,
    offsetMinutes: reading
      ? Math.round((Date.parse(r.to) - Date.parse(reading)) / 60000)
      : undefined,
  };
}
export function timeOffset(meta: EnergisMeta | undefined, date: string, time: string) {
  if (!meta || !date || !time) return '';
  const n = Math.round((Date.parse(meta.to) - Date.parse(timestamp(date, time))) / 60000);
  return `${n >= 0 ? '+' : ''}${n} min E`;
}
