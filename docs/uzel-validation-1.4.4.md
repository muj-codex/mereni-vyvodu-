# Validace referenčního datasetu UZEL – 1.4.4

Zdroj: pět uživatelských fotografií IMG_3557–IMG_3561.HEIC, list List1. SHA-256 zdrojů a vazba každého záznamu na buňku původního listu jsou v src/series/reference/uzel.json. Přepis ručně ověřen proti fotografiím, bez dopočítávání identifikátorů. Překryvy stejné buňky na více fotografiích jsou sloučeny; opakované bloky Q/U/Y v původním listu zůstávají samostatnými záznamy.

| Ukazatel | Počet |
| --- | ---: |
| Obsazené řádky ve čtyřsloupcových blocích | 994 |
| Záznamy s čitelným UZEL | 959 |
| Různé čitelné UZLY | 880 |
| Úplné záznamy | 944 |
| Neúplné / nečitelné / neověřené záznamy | 50 |
| UZLY s více výskyty | 40 |
| Konfliktní UZLY | 1 |
| Konfliktní dvojice lokalita + umístění | 0 |

## Duplicity UZEL

| UZEL | Buňky UZEL |
| --- | --- |
| 21201042 | E22, E23 |
| 21108027 | Q1, U1, Y1 |
| 21108053 | Q2, U2, Y2 |
| 21108030 | Q3, U3, Y3 |
| 21108054 | Q4, U4, Y4 |
| 21108031 | Q5, U5, Y5 |
| 21108055 | Q6, U6, Y6 |
| 21108032 | Q7, U7, Y7 |
| 21108056 | Q8, U8, Y8 |
| 21108033 | Q9, U9, Y9 |
| 21108057 | Q10, U10, Y10 |
| 21108034 | Q11, U11, Y11 |
| 21108060 | Q12, U12, Y12 |
| 21108041 | Q13, U13, Y13 |
| 21108064 | Q14, U14, Y14 |
| 21108043 | Q15, U15, Y15 |
| 21108066 | Q16, U16, Y16 |
| 21108070 | Q17, U17, Y17 |
| 10105019 | Q18, U18, Y18 |
| 10105031 | Q19, U19, Y19 |
| 10105020 | Q20, U20, Y20 |
| 10105032 | Q21, U21, Y21 |
| 10105021 | Q22, U22, Y22 |
| 10105033 | Q23, U23, Y23 |
| 10105022 | Q24, U24, Y24 |
| 10105034 | Q25, U25, Y25 |
| 10105023 | Q26, U26, Y26 |
| 10105035 | Q27, U27, Y27 |
| 10105024 | Q28, U28, Y28 |
| 10105036 | Q29, U29, Y29 |
| 10105025 | Q30, U30, Y30 |
| 10105037 | Q31, U31, Y31 |
| 10105026 | Q32, U32, Y32 |
| 10105038 | Q33, U33, Y33 |
| 10105027 | Q34, U34, Y34 |
| 10105039 | Q35, U35, Y35 |
| 10105028 | Q36, U36, Y36 |
| 10105040 | Q37, U37, Y37 |
| 10105029 | Q38, U38, Y38 |
| 10105094 | Q39, U39, Y39 |

## Konfliktní UZEL

| UZEL | Buňky UZEL |
| --- | --- |
| 21201042 | E22, E23 |

## Konfliktní lokalita + umístění

| Lokalita / umístění | Buňky UZEL |
| --- | --- |


## Neúplné záznamy

| Buňka UZEL | UZEL | Neověřená pole |
| --- | --- | --- |
| E30 | 21201046 | location |
| AC10 | 10105018 | mtpPrimary, mtpSecondary |
| AC11 | 10105030 | mtpPrimary, mtpSecondary |
| AC35 | 10105064 | mtpPrimary, mtpSecondary |
| AG11 | 10105063 | mtpPrimary, mtpSecondary |
| AG30 | null | node |
| AK28 | null | node |
| AK35 | null | node |
| BM31 | 21207020 | location |
| BM32 | 21207031 | location |
| BM33 | 21207021 | location |
| BM34 | 21207032 | location |
| BM35 | 21207022 | location |
| BM36 | 21207044 | location |
| BM37 | 21207033 | location |
| BM38 | 21207055 | location |
| BM39 | 21207045 | location |
| BU8 | null | node |
| BU9 | null | node |
| BU29 | 21112130 | placement, mtpPrimary, mtpSecondary |
| BU33 | null | node, mtpPrimary, mtpSecondary |
| CK7 | null | node |
| CK8 | null | node |
| CK9 | null | node |
| CK10 | null | node |
| CK11 | null | node |
| CK12 | null | node |
| CK13 | null | node |
| CK14 | null | node |
| CK15 | null | node |
| CK27 | null | node |
| CK28 | null | node |
| CK29 | null | node |
| CK30 | null | node |
| CK31 | null | node |
| CK32 | null | node |
| CK33 | null | node |
| CO3 | null | node |
| CO4 | null | node |
| CO17 | null | node |
| CO18 | null | node |
| CO19 | null | node |
| CO20 | null | node |
| CO21 | null | node |
| CO22 | null | node |
| CO23 | null | node |
| CO24 | null | node |
| CO25 | null | node |
| CO26 | null | node |
| CO27 | null | node |

Nečitelné, zakryté, oříznuté a prázdné buňky jsou null. Nestandardní MTP AC10, AC11, AC35, AG11, BU29 a BU33 zůstávají bez ověřeného převodu; původní viditelný text je zachován. MTP primární obsahuje jen ověřený čitatel převodu. Rozlišují se malá a velká písmena umístění (například 10a / 10A); nejde o jednu vazbu.

Při konfliktní vazbě se nepředvyplní žádný odvozený údaj, ani při zpětném hledání. Shodné duplicity umožňují jednoznačnou vazbu. U neúplného jednoznačného řádku se předvyplní jen ověřené buňky. UZEL se neodvozuje ze sousedních řádků. Dataset se používá pouze při editaci stávajících polí prvního odečtu, bez změny uložených dat, importu Energisu, hlavní identifikace Měření nebo výpočetního jádra. MTP elektroměru se nepřepisuje.
