"""Injects data/seed.json into build/template.html and writes index.html."""
import json,os
r=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s=json.load(open(os.path.join(r,'data/seed.json')))
j=json.dumps(s,separators=(',',':')).replace('</','<\\/')
t=open(os.path.join(r,'build/template.html')).read().replace('__SEED__',j)
open(os.path.join(r,'index.html'),'w').write(t)
