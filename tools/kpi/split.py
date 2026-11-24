# Splits apps-script/KPI.gs into Code.gs, Code2.gs, Code3.gs, Code4.gs at fixed headers, so a change only alters the part it is in.
import re,sys,os
src=open('apps-script/KPI.gs').read()
heads=["/** Their day, as a page. */","/** Salesforce's own Task status list","/** The system's day for the wall"]
cuts=[]
for h in heads:
    i=src.index('\n'+h)+1; cuts.append(i)
parts=[src[:cuts[0]].rstrip('\n'),src[cuts[0]:cuts[1]].rstrip('\n'),src[cuts[1]:cuts[2]].rstrip('\n'),src[cuts[2]:]]
m=re.search(r'\n/\*\* An edit to a record \(PATCH\)[^\n]*\nfunction sfkPatch_\(object, id, body\) \{.*?\n\}\n',parts[3],re.S)
if m: parts[3]=parts[3].replace(m.group(0),'\n',1); parts[0]=parts[0]+'\n'+m.group(0)
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for n,p in zip(['Code.gs','Code2.gs','Code3.gs','Code4.gs'],parts): open(os.path.join(out,n),'w').write(p)
