import { version } from '../package.json';
import { writeFileSync } from 'node:fs';
import { validateDirectory } from '../src/series/reference/directory';
const r = validateDirectory();
writeFileSync(`docs/uzel-validation-${version}.json`, JSON.stringify(r, null, 2) + '\n');
const list = (items: typeof r.duplicateNodes) =>
  items.map((g) => `| ${g.key} | ${g.cells.join(', ')} |`).join('\n');
const text = `# Validace referenčního datasetu UZEL – ${version}

Zdroj: pět uživatelských fotografií IMG_3557–IMG_3561.HEIC, list List1. SHA-256 zdrojů a vazba každého záznamu na buňku původního listu jsou v src/series/reference/uzel.json. Původní přepis ručně ověřen proti fotografiím, bez dopočítávání identifikátorů. Verze 1.4.6 doplňuje uživatelem výslovně ověřených devět lokalit CHEZA a 28 UZLŮ R701/R702 podle zadání z 27. 10. 2026; původní zápis a oba zdroje jsou zachovány v metadatech. Překryvy stejné buňky na více fotografiích jsou sloučeny; opakované bloky Q/U/Y v původním listu zůstávají samostatnými záznamy.

| Ukazatel | Počet |
| --- | ---: |
| Obsazené řádky ve čtyřsloupcových blocích | ${r.sheetRecords} |
| Záznamy s čitelným UZEL | ${r.recordsWithNode} |
| Různé čitelné UZLY | ${r.distinctNodes} |
| Úplné záznamy | ${r.completeRecords} |
| Neúplné / nečitelné / neověřené záznamy | ${r.incompleteRecords} |
| UZLY s více výskyty | ${r.duplicateNodes.length} |
| Konfliktní UZLY | ${r.conflictingNodes.length} |
| Konfliktní dvojice lokalita + umístění | ${r.conflictingLocations.length} |

## Duplicity UZEL

| UZEL | Buňky UZEL |
| --- | --- |
${list(r.duplicateNodes)}

## Konfliktní UZEL

| UZEL | Buňky UZEL |
| --- | --- |
${list(r.conflictingNodes)}

## Konfliktní lokalita + umístění

| Lokalita / umístění | Buňky UZEL |
| --- | --- |
${list(r.conflictingLocations)}

## Neúplné záznamy

| Buňka UZEL | UZEL | Neověřená pole |
| --- | --- | --- |
${r.incomplete.map((v) => `| ${v.cell} | ${v.node ?? 'null'} | ${v.unverified.join(', ')} |`).join('\n')}

Nečitelné, zakryté, oříznuté a prázdné buňky jsou null. Nestandardní MTP AC10, AC11, AC35, AG11, BU29 a BU33 zůstávají bez ověřeného převodu; původní viditelný text je zachován. MTP primární obsahuje jen ověřený čitatel převodu. Rozlišují se malá a velká písmena umístění (například 10a / 10A); nejde o jednu vazbu.

Při konfliktní vazbě se nepředvyplní žádný odvozený údaj, ani při zpětném hledání. Shodné duplicity umožňují jednoznačnou vazbu. U neúplného jednoznačného řádku se předvyplní jen ověřené buňky. UZEL se neodvozuje ze sousedních řádků. Dataset používá společná existující vrstva autofillu hlavní Identifikace měření a vstupních formulářů odečtů. Nemění se uložená měření, import Energisu ani výpočetní jádro. MTP elektroměru se nepřepisuje.
`;
writeFileSync(`docs/uzel-validation-${version}.md`, text);
console.log(
  JSON.stringify(
    {
      ...r,
      incomplete: undefined,
      duplicateNodes: r.duplicateNodes.length,
      conflictingNodes: r.conflictingNodes.length,
      conflictingLocations: r.conflictingLocations.length,
    },
    null,
    2,
  ),
);
