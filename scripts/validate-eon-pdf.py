#!/usr/bin/env python3
"""Read-only reconciliation of static E.ON prices with the committed PDF sources.
Requires Poppler pdftotext. Both source VAT variants are checked verbatim.
"""
import re, json, hashlib, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'src/tariffs/data'
SOURCES=ROOT/'docs/sources/eon-2026'
def numbers(line):
 vals=re.split(r'\s{2,}',line.strip())
 return [None if v in ['–','-'] else float(v.replace(' ','').replace(',','.')) for v in vals]
def pair(a,b):
 assert (a is None)==(b is None)
 return None if a is None else dict(priceWithoutVat=b,priceWithVat=a)
def load(p,business=False):
 lines=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode().split('\f')[1].splitlines()
 hdr=next(l for l in lines if ('C 01d' if business else 'D01d') in l)
 codes=[m.group().replace(' ','') for m in re.finditer(r'[CD] ?\d{2}d',hdr)]
 start=next(re.finditer(r'[CD] ?\d{2}d',hdr)).start()-3
 rows={}
 upper=18 if business else 19
 for n in range(3 if business else 1,upper+1):
  i=next(i for i,l in enumerate(lines) if re.search(r'\s{4,}'+f'{n:02}'+r'$',l))
  gross=numbers(lines[i-1][start:]);net=numbers(lines[i+1][start:])
  if not business and n in [1,2]:
   assert len(net)==len(gross)==5
   mapping=[0,0,1,1,1,2,3,3,3,4]
   gross=[gross[j] for j in mapping];net=[net[j] for j in mapping]
  if not business and n==3:
   assert len(net)==len(gross)==1
   gross*=10;net*=10
  assert len(net)==len(gross)==len(codes),(p.name,n,start,net,gross)
  rows[str(n)]=[pair(a,b) for a,b in zip(gross,net)]
 # Shared fees are explicitly printed as gross (net).
 common={}
 for n,key in zip(range(19 if business else 20,23 if business else 24),['tax','system','infrastructure','pozePerA']):
  l=next(l for l in lines if re.search(r'\s{4,}'+f'{n:02}'+r'$',l))
  m=re.search(r'(\d[\d ]*,\d{2})\s*\((\d[\d ]*,\d{2})\)',l)
  assert m,(n,l)
  common[key]=pair(*[float(x.strip().replace(' ','').replace(',','.')) for x in m.groups()])
 common['pozePerMwh']=None # Source prints a dash, never infer 495 or zero.
 common['pozeAnnual']=dict(priceWithoutVat=0,priceWithVat=0) # Explicit final POZE row 27 / 28.
 assert re.search(r'0,00 \(0,00\)\s+'+('27' if business else '28'), '\n'.join(lines))
 return codes,rows,common

if __name__ == '__main__':
 report={'version':'1.4.8','sources':[], 'unreadableNumericValues':0}
 for name in ['eon-cez-household-2026.json','eon-egd-household-2026.json','eon-pre-household-2026.json','eon-business-spot.json']:
  data=json.loads((DATA/name).read_text());meta=data['metadata'];p=SOURCES/meta['sourceFile'];business=meta['customerType']=='C'
  assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256']
  codes,rows,common=load(p,business)
  assert data['tariffCodes']==codes
  assert data['rows']==rows
  assert data['common']==common
  count=sum(2 for cells in rows.values() for v in cells if v is not None)+sum(2 for v in common.values() if v is not None)
  if business:
   text=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode()
   assert '424 Kč/MWh s DPH (350 Kč/MWh bez DPH)' in text
   assert '0,30 Kč/MWh s DPH (0,25 Kč/MWh bez DPH)' in text
   assert '194 (160) + plat dle příslušné hodnoty hlavního jističe' in text
   assert data['handlingPerMwh']=={'priceWithoutVat':350,'priceWithVat':424}
   assert data['supplierFixedMonthly']=={'priceWithoutVat':160,'priceWithVat':194}
   assert data['minimumUnitPricePerMwh']=={'priceWithoutVat':0.25,'priceWithVat':0.30}
   assert data['commodityPricePerMwh'] is None
   count+=6
  report['sources'].append({'sourceFile':meta['sourceFile'],'tariffs':len(codes),'verifiedSourceNumbers':count,'unverifiedRules':data['unimported']})
 report['verifiedSourceNumbers']=sum(s['verifiedSourceNumbers'] for s in report['sources'])
 report['unverifiedRuleCount']=sum(len(s['unverifiedRules']) for s in report['sources'])
 print(json.dumps(report,ensure_ascii=False,indent=2))
