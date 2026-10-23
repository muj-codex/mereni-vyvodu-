import { blankEntry, type Entry } from './model';
export function parseStylus(text: string): Entry & { from?: string; to?: string } {
  const e: Entry & { from?: string; to?: string } = blankEntry();
  const pick = (re: RegExp) => re.exec(text)?.[1] ?? '';
  e.location =
    pick(/\bTS\s*([\d]+\s*\/\s*\d+)/i).replace(/\s/g, '') ||
    pick(
      /\b(?:rozvodna|TS)\s*[:=]?\s*([^,;\n]+?)(?=\s+(?:pole|kobka|UZEL|U\d|EM|stav|\d{1,2}\.)|$)/i,
    );
  e.node = pick(/\b(?:UZEL|U)\s*[:=]?\s*(\d+)/i);
  e.serial = pick(/\b(?:EM|elektroměr)\s*[:=]?\s*([\w-]+)/i);
  e.placement = pick(/\b(?:pole|kobka|umístění)\s*[:=]?\s*([\w/-]+)/i) || pick(/\b(\d+[A-Za-z])\b/);
  const date = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(text);
  if (date) e.date = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
  const time = /(\d{1,2}):([0-5]\d)/.exec(text);
  if (time) e.time = `${time[1].padStart(2, '0')}:${time[2]}`;
  e.value = pick(/\bstav\s*[:=]?\s*(\d[\d ]*(?:[.,]\d+)?)/i).trim();
  function endpoint(label: string) {
    const re = new RegExp(
      `\\b${label}\\s*[:=]?\\s*(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})\\s+(\\d{1,2}):(\\d{2})`,
      'i',
    );
    const m = re.exec(text);
    return m
      ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}`
      : undefined;
  }
  e.from = endpoint('OD');
  e.to = endpoint('DO');
  if (e.to) {
    [e.date, e.time] = e.to.split('T');
  }
  return e;
}
