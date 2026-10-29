"""Reconcile EPET's six official PDFs; normal prices are net, bold prices gross.
Only pages 1–2 supply standard energy costs. Page 3 optional services are excluded.
"""
from pathlib import Path
import re,json,subprocess,hashlib,sys
TOKEN=re.compile(r'\d{1,3}(?: \d{3})*,\d{2}|(?<!\S)-(?!\S)')
def tokens(line):return [None if m.group()=='-' else float(m.group().replace(' ','').replace(',','.')) for m in TOKEN.finditer(line)]
out={'C':{},'D':{}};pairs=0;rounding=[]
for cat in out:
 for short,area in [('CEZ','ČEZ Distribuce'),('EGD','EG.D'),('PRE','PREdistribuce')]:
  name=f'EP-EE-FIX-24-GARANT-7_2026_{"SPOL" if cat=="C" else "DOM"}_{short}.pdf';p=Path('docs/sources/epet-2026')/name
  pages=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True,stderr=subprocess.DEVNULL).split('\f');lines=pages[1].splitlines();flat=' '.join(pages[1].split())
  assert all(s in flat for s in ['20. 7. 2026','24 měsíců','STANDARD','1. 1. 2026','není oprávněn'])
  hd=next(i for i,l in enumerate(lines) if 'Distribuční sazba' in l);codes=re.findall(rf'{cat}\d{{2}}d',lines[hd]);n=len(codes);assert n==(11 if cat=='C' else 10)
  def read(section,label,expected=n):
   global pairs
   # Text labels may wrap, but decimal prices always form a net row followed by a gross row.
   rows=[tokens(l) for l in section if len(tokens(l))>=expected]
   assert len(rows)>=2,(name,label,section)
   net,gross=rows[:2];assert len(net)==len(gross)==expected,(name,label,net,gross)
   result=[]
   for v,g in zip(net,gross):
    assert (v is None)==(g is None),(name,label,v,g)
    if v is None:result.append(None);continue
    delta=round(g-round(v*1.21,2),2);assert abs(delta)<=.01,(name,label,v,g)
    if delta:rounding.append({'source':name,'row':label,'net':v,'printedGross':g,'calculatedGross':round(v*1.21,2)})
    result.append({'priceWithoutVat':v,'priceWithVat':g});pairs+=1
   return result
  def from_label(label,start=hd):
   i=next(i for i in range(start,len(lines)) if label in lines[i]);return read(lines[i:],label)
  tariffs={code:{'breakerRows':{}} for code in codes}
  for label,key in [('Vysoký tarif','commodityVT'),('Nízký tarif','commodityNT'),('Stálý plat za OM','fixedMonthly')]:
   vals=from_label(label)
   for code,v in zip(codes,vals):tariffs[code][key]=v
  # Repeated commercial table on page one must agree independently.
  first=pages[0].splitlines()
  for label,key in [('Vysoký tarif','commodityVT'),('Nízký tarif','commodityNT'),('Stálý plat za OM','fixedMonthly')]:
   i=next(i for i,l in enumerate(first) if label in l);vals=read(first[i:],'page1'+key)
   assert vals==[tariffs[c][key] for c in codes]
  starts=[i for i,l in enumerate(lines) if re.match(r'\s*(?:do 3×10 A|nad 3[×x]|nad 1×25)',l)]
  # The D per-A line contains a continued "nad 3x160" label, not an extra band.
  starts=[i for i in starts if not ('nad 3x160' in lines[i] and 'pro D57d' in ' '.join(lines[i:i+2]))]
  assert len(starts)==14,(name,len(starts))
  for j,i in enumerate(starts):
   vals=read(lines[i:],f'breaker{j}')
   for code,v in zip(codes,vals):
    # Normalize to the existing band keys: D has one combined >63 (>160 D57d) per-A row.
    key=str(9+j)
    if cat=='D' and j==12:key='21' if code=='D57d' else '22'
    if cat=='D' and j==13:key='23'
    tariffs[code]['breakerRows'][key]=v
  reg=next(i for i,l in enumerate(lines) if i > starts[-1] and 'Cena za Distribuční služby' in l)
  for label,key in [('Vysoký tarif','distributionVT'),('Nízký tarif','distributionNT')]:
   vals=from_label(label,reg)
   for code,v in zip(codes,vals):tariffs[code][key]=v
  common={}
  for label,key in [('Cena za provoz','infrastructure'),('elektřiny z OZE varianta A','pozePerAmp'),('elektřiny z OZE varianta B','pozeCapPerMwh'),('Cena za systémové','system')]:
   i=next(i for i,l in enumerate(lines) if label in l)
   # A/B label follows the first numeric line.
   if 'varianta' in label:i-=1
   vals=read(lines[i:],key);assert all(v==vals[0] for v in vals);common[key]=vals[0]
  taxi=next(i for i,l in enumerate(lines) if 'Daň z elektřiny' in l)
  common['tax']=read(lines[taxi:],'tax',1)[0]
  assert [common[k]['priceWithoutVat'] for k in ['infrastructure','pozePerAmp','pozeCapPerMwh','system','tax']]==[12.87,0,495,164.24,28.3]
  common['pozePerMwh']={'priceWithoutVat':0,'priceWithVat':0}
  components={'oteSettlement':1.61,'pozeAdministration':1.38,'eru':4,'dataCentre':5.88}
  assert abs(sum(components.values())-12.87)<1e-9
  for v in components.values():assert f'{v:.2f}'.replace('.',',') in flat
  summaries={};totalstart=next(i for i,l in enumerate(lines) if 'Celková cena' in l)
  for label,key,comm,dist in [('Vysoký tarif','VT','commodityVT','distributionVT'),('Nízký tarif','NT','commodityNT','distributionNT')]:
   vals=from_label(label,totalstart);summaries[key]=dict(zip(codes,vals))
   for code,v in zip(codes,vals):
    t=tariffs[code]
    if t[comm] is None:assert v is None;continue
    assert abs(v['priceWithoutVat']-(t[comm]['priceWithoutVat']+t[dist]['priceWithoutVat']+164.24+28.3))<.011,(name,code,key,v,t[comm],t[dist])
  out[cat][area]={'metadata':{'supplier':'epet energie, a.s.','productName':'FIX 24 · GARANT 7_2026','pricingType':'fixed','validFrom':'2026-07-20','fixationMonths':24,'fixationStarts':'actual supply start','prolongationProduct':'STANDARD','distributionArea':area,'sourceFile':name,'sourcePages':[1,2],'excludedOptionalServicesPage':3,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lastVerifiedAt':'2026-10-29','vatConvention':'normal price without VAT; bold price with VAT'},'tariffs':tariffs,'common':common,'infrastructureComponentsWithoutVat':components,'publishedUnitSummaries':summaries}
for cat in out:
 for d in out[cat].values():
  for code,t in d['tariffs'].items():
   for k in ['commodityVT','commodityNT','fixedMonthly']:assert t[k]==out[cat]['ČEZ Distribuce']['tariffs'][code][k]
report={'version':'1.4.15','sources':6,'verifiedNetGrossPairs':pairs,'tariffsPerArea':{'C':11,'D':10},'unreadable':0,'printedRoundingDifferences':rounding,'infrastructureCharged':'aggregate once; components informational only','poze2026':0,'optionalServicesIncluded':False}
p=Path('src/tariffs/data/epet-fix24-2026.json');rp=Path('docs/epet-validation-1.4.15.json')
if '--check' in sys.argv:assert json.loads(p.read_text())==out and json.loads(rp.read_text())==report
else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');rp.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='printedRoundingDifferences'}|{'roundingDifferenceCount':len(rounding)}))
