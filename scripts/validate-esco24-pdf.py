#!/usr/bin/env python3
"""Read-only validation of the middle (Elektřina 24) PDF block; requires Poppler."""
import json,re,hashlib,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def extract(path):
 text=subprocess.check_output(['pdftotext','-layout',str(path),'-']).decode()
 header=next(l for l in text.splitlines() if 'Elektřina 12' in l and 'Elektřina 24' in l and 'Elektřina 36' in l)
 centers=[header.index(x)+len(x)/2 for x in ['Elektřina 12','Elektřina 24','Elektřina 36']]
 left=(centers[0]+centers[1])/2;right=(centers[1]+centers[2])/2
 rows={}
 pattern=r'([\d ]+,\d{2})\s*\(([\d ]+,\d{2})\)'
 for line in text.splitlines():
  code=re.search(r'C\d{2}d\*?',line)
  if not code:continue
  matches=[]
  for match in re.finditer(pattern,line):
   center=(match.start()+match.end())/2
   if left<center<right:matches.append(match)
  assert len(matches) in [2,3],(code.group(),len(matches))
  prices=[{'priceWithVat':float(m.group(1).strip().replace(' ','').replace(',','.')),'priceWithoutVat':float(m.group(2).strip().replace(' ','').replace(',','.'))} for m in matches]
  normalized=code.group().replace('*','')
  assert normalized not in rows
  rows[normalized]={'sourceTariffLabel':code.group(),'vtPerMwh':prices[0],'ntPerMwh':prices[1] if len(prices)==3 else None,'supplierFixedMonthly':prices[-1]}
 assert len(rows)==12
 assert 'dodávek na 24 měsíců' in text and 'od 1.6.2026' in text
 return rows
if __name__=='__main__':
 data=json.loads((ROOT/'src/tariffs/data/esco-electricity24-2026.json').read_text());m=data['metadata'];p=ROOT/'docs/sources/cez-2026'/m['sourceFile']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sha256']
 rows=extract(p);assert rows==data['tariffs']
 assert not data['unimported']
 count=sum(2 for row in rows.values() for key in ['vtPerMwh','ntPerMwh','supplierFixedMonthly'] if row[key] is not None)
 print(json.dumps({'version':'1.4.10','sourceFile':m['sourceFile'],'productName':m['productName'],'tariffCount':len(rows),'verifiedSourceNumbers':count,'unreadableNumericValues':0,'unimported':[],'C55d':'verified commodity only; no verified regulated price','selectedPdfBlock':'Elektřina 24'},ensure_ascii=False,indent=2))
