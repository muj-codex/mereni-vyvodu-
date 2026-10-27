#!/usr/bin/env python3
"""Reconcile the static 1.4.7 tariff data with the committed source PDFs.
Requires Poppler pdftotext. Reads only; never generates or repairs prices.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/tariffs/data'
SOURCES = ROOT / 'docs/sources/cez-2026'


def source_text(data):
    meta = data['metadata']
    path = SOURCES / meta['sourceFile']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == meta['sha256']
    return subprocess.check_output(['pdftotext', '-layout', str(path), '-']).decode()


def household(path):
    data = json.loads(path.read_text())
    lines = source_text(data).splitlines()
    header = next(line for line in lines if 'Distribuční sazba' in line and 'D01d' in line)
    columns = [(match.group(), match.start() + 2) for match in re.finditer(r'D\d{2}d', header)]
    assert [code for code, _ in columns] == data['tariffCodes']
    checked = 0
    for row in range(1, 28):
        start = next(i for i, line in enumerate(lines) if re.match(r'^' + str(row) + r'\s', line))
        actual = [None] * 10
        for line in lines[start + 1:start + 5]:
            if re.match(r'^\d+\s', line):
                break
            matches = list(re.finditer(r'\(([\d ]+,\d{2})\)', line))
            if not matches:
                continue
            for match in matches:
                center = (match.start() + match.end()) / 2
                col = min(range(10), key=lambda j: abs(columns[j][1] - center))
                assert abs(columns[col][1] - center) < 8
                assert actual[col] is None
                actual[col] = float(match.group(1).replace(' ', '').replace(',', '.'))
            break
        assert actual == data['rowsWithoutVat'][str(row)], (path.name, row, actual)
        checked += sum(value is not None for value in actual)
    assert not data['unimported']
    return {'sourceFile': data['metadata']['sourceFile'], 'tariffs': 10, 'verifiedNetValues': checked, 'unimported': []}


def esco():
    data = json.loads((DATA / 'esco-spot-2026.json').read_text())
    lines = source_text(data).split('\f')[1].splitlines()
    codes = re.findall(r'C\d{2}d', next(line for line in lines if line.startswith('distribuční sazba')))
    months = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září']
    for index, month in enumerate(months, 1):
        start = next(i for i, line in enumerate(lines) if re.match('^' + month + r'\s', line))
        values = [float(value.replace(' ', '').replace(',', '.')) for value in re.findall(r'\d[\d ]*,\d{2}', lines[start - 1].strip())]
        assert len(values) == 11
        assert dict(zip(codes, values)) == data['monthlyPricesWithoutVatPerMwh'][f'2026-{index:02}']
    start = next(i for i, line in enumerate(lines) if re.match(r'^Stálá platba\s', line))
    fixed = [float(v.replace(' ', '').replace(',', '.')) for v in re.findall(r'\d[\d ]*,\d{2}', lines[start - 1].strip())]
    assert fixed == [data['supplierFixedMonthlyWithoutVat']] * 11
    assert 'služby ve výši 285' in '\n'.join(lines)
    assert data['includedSurchargeWithoutVatPerMwh'] == 285
    assert codes == list(data['monthlyPricesWithoutVatPerMwh']['2026-09'])
    assert 'C60d' not in codes
    assert not data['unimported']
    return {'sourceFile': data['metadata']['sourceFile'], 'tariffs': len(codes), 'publishedMonths': len(months), 'referenceMonth': max(data['monthlyPricesWithoutVatPerMwh']), 'verifiedMonthlyPrices': 99, 'unimported': []}


if __name__ == '__main__':
    report = {'version': '1.4.7', 'households': [household(DATA / name) for name in ['cez-household-2026.json', 'egd-household-2026.json', 'pre-household-2026.json']], 'business': esco()}
    print(json.dumps(report, ensure_ascii=False, indent=2))
