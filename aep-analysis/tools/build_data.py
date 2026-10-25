from report2 import *
import json,math
cs=comps(); C=cs[0]
def walk(g):
    yield g
    for k in getattr(g,'kids',[]): yield from walk(k)
def seginfo(a,b,g,f):
    dt=(b['tu']-a['tu'])/g.tb
    if dt<=0 or 'val' not in a: return None
    if a['iout']=='hold': return dict(kind='hold',dt=dt)
    va,vb=a['val'],b['val']
    sp=a.get('sp')
    if len(va)>1 and sp: dv=math.dist(va,vb); di=0
    else:
        diffs=[abs(y-x) for x,y in zip(va,vb)]
        if not diffs or max(diffs)==0: return dict(kind='flat',dt=dt)
        di=diffs.index(max(diffs)); dv=vb[di]-va[di]
    if a['iout']=='lin' and b['iin']=='lin': return dict(kind='linear',dt=dt,bez=[0.333,0.333,0.667,0.667])
    if dv==0: return dict(kind='flat',dt=dt)
    try: so=a['outS'][di]; io=a['outI'][di]; si=b['inS'][di]; ii=b['inI'][di]
    except Exception: return None
    dd=abs(dv) if sp else dv
    x1=io; y1=so*io*dt/dd; x2=1-ii; y2=1-si*ii*dt/dd
    if a['iout']=='lin': x1,y1=1/3,1/3
    if b['iin']=='lin': x2,y2=2/3,2/3
    v0=y1/x1 if x1 else 0; v1=(1-y2)/(1-x2) if x2<1 else 0
    if max(y1,y2)>1.02 or min(y1,y2)<-0.02: lab='overshoot'
    elif v0<0.35 and v1<0.35: lab='ease_inout'
    elif v0<0.35: lab='accelerate'
    elif v1<0.35: lab='decelerate'
    elif abs(v0-1)<0.25 and abs(v1-1)<0.25: lab='linear'
    else: lab='custom'
    return dict(kind=lab,dt=dt,bez=[round(x1,3),round(y1,3),round(x2,3),round(y2,3)],oi=round(io*100,1),ii=round(ii*100,1),dv=dv)
layers=[]
for i,L in enumerate(C.layers):
    d=dict(i=i,id=L.id,name=L.name,type=['av','light','camera','text','shape','3d','','mesh'][L.type],parent=L.parent,
           t0=round(L.start+L.inp,3),t1=round(L.start+L.out,3),src=L.src,enabled=L.enabled,adj=L.adj,threeD=L.threeD,blend=L.blend,matte=L.matte,props=[],markers=[],text=None)
    if L.root:
        for g in walk(L.root):
            if g.kind=='markers':
                for t,it in zip(g.times,g.items): d['markers'].append(dict(t=round(L.start+t,3),label=it[0]))
            if g.kind=='text' and g.cos:
                docs=g_(g.cos,'1','1') or []
                fonts=[g_(f,'0','0','0') for f in (g_(g.cos,'0','1','0') or [])]
                for doc in docs:
                    c0=g_(doc,'0','6','0',0,'0','0','6') or {}
                    fi=c0.get('0')
                    d['text']=dict(s=(g_(doc,'0','0') or '').replace('\r','\n').strip(),font=fonts[fi] if fi is not None and fi<len(fonts) else None,size=c0.get('1'),fill=g_(c0,'53','0','1'),track=c0.get('5'))
            if g.kind=='leaf' and g.kfs:
                pct = g.match in ('ADBE Opacity','ADBE Scale','ADBE Mask Opacity'); f=100.0 if pct else 1.0
                kfs=[]; ks=g.kfs
                for n_,k in enumerate(ks):
                    kk=dict(t=round(L.start+k['tu']/g.tb,3),v=[round(x*f,3) for x in k['val']] if 'val' in k else None,ii=k['iin'],io=k['iout'])
                    if 'inI' in k and (k['iin']=='bez' or k['iout']=='bez'):
                        kk['inf']=[round(k['inI'][0]*100,1),round(k['outI'][0]*100,1)]
                    if n_+1<len(ks):
                        s_=seginfo(k,ks[n_+1],g,f)
                        if s_: kk['seg']=s_
                    kfs.append(kk)
                d['props'].append(dict(name=nm(g),match=g.match,kfs=kfs))
    layers.append(d)
meta=dict(name=C.name,w=C.w,h=C.h,fps=C.fps,dur=C.dur)
json.dump(dict(meta=meta,layers=layers),open('data.json','w'),ensure_ascii=False)
print(len(layers),sum(len(l['props']) for l in layers))
# unique recipes
import collections
rec=collections.Counter()
for l in layers:
    for p in l['props']:
        for k in p['kfs']:
            s=k.get('seg')
            if s and s.get('bez') and s['kind'] not in('linear',):
                rec[(tuple(s['bez']),s['kind'])]+=1
for (b,kind),n in rec.most_common(25): print(n,kind,b)
