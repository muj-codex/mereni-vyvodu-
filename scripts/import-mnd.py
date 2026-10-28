"""Import only the Prosinec 28 appendix, excluding the adjacent basic Proud price list."""
from pathlib import Path
import json,re,subprocess,hashlib,sys
net=re.compile(r'\[(\d{1,3}(?: \d{3})*,\d{2})\]')
number=re.compile(r'(?<![\w\d])\d{1,3}(?: \d{3})*(?:,\d{2})?(?![\w\d])')
def value(s):return float(s.replace(' ','').replace(',','.'))
out={'C':{},'D':{}};pairs=0;differences=[]
for cat in ['C','D']:
 for short,area in [('CEZ','ČEZ Distribuce'),('EGD','EG.D'),('PRE','PREdistribuce')]:
  name=f'2026_10_01_MND_Proud_Cenik_Prosinec_28_{short}'+('_MO' if cat=='C' else '')+'.pdf';p=Path('docs/sources/mnd-2026')/name
  text=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True);flat=' '.join(text.split())
  assert all(s in flat for s in ['7. 10. 2026','30 MWh/rok','31. 12. 2028','1. 1. 2029'])
  lines=text.split('\f')[1].splitlines();header=next(l for l in lines if 'DISTRIBUČNÍ SAZBA' in l);codes=list(re.finditer(rf'{cat}\d{{2}}d',header))
  assert len(codes)==(11 if cat=='C' else 10)
  breaker_indices=[i for i,l in enumerate(lines) if re.search(r'Jistič (?:do|nad)',l)]
  assert len(breaker_indices)==(14 if cat=='C' else 15)
  def net_after(i):return next(l for l in lines[i+1:] if net.search(l))
  centers=[m.end() for m in net.finditer(net_after(breaker_indices[0]))]
  def read(nline,gline,label):
   global pairs
   ms=list(net.finditer(nline));gs=[value(m.group()) for m in number.finditer(gline) if m.start()>55]
   assert len(ms)==len(gs),(name,label,len(ms),gs,nline,gline)
   vals=[]
   for m,g in zip(ms,gs):
    v=value(m.group(1));delta=round(g-round(v*1.21,2),2);assert abs(delta)<=.02,(name,label,v,g)
    if delta:differences.append({'source':name,'row':label,'net':v,'printedGross':g,'calculatedGross':round(v*1.21,2)})
    vals.append({'priceWithoutVat':v,'priceWithVat':g});pairs+=1
   return ms,vals
  # The appendix contains only the selected product, unlike page one's adjacent basic price columns.
  hd=next(i for i,l in enumerate(lines) if 'DISTRIBUČNÍ SAZBA' in l)
  comercial=[i for i,l in enumerate(lines[:hd]) if net.search(l)]
  assert len(comercial)==3
  cps=[read(lines[i],lines[i-1],f'commercial{j}') for j,i in enumerate(comercial)]
  assert len(cps[0][1])==1 and cps[0][1][0]['priceWithoutVat']==138.84
  groups=([[0,1,2],[3,4],[5],[6],[7,8],[9],[10]] if cat=='C' else [[0,1],[2,3],[4],[5],[6],[7],[8],[9]])
  assert len(cps[1][1])==len(groups)
  tariffs={m.group():{'breakerRows':{}} for m in codes}
  for g,indices in enumerate(groups):
   for i in indices:
    t=tariffs[codes[i].group()];t['fixedMonthly']=cps[0][1][0];t['commodityVT']=cps[1][1][g];t['commodityNT']=None if g==0 or (cat=='C' and g==6) else cps[2][1][g-1]
  def columns(nline,gline,label,expected):
   ms,ps=read(nline,gline,label);d={}
   for m,pair in zip(ms,ps):
    i=min(range(len(centers)),key=lambda i:abs(centers[i]-m.end()));assert i not in d,(name,label,nline);d[i]=pair
   assert set(d)==expected,(name,label,d)
   return d
  ni=[i for i,l in enumerate(lines[hd:],start=hd) if net.search(l)]
  # First two square-bracket rows after the distribution header are VT and NT distribution.
  for j,key in enumerate(['distributionVT','distributionNT']):
   i=ni[j];expected=set(range(len(codes))) if j==0 else {k for k,m in enumerate(codes) if tariffs[m.group()]['commodityNT'] is not None}
   # VT gross is on the label above; NT likewise.
   vals=columns(lines[i],lines[i-1],key,expected)
   for k,m in enumerate(codes):tariffs[m.group()][key]=vals.get(k)
  for j,i in enumerate(breaker_indices):
   expected=set(range(len(codes)))
   if cat=='D' and 8<=j<=12:expected={8}
   if cat=='D' and j==13:expected=set(range(10))-{8}
   vals=columns(net_after(i),lines[i],f'breaker{j}',expected)
   for k,m in enumerate(codes):tariffs[m.group()]['breakerRows'][str(9+j)]=vals.get(k)
  common={}
  for label,key in [('Cena systémových služeb v','system'),('Cena na podporu výkupu elektřiny z','pozePerMwh'),('Cena za provoz nesíťové infrastruktury v','infrastructure'),('Sazba daně z elektřiny v','tax')]:
   line=next(l for l in lines if label in l);m=net.search(line);assert m
   prefix=line[:m.start()];g=value(list(number.finditer(prefix))[-1].group());v=value(m.group(1));assert abs(round(v*1.21,2)-g)<=.01
   common[key]={'priceWithoutVat':v,'priceWithVat':g};pairs+=1
  assert [common[k]['priceWithoutVat'] for k in ['system','pozePerMwh','infrastructure','tax']]==[164.24,0,12.87,28.3]
  components={'dataCentre':5.88,'eru':4,'oteSettlement':1.61,'pozeAdministration':1.38}
  for v in components.values():assert f'{v:.2f}'.replace('.',',') in flat
  assert abs(sum(components.values())-common['infrastructure']['priceWithoutVat'])<1e-9
  # Printed unit totals independently reconcile the basic individual net items.
  summaries={}
  for label,key,commodity,dist in [('Cena za vysoký tarif celkem','VT','commodityVT','distributionVT'),('Cena za nízký tarif celkem','NT','commodityNT','distributionNT')]:
   i=next(i for i,l in enumerate(lines) if label in l)
   nline=lines[i] if net.search(lines[i]) else net_after(i)
   gline=next(l for l in reversed(lines[:i+1]) if number.search(l) and not net.search(l))
   expected={k for k,m in enumerate(codes) if tariffs[m.group()][commodity] is not None}
   vals=columns(nline,gline,'summary'+key,expected);summaries[key]={}
   for k,m in enumerate(codes):
    if k not in vals:continue
    t=tariffs[m.group()];total=t[commodity]['priceWithoutVat']+t[dist]['priceWithoutVat']+164.24+28.3
    assert abs(vals[k]['priceWithoutVat']-total)<.011,(name,m.group(),key,vals[k],total);summaries[key][m.group()]=vals[k]
  out[cat][area]={'metadata':{'supplier':'MND Energie a.s.','productName':'Proud – Ceník Prosinec 28','pricingType':'fixed','validFrom':'2026-10-07','priceGuaranteeUntil':'2028-12-31','revertsToBasicFrom':'2029-01-01','distributionArea':area,'sourceFile':name,'sourcePages':[1,2],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lastVerifiedAt':'2026-10-28','vatConvention':'square brackets without VAT; leading price with VAT','limitKwh':30000},'tariffs':tariffs,'common':common,'infrastructureComponentsWithoutVat':components,'publishedUnitSummaries':summaries}
for cat in out:
 ref=out[cat]['ČEZ Distribuce']['tariffs']
 for area,d in out[cat].items():
  for code,t in d['tariffs'].items():
   for key in ['commodityVT','commodityNT','fixedMonthly']:assert t[key]==ref[code][key]
p=Path('src/tariffs/data/mnd-prosinec28-2026.json')
report={'version':'1.4.14','sources':6,'verifiedNetGrossPairs':pairs,'tariffsPerArea':{'C':11,'D':10},'unreadable':0,'printedRoundingDifferences':differences,'infrastructureCharged':'aggregate once; components informational only'}
rp=Path('docs/mnd-validation-1.4.14.json')
if '--check' in sys.argv:assert json.loads(p.read_text())==out and json.loads(rp.read_text())==report
else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');rp.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='printedRoundingDifferences'}|{'roundingDifferenceCount':len(differences)}))
