"""Transcribe/reconcile each Centropol PDF independently by printed row/column positions."""
from pathlib import Path
import json,re,hashlib,subprocess,sys
net=re.compile(r'\((\d{1,3}(?: \d{3})*,\d{2})\)');number=re.compile(r'\d{1,3}(?: \d{3})*,\d{2}')
def num(s):return float(s.replace(' ','').replace(',','.'))
out={'C':{},'D':{}};pairCount=0;warnings=[]
for cat in ['C','D']:
 for short,area in [('cez','ČEZ Distribuce'),('egd','EG.D'),('pre','PREdistribuce')]:
  filename=(f'c-fixne-pro-podnikatele-na-2-roky-21092026-c-{short}-01012026.pdf' if cat=='C' else f'd-fixne-online-pro-zacatek-na-2-roky-24092026-d-{short}-01012026.pdf')
  p=Path('docs/sources/centropol-2026')/filename
  text=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True);lines=text.splitlines()
  assert ('21.9.2026' if cat=='C' else '24.9.2026') in text
  header=next(l for l in lines if 'Distribuční sazba' in l)
  codes=list(re.finditer(rf'{cat}\d{{2}}d',header));centers=[m.end() for m in codes]
  assert len(codes)==(12 if cat=='C' else 10)
  indices={int(m.group(1)):i for i,l in enumerate(lines) if (m:=re.match(r'^\s*(\d{1,2})\s+[A-Za-zČčNíVvFfJjCD]',l))}
  calibration=next(l for l in lines[indices[3]:indices[4]] if net.search(l))
  centers=[m.end() for m in net.finditer(calibration)]
  assert len(centers)==len(codes)
  last=25 if cat=='C' else 26
  rows={}
  for r in range(1,last+1):
   ix=indices[r];end=indices[r+1]
   nline=next(l for l in lines[ix:end] if net.search(l))
   ms=list(net.finditer(nline));grossline=lines[ix] if number.search(lines[ix]) else next(l for l in reversed(lines[:ix]) if l.strip())
   gs=[num(m.group()) for m in number.finditer(grossline)]
   assert len(ms)==len(gs),(cat,short,r,len(ms),gs)
   cells={}
   for m,g in zip(ms,gs):
    i=min(range(len(centers)),key=lambda i:abs(centers[i]-m.end()));assert i not in cells,(filename,r,i,centers,nline)
    v=num(m.group(1));delta=round(g-round(v*1.21,2),2)
    assert abs(delta)<=.02,(filename,r,i,v,g)
    if delta: warnings.append({'source':filename,'row':r,'tariff':codes[i].group(),'net':v,'printedGross':g,'calculatedGross':round(v*1.21,2)})
    cells[i]={'priceWithoutVat':v,'priceWithVat':g};pairCount+=1
   rows[r]=cells
  tariffs={m.group():{} for m in codes}
  for r in range(1,(23 if cat=='C' else 24)):
   if r in [6,7,8]:expected=set(range(len(codes)))
   elif r==2:expected={i for i,m in enumerate(codes) if m.group() not in ['C01d','C02d','C03d','C62d','D01d','D02d']}
   elif r==5:expected={i for i,m in enumerate(codes) if m.group() not in ['C01d','C02d','C03d','C55d','C62d','D01d','D02d']}
   elif cat=='C' and (r==4 or 9<=r<=22):expected=set(range(12))-{9}
   elif cat=='D' and 17<=r<=21:expected={8}
   elif cat=='D' and r==22:expected=set(range(10))-{8}
   else:expected=set(range(len(codes)))
   assert set(rows[r])==expected,(filename,r,rows[r])
  for i,m in enumerate(codes):
   t=tariffs[m.group()]
   for r,k in [(1,'commodityVT'),(2,'commodityNT'),(3,'fixedMonthly'),(4,'distributionVT'),(5,'distributionNT')]:t[k]=rows[r].get(i)
   t['breakerRows']={str(r):rows[r].get(i) for r in range(9,23 if cat=='C' else 24)}
  taxrow=23 if cat=='C' else 24
  common={}
  for r,k in [(6,'system'),(7,'pozeA'),(8,'infrastructure'),(taxrow,'tax')]:
   vals=list(rows[r].values());assert len(vals)==len(codes) and all(v==vals[0] for v in vals)
   common[k]=vals[0]
  assert [common[k]['priceWithoutVat'] for k in ['system','pozeA','infrastructure','tax']]==[164.24,0,12.87,28.3]
  for i,m in enumerate(codes):
   t=tariffs[m.group()]
   for r,k,dist in [(taxrow+1,'commodityVT','distributionVT'),(taxrow+2,'commodityNT','distributionNT')]:
    if t[k] is None or t[dist] is None:continue
    expected=t[k]['priceWithoutVat']+t[dist]['priceWithoutVat']+164.24+28.3
    assert abs(rows[r][i]['priceWithoutVat']-expected)<.011,(filename,r,m.group(),rows[r][i],expected)
  out[cat][area]={'metadata':{'supplier':'CENTROPOL ENERGY, a.s.','productName':'FIXNĚ PRO PODNIKATELE na 2 roky' if cat=='C' else 'FIXNĚ ONLINE PRO ZAČÁTEK na 2 roky','pricingType':'fixed','validFrom':'2026-09-21' if cat=='C' else '2026-09-24','regulatedFrom':'2026-01-01','distributionArea':area,'sourceFile':filename,'sourcePage':1,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lastVerifiedAt':'2026-10-28','vatConvention':'parentheses without VAT; bold with VAT'},'tariffs':tariffs,'common':common,'publishedUnitSummaries':{str(r):{codes[i].group():v for i,v in rows[r].items()} for r in [taxrow+1,taxrow+2]}}
# Commodity parity is verified across the PDFs, never assumed for regulation.
for cat in ['C','D']:
 ref=out[cat]['ČEZ Distribuce']['tariffs']
 for area,d in out[cat].items():
  for code,t in d['tariffs'].items():
   for key in ['commodityVT','commodityNT','fixedMonthly']:assert t[key]==ref[code][key]
p=Path('src/tariffs/data/centropol-2026.json')
if '--check' in sys.argv:assert json.loads(p.read_text())==out
else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
report={'version':'1.4.13','sources':6,'verifiedNetGrossPairs':pairCount,'tariffsPerArea':{'C':12,'D':10},'C55d':'commodity only in all areas','unreadable':0,'independentUnitTotals':'verified','printedRoundingDifferences':warnings,'nonApplicableSummary':'C62d printed NT summary is not an NT supply/distribution price and is not used'}
assert all(w['row'] >= (24 if w['source'].startswith('c-') else 25) for w in warnings)
reportpath=Path('docs/centropol-validation-1.4.13.json')
if '--check' in sys.argv: assert json.loads(reportpath.read_text())==report
else:reportpath.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='printedRoundingDifferences'}|{'printedRoundingDifferenceCount':len(warnings)}))
