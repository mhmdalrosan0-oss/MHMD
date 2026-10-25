import json,collections,math
D=json.load(open('data.json'))
L=D['layers']
# type counts
print(collections.Counter(l['type'] for l in L))
print('disabled:',[l['i'] for l in L if not l['enabled']])
# cubic bezier eval
def bez_y(p,b):
    x1,y1,x2,y2=b
    lo,hi=0.0,1.0
    for _ in range(40):
        s=(lo+hi)/2
        x=3*(1-s)**2*s*x1+3*(1-s)*s*s*x2+s**3
        if x<p: lo=s
        else: hi=s
    s=(lo+hi)/2
    return 3*(1-s)**2*s*y1+3*(1-s)*s*s*y2+s**3
def ev(prop,t):
    ks=prop['kfs']
    if t<=ks[0]['t']: return ks[0]['v']
    if t>=ks[-1]['t']: return ks[-1]['v']
    for a,b in zip(ks,ks[1:]):
        if a['t']<=t<=b['t']:
            dt=b['t']-a['t']; p=(t-a['t'])/dt
            s=a.get('seg') or {}
            k=s.get('kind')
            if a['io']=='hold': y=0
            elif k in('linear',None,'flat'): y=p
            elif s.get('bez'): y=bez_y(p,s['bez'])
            else: y=p
            return [x+(z-x)*y for x,z in zip(a['v'],b['v'])]
def prop(l,name):
    for p in l['props']:
        if p['name']==name: return p
vis=[(0,4.32,44),(4.32,13.52,27),(13.52,14.8,None),(14.8,18.26,21),(18.26,25.26,20),(25.26,29.22,19)]
series=[]
t=0.0
while t<=29.22+1e-9:
    row=None
    for a,b,idx in vis:
        if a<=t<b+1e-9 and idx is not None:
            l=L[idx]
            sc=prop(l,'Scale'); po=prop(l,'Position')
            if idx==44:
                row=[round(t,2),None,None,None,idx]
            else:
                s=ev(sc,t)[0] if sc else None
                pp=ev(po,t) if po else None
                row=[round(t,2),round(s,2) if s is not None else None,round(pp[0],1) if pp else None,round(pp[1],1) if pp else None,idx]
            break
    if row is None: row=[round(t,2),None,None,None,None]
    series.append(row)
    t+=0.04
cam=L[37]; cp=prop(cam,'Position')
camser=[[round(x*0.04,2),round(ev(cp,x*0.04)[2],1),round(ev(cp,x*0.04)[1],1)] for x in range(0,int(4.4/0.04))]
# recipes with usage
rec={}
for l in L:
    for p in l['props']:
        for k in p['kfs']:
            s=k.get('seg')
            if s and s.get('bez') and s['kind']!='linear':
                key=tuple(round(x,2) for x in s['bez'])
                r=rec.setdefault(key,dict(bez=list(key),kind=s['kind'],n=0,props=collections.Counter(),ex=[],dts=[]))
                r['n']+=1; r['props'][p['name']]+=1; r['dts'].append(round(s['dt'],2))
                if len(r['ex'])<3: r['ex'].append(dict(layer=l['i'],t=k['t'],dt=round(s['dt'],2)))
out=[]
for key,r in sorted(rec.items(),key=lambda x:-x[1]['n']):
    r['props']=r['props'].most_common(4); r['dtmin']=min(r['dts']); r['dtmax']=max(r['dts']); del r['dts']
    out.append(r)
json.dump(dict(series=series,cam=camser,recipes=out),open('data2.json','w'))
print(len(out)); 
for r in out[:12]: print(r['n'],r['kind'],r['bez'],r['props'],r['dtmin'],r['dtmax'])
import os;print(os.path.getsize('data.json'),os.path.getsize('data2.json'))
