"""Extract the supplied PDF tables by printed column positions; --check reconciles the dataset."""
from pathlib import Path
import re,json,hashlib,subprocess,sys
out={}
num=re.compile(r'(?<![\d\w])\d{1,3}(?: \d{3})*,\d{2}(?!\d)')
for cat,kind in [('C','MO'),('D','DOM')]:
 p=Path(f'docs/sources/innogy-2026/EE_CEN_BEN24_260401_{kind}_CEZ.pdf')
 text=subprocess.check_output(['pdftotext','-layout',str(p),'-'],text=True)
 flat=' '.join(text.split())
 assert 'Ceník je platný od 1. 4. 2026.' in flat
 assert '24. měsíce' in flat and 'elektřina Benefit 24' in flat
 assert 'ČEZ Distribuce, a.s.' in flat
 lines=text.splitlines()
 header=next(l for l in lines if 'DISTRIBUČNÍ SAZBA' in l)
 codes=list(re.finditer(rf'{cat}\d{{2}}d',header)); centers=[(m.start()+m.end())/2 for m in codes]
 tariffs={m.group():{'breakerRows':{}} for m in codes}
 def row(n):
  matches=[l for l in lines if re.search(rf'\s{n}\s*$',l) and len(l.rstrip())>centers[-1]]
  assert len(matches)==1,(cat,n,matches)
  return matches[0]
 def cells(line):
  vals={}
  for m in num.finditer(line):
   if m.start()<centers[0]-8:continue
   i=min(range(len(centers)),key=lambda i:abs(centers[i]-(m.start()+m.end())/2))
   assert i not in vals,(cat,line)
   vals[i]=float(m.group().replace(' ', '').replace(',','.'))
  return vals
 distrow=18 if cat=='C' else 19
 lastbreaker=17 if cat=='C' else 18
 for r in range(4,lastbreaker+1):
  values=cells(row(r))
  expected=set(range(len(codes))) if cat=='C' or r<=11 or r==18 else ({8} if r<=16 else set(range(len(codes)))-{8})
  assert set(values)==expected,(cat,r,values)
  for i,m in enumerate(codes):tariffs[m.group()]['breakerRows'][str(r)]=values.get(i)
 for r,key in [(distrow,'distributionVT'),(distrow+1,'distributionNT')]:
  vals=cells(row(r))
  for i,m in enumerate(codes):tariffs[m.group()][key]=vals.get(i)
 # Commodity groups share merged cells; verify every printed group before expanding.
 groupprices=[3240,3240,3140,3240,3240,3140,3240] if cat=='C' else [3240,3240,3140,3240,3240,3140,3140,3240]
 for r,expected in [(1,[127]*len(groupprices)),(2,groupprices),(3,groupprices[1:-1] if cat=='C' else groupprices[1:])]:
  actual=[float(m.group().replace(' ','').replace(',','.')) for m in num.finditer(row(r))]
  assert actual==expected,(cat,r,actual,expected)
 for code,t in tariffs.items():
  low=code in ['C27d','C56d','D27d','D56d','D57d']
  t.update(commodityVT=3140 if low else 3240,commodityNT=(3140 if low else 3240) if t['distributionNT'] is not None else None,fixedMonthly=127)
 commonnames=['system','pozeA','pozeB','ote','dataCentre','eru','tax']
 common={}
 for r,key in enumerate(commonnames,start=distrow+2):
  vals=[float(m.group().replace(' ','').replace(',','.')) for m in num.finditer(row(r))]
  assert len(vals)==1,(cat,r,vals)
  common[key]=vals[0]
 assert list(common.values())==[164.24,0,495,2.99,5.88,4,28.3]
 # Independent published net and gross total per-MWh rows validate tariff alignment.
 for offset,key in [(0,'distributionVT'),(1,'distributionNT')]:
  label='cena elektřiny ve vysokém tarifu' if offset==0 else 'cena elektřiny v nízkém tarifu'
  ix=next(i for i,l in enumerate(lines) if label in l)
  a=cells(lines[ix-1]); b=cells(lines[ix+1])
  for i,m in enumerate(codes):
   t=tariffs[m.group()]
   if t[key] is None: assert i not in a;continue
   expected=t['commodityVT' if offset==0 else 'commodityNT']+t[key]+common['system']+common['tax']
   assert abs(a[i]-expected)<.001,(cat,m.group(),a[i],expected)
   assert abs(b[i]-round(expected*1.21,2))<.001
 out[cat]={'metadata':{'supplier':'innogy','productName':'elektřina Benefit 24','pricingType':'fixed','fixationMonths':24,'validFrom':'2026-04-01','regulatedFrom':'2026-01-01','distributionArea':'CEZ_DISTRIBUCE','customer':cat,'sourceFile':p.name,'sourcePage':1,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lastVerifiedAt':'2026-10-28','prices':'without VAT; published gross unit totals reconciled separately'},'tariffs':tariffs,'common':common}
p=Path('src/tariffs/data/innogy-benefit24-2026.json')
if '--check' in sys.argv:assert json.loads(p.read_text())==out
else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'tariffs':{c:len(d['tariffs']) for c,d in out.items()},'unreadable':0,'independentNetAndGrossTotals':'verified','mode':'check' if '--check' in sys.argv else 'import'}))
