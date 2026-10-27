#!/usr/bin/env python3
"""Read-only validation of Variant fixed tariff against the original PDF (Poppler)."""
from pathlib import Path
import re,json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'src/tariffs/data/eon-variant-business-2026.json'
def parse(path):
 lines=subprocess.check_output(['pdftotext','-layout',str(path),'-']).decode().split('\f')[1].splitlines()
 hdr=next(l for l in lines if 'C01d' in l);codes=re.findall(r'C\d{2}d',hdr);start=hdr.index('C01d')-3
 def nums(line):return [None if v in ['–','-'] else float(v.replace(' ','').replace(',','.')) for v in re.split(r'\s{2,}',line.strip())]
 rows={}
 for n in [*range(1,20),25,26]:
  i=next(i for i,l in enumerate(lines) if re.search(r'\s{4,}'+f'{n:02}'+r'$',l))
  gross=nums(lines[i-2 if n>=25 else i-1][start:]);net=nums(lines[i-1 if n>=25 else i+1][start:])
  if n in [1,2]:
   assert len(gross)==len(net)==5
   mapping=[0,0,0,1,1,1,2,3,3,3,4];gross=[gross[j] for j in mapping];net=[net[j] for j in mapping]
  if n==3:assert len(net)==len(gross)==1;gross*=11;net*=11
  assert len(net)==len(gross)==11,(n,net)
  assert all((a is None)==(b is None) for a,b in zip(net,gross))
  rows[str(n)]=[None if a is None else {'priceWithoutVat':a,'priceWithVat':b} for a,b in zip(net,gross)]
 common={}
 for n,key in zip(range(20,24),['tax','system','infrastructure','pozePerA']):
  line=next(l for l in lines if re.search(r'\s{4,}'+f'{n:02}'+r'$',l))
  match=re.search(r'(\d[\d ]*,\d{2})\s*\((\d[\d ]*,\d{2})\)',line);assert match
  a,b=[float(v.strip().replace(' ','').replace(',','.')) for v in match.groups()];common[key]={'priceWithoutVat':b,'priceWithVat':a}
 assert re.search(r'0,00 \(0,00\)\s+28','\n'.join(lines))
 assert 'nad 3x160 A za A' in '\n'.join(lines)
 assert 'D 57d' not in '\n'.join(lines)
 common['pozePerMwh']=None;common['pozeAnnual']={'priceWithoutVat':0,'priceWithVat':0}
 for i,code in enumerate(codes):
  for a,b,total in [('1','4','25'),('2','5','26')]:
   if rows[a][i] is None:assert rows[total][i] is None;continue
   expected=rows[a][i]['priceWithoutVat']+rows[b][i]['priceWithoutVat']+common['tax']['priceWithoutVat']+common['system']['priceWithoutVat']
   assert abs(expected-rows[total][i]['priceWithoutVat'])<.000001,(code,total)
 return codes,rows,common
if __name__=='__main__':
 data=json.loads(DATA.read_text());meta=data['metadata'];p=ROOT/'docs/sources/eon-2026'/meta['sourceFile']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==meta['sha256']
 codes,rows,common=parse(p)
 assert data['tariffCodes']==codes and data['rows']==rows and data['common']==common
 assert not data['unimported'] and meta['pricingType']=='fixed'
 count=sum(2 for values in rows.values() for v in values if v is not None)+sum(2 for v in common.values() if v is not None)
 print(json.dumps({'version':'1.4.9','sourceFile':meta['sourceFile'],'tariffCount':len(codes),'verifiedSourceNumbers':count,'unreadableNumericValues':0,'unverifiedRules':[],'pozePerMwh':None,'pozeAnnualWithoutVat':0,'breakerAbove160A':'explicitly verified by row 18','sourceTotalsReconciled':True},ensure_ascii=False,indent=2))
