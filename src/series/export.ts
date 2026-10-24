import { intervalValues, type SeriesData, type Meter } from './model';
import { readingTimeOffset } from './energisDisplay';
export function exportRows(meters: Meter[], data: SeriesData) {
  const rows: (string | number)[][] = [
    [
      'TS/R',
      'Pole / umístění',
      'Číslo elektroměru',
      'UZEL',
      'Předchozí datum/čas',
      'Předchozí stav',
      'Nové datum/čas',
      'Nový stav',
      'Rozdíl elektroměru',
      'SUMA ENERGIS [kWh]',
      'Rozdíl kWh',
      'Procentní rozdíl',
      '±X min E',
      'Pokračovat',
      'Energis OD',
      'Energis DO',
    ],
  ];
  for (const m of meters) {
    const history = data.readings
      .filter((r) => r.meterId === m.id)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    for (const r of history) {
      const p = history.find((p) => p.id === r.previousId);
      const values = p ? intervalValues(m, p, r) : undefined;
      rows.push([
        m.location,
        m.placement,
        m.serial,
        m.node,
        p ? `${p.date} ${p.time}` : '',
        p?.value ?? '',
        `${r.date} ${r.time}`,
        r.value,
        values?.meterEnergy ?? '',
        r.energis ?? '',
        r.result?.difference ?? '',
        r.result?.percent ?? '',
        readingTimeOffset(r.import, r.date, r.time, r.boundary),
        r.active ? 'ano' : 'ne',
        r.import?.from ?? '',
        r.import?.to ?? '',
      ]);
    }
  }
  return rows;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportSelected(meters: Meter[], data: SeriesData, format: 'xlsx' | 'txt') {
  if (!meters.length) throw Error('Vyberte alespoň jeden elektroměr.');
  const rows = exportRows(meters, data);
  if (format === 'txt') {
    const safe = (v: string | number) =>
      String(v)
        .replace(/[\t\r\n]/g, ' ')
        .replace(/^[=+@-]/, "'$&");
    download(
      new Blob(['\uFEFF' + rows.map((r) => r.map(safe).join('\t')).join('\r\n')], {
        type: 'text/tab-separated-values;charset=utf-8',
      }),
      'odecty.txt',
    );
  } else {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Odečty');
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 24));
    const buffer = await book.xlsx.writeBuffer();
    download(
      new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'odecty.xlsx',
    );
  }
}
