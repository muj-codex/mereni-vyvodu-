import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseGrid,
  parseText,
  parseEnergis,
  timeOffset,
  importMetadata,
  type Grid,
} from '../src/series/energis';
import { firstReading, blankEntry, nextReading } from '../src/series/model';
const grid: Grid = [
  ['Agregace 1/4; datum 21.10.2026'],
  ['UZEL', 'Popis uzlu', 'Jednotka', '21.10.2026 10:45-00', '21.10.2026 11:00-15', 'SUMA'],
  ['21208020', 'A', 'kW', 400, 540, 940],
  ['21208194', 'B', 'kW', 400, 416, 816],
  ['21208142', 'C', 'kW', 500, 528, 1028],
];
const nodes = new Set(['21208020', '21208194', '21208142']);
const m = firstReading(
  {
    ...blankEntry(),
    location: 'TS',
    placement: '11P',
    serial: '123',
    node: '21208142',
    date: '2026-10-21',
    time: '08:37',
    value: '100',
  },
  'b',
);
describe('Energis společný parser', () => {
  it('syntetická referenční data 940/816/1028 bez skryté konverze kW', () => {
    expect(parseGrid(grid, nodes).map((r) => r.sum)).toEqual([940, 816, 1028]);
    expect(parseGrid(grid, nodes)[0]).toMatchObject({
      from: '2026-10-21T10:45',
      to: '2026-10-21T11:15',
      unit: 'kW',
    });
  });
  it('XLSX a TXT používají stejný výsledek', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Export').addRows(grid);
    const bytes = await wb.xlsx.writeBuffer();
    const xlsx = {
      name: 'export.xlsx',
      size: bytes.byteLength,
      arrayBuffer: async () => bytes,
    } as File;
    const text = grid.map((r) => r.join('\t')).join('\n');
    const txt = {
      name: 'export.txt',
      size: text.length,
      arrayBuffer: async () => new TextEncoder().encode(text).buffer,
    } as File;
    expect(await parseEnergis(xlsx, [m.meter])).toEqual(await parseEnergis(txt, [m.meter]));
    expect((await parseEnergis(xlsx, [m.meter]))[0].sum).toBe(1028);
  });
  it('posunuté řádky, libovolné sloupce a větší počet intervalů', () => {
    const many: Grid = [
      ['datum 21.10.2026'],
      [],
      [],
      [
        'UZEL',
        'Popis',
        ...Array.from({ length: 100 }, (_, i) => {
          const t = new Date(Date.UTC(2026, 9, 21, 0, i * 15));
          const end = new Date(+t + 15 * 60000);
          return `${t.toISOString().slice(0, 10)} ${t.toISOString().slice(11, 16)}-${end.toISOString().slice(11, 16)}`;
        }),
      ],
      ['21208142', 'C', ...Array(100).fill(1)],
    ];
    expect(parseGrid(many, new Set(['21208142']))[0].sum).toBe(100);
    expect(parseGrid([[], [], ...grid], nodes)).toEqual(parseGrid(grid, nodes));
  });
  it('zpracuje pouze vybrané UZLY z velkého exportu', () => {
    const large = [
      ...grid,
      ...Array.from({ length: 1000 }, (_, i) => [String(i), 'x', 'kW', 'bad', 'bad', 'bad']),
    ];
    expect(parseGrid(large, new Set(['21208142']))).toHaveLength(1);
    expect(parseGrid(large, new Set(['21208142']))[0].sum).toBe(1028);
  });
  it('nenalezený a duplicitní UZEL; bez UZLU žádné přiřazení', () => {
    expect(parseGrid(grid, new Set(['999']))[0].issue).toContain('nenalezen');
    expect(parseGrid([...grid, grid[2]], nodes)[0].issue).toContain('Duplicitní');
    expect(parseGrid(grid, new Set())).toEqual([]);
  });
  it('SUMA mismatch, neplatné hodnoty a nejednoznačné intervaly blokují automatické přiřazení', () => {
    const changed = structuredClone(grid);
    changed[2][5] = 999;
    expect(parseGrid(changed, nodes)[0].issue).toContain('SUMA');
    changed[2][3] = 'NaN';
    expect(parseGrid(changed, nodes)[0].sum).toBeUndefined();
    expect(() => parseGrid([['neplatné']], nodes)).toThrow();
    expect(() => parseText('"broken')).toThrow();
  });
  it('půlnoc a hodinové / 2/4 / 3/4 / 4/4 intervaly', () => {
    for (const [label, end] of [
      ['23:45-00', '2026-10-22T00:00'],
      ['10:00-30', '2026-10-21T10:30'],
      ['10:00-45', '2026-10-21T10:45'],
      ['10:00-11:00', '2026-10-21T11:00'],
    ]) {
      const g: Grid = [['Datum 21.10.2026'], ['UZEL', label], ['1', 5]];
      expect(parseGrid(g, new Set(['1']))[0].to).toBe(end);
    }
    const g: Grid = [['Agregace 2/4 21.10.2026'], ['UZEL', '10:00'], ['1', 5]];
    expect(parseGrid(g, new Set(['1']))[0].to).toBe('2026-10-21T10:30');
  });
  it('denní, měsíční a roční agregace z explicitních metadat', () => {
    for (const [kind, to] of [
      ['denní', '2026-10-22T00:00'],
      ['měsíční', '2026-11-21T00:00'],
      ['roční', '2027-10-21T00:00'],
    ])
      expect(parseGrid([[kind], ['UZEL', '21.10.2026'], ['1', 5]], new Set(['1']))[0].to).toBe(to);
  });
  it('časový posun ± min E, metadata i ruční přepsání sumy', () => {
    const r = parseGrid(grid, new Set(['21208142']))[0];
    const meta = importMetadata(r, 'data.txt', 'previous', '2026-10-21T11:22')!;
    expect(timeOffset(meta, '2026-10-21', '11:22')).toBe('-7 min E');
    expect(timeOffset(meta, '2026-10-21', '11:07')).toBe('+8 min E');
    expect(meta.offsetMinutes).toBe(-7);
    const next = nextReading(m.meter, m.reading, {
      date: '2026-10-22',
      time: '09:00',
      value: '1200',
      energis: '999',
      active: true,
    });
    expect(next.energis).toBe(999);
  });
  it('oddělená metadata Uzel / Měřák a data dle názvu měřáku', () => {
    const meta: Grid = [
      ['21.10.2026'],
      ['Uzel', '21208142', '21208020'],
      ['Měřák', 'M1', 'M2'],
      ['Popis uzlu', '11P', '12P'],
      ['Jednotka', 'kW', 'kW'],
      ['Data'],
      ['Čas', '10:45-00', '11:00-15'],
      ['M1', 500, 528],
      ['M2', 400, 540],
    ];
    const result = parseGrid(meta, nodes);
    expect(result.find((r) => r.node === '21208142')?.sum).toBe(1028);
    expect(result.find((r) => r.node === '21208020')?.sum).toBe(940);
  });
});
it('oddělená tabulka metadat a data jsou spojena podle Měřáku, nikoliv pořadí', () => {
  const rows: Grid = [
    ['21.10.2026'],
    ['UZEL', 'Měřák', 'Popis uzlu', 'Jednotka'],
    ['21208142', 'M1', '11P', 'kW'],
    ['21208020', 'M2', '12P', 'kW'],
    ['Data'],
    ['Čas', '10:45-00', '11:00-15'],
    ['M2', 400, 540],
    ['M1', 500, 528],
  ];
  const parsed = parseGrid(rows, nodes);
  expect(parsed.find((r) => r.node === '21208142')).toMatchObject({
    sum: 1028,
    description: '11P',
    unit: 'kW',
  });
});
it('půlnoc posune datum i u časových štítků bez opakovaného data', () => {
  expect(
    parseGrid([['21.10.2026'], ['UZEL', '23:45-00', '00:00-15'], ['1', 1, 2]], new Set(['1']))[0],
  ).toMatchObject({ sum: 3, from: '2026-10-21T23:45', to: '2026-10-22T00:15' });
});
