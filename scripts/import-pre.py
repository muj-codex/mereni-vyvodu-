"""Import PRE's own net/gross pairs and reconcile the two supplied PDFs."""
from pathlib import Path
import json,re,subprocess,hashlib,sys
out={}; pairs=0
number=re.compile(r'\d{1,3}(?: \d{3})*,\d{2}')
net=re.compile(r'\((\d{1,3}(?: \d{3})*,\d{2})\)')
def value(s):return float(s.replace(' ','').replace(',','.'))
for cat,name in [('C','pre-proud-favorit-2.pdf'),('D','pre-proud-favorit-2 2.pdf')]:
 p=Path('docs/sources/pre-2026')/name
 text=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True)
 assert 'PRE PROUD FAVORIT 2 10/2026' in text and '30. 9. 2028' in text and '1. 10. 2026' in text
 lines=text.splitlines();header=next(l for l in lines if 'PODMÍNKY' in l)
 codes=list(re.finditer(rf'{cat}\d{{2}}d',header));centers=[(m.start()+m.end())/2 for m in codes]
 indices={int(l.strip()):i for i,l in enumerate(lines) if re.fullmatch(r'\s*\d{1,2}\s*',l)}
 assert len(codes)==(11 if cat=='C' else 10)
 def row(r):
  end=indices[r];start=indices[r-1]+1 if r>1 else next(i for i,l in enumerate(lines) if 'DISTRIBUČNÍ SAZBA' in l and i>40)
  block=lines[start:end]; nline=next(l for l in reversed(block) if net.search(l))
  ns=list(net.finditer(nline))
  gross=[value(m.group()) for l in block if not net.search(l) for m in number.finditer(l)]
  # All numeric cells include both printed VAT variants; labels have no decimal prices.
  assert len(ns)==len(gross),(cat,r,len(ns),gross)
  ps=[{'priceWithoutVat':value(m.group(1)),'priceWithVat':g} for m,g in zip(ns,gross)]
  for pair in ps:assert abs(pair['priceWithVat']-round(pair['priceWithoutVat']*1.21,2))<.001,(cat,r,pair)
  return ns,ps
 rows={r:row(r) for r in range(1,27)}
 pairs+=sum(len(ps) for _,ps in rows.values())
 groupCodes=([[0,1,2],[3,4],[5],[6],[7],[8],[9],[10]] if cat=='C' else [[0,1],[2,3],[4],[5],[6],[7],[8],[9]])
 vt=[3640,3540,3540,3640,3840,3840,3840,3540] if cat=='C' else [3290,3190,3190,3290,3490,3490,3490,3190]
 nt=[3340,3340,3440,3540,3540,3540] if cat=='C' else [2990,2990,3090,3190,3190,3190,2990]
 assert [p['priceWithoutVat'] for p in rows[1][1]]==vt
 assert [p['priceWithoutVat'] for p in rows[2][1]]==nt
 tariffs={m.group():{'breakerRows':{}} for m in codes}
 for g,indicesGroup in enumerate(groupCodes):
  for i in indicesGroup:
   t=tariffs[codes[i].group()];t['commodityVT']=rows[1][1][g]
   t['commodityNT']=None if g==0 or (cat=='C' and g==7) else rows[2][1][g-1]
   t['fixedMonthly']=rows[3][1][0]
 assert rows[3][1][0]['priceWithoutVat']==129
 def columns(r):
  ms,ps=rows[r];d={}
  for m,pair in zip(ms,ps):
   i=min(range(len(centers)),key=lambda i:abs(centers[i]-(m.start()+m.end())/2))
   assert i not in d,(cat,r);d[i]=pair
  return d
 for r in range(5,21):
  cells=columns(r)
  if r==6:expected={i for i,m in enumerate(codes) if tariffs[m.group()]['commodityNT'] is not None}
  elif cat=='D' and 15<=r<=18:expected={8}
  else:expected=set(range(len(codes)))
  assert set(cells)==expected,(cat,r,cells)
  for i,m in enumerate(codes):
   if r in [5,6]:tariffs[m.group()]['distributionVT' if r==5 else 'distributionNT']=cells.get(i)
   else:tariffs[m.group()]['breakerRows'][str(r)]=cells.get(i)
 common={k:rows[r][1][0] for r,k in [(4,'tax'),(21,'pozeA'),(22,'pozeB'),(23,'system'),(24,'infrastructure')]}
 assert [common[k]['priceWithoutVat'] for k in ['tax','pozeA','pozeB','system','infrastructure']]==[28.3,0,495,164.24,12.87]
 for r,commodity,distribution in [(25,'commodityVT','distributionVT'),(26,'commodityNT','distributionNT')]:
  summary=columns(r)
  for i,m in enumerate(codes):
   t=tariffs[m.group()]
   if t[commodity] is None:assert i not in summary;continue
   total=t[commodity]['priceWithoutVat']+t[distribution]['priceWithoutVat']+common['tax']['priceWithoutVat']+common['system']['priceWithoutVat']
   assert abs(summary[i]['priceWithoutVat']-total)<.001,(cat,r,m.group())
 out[cat]={'metadata':{'supplier':'PRE','productName':'PRE PROUD FAVORIT 2 10/2026','pricingType':'fixed','validFrom':'2026-10-01','priceGuaranteeUntil':'2028-09-30','distributionArea':'CEZ_DISTRIBUCE','sourceFile':name,'sourcePages':[1,2],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lastVerifiedAt':'2026-10-28','vatConvention':'parentheses without VAT; bold with 21% VAT'},'tariffs':tariffs,'common':common}
p=Path('src/tariffs/data/pre-favorit2-2026.json')
if '--check' in sys.argv:assert json.loads(p.read_text())==out
else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'tariffs':{c:len(d['tariffs']) for c,d in out.items()},'verifiedNetGrossPairs':pairs,'unreadable':0,'independentUnitTotals':'verified'}))
