from model import *
from cos import g as g_
import re,sys
cs=comps()
# param display names
PN={}
for ef in root.walk():
    if ef.id=='LIST' and ef.typ=='parT':
        m=None
        for k in ef.kids:
            if k.id=='tdmn': m=tstr(k.body)
            elif k.id=='pard' and m:
                PN[m]=k.body[16:48].split(b'\0')[0].decode('utf8','replace')
ALIAS={'ADBE Position':'Position','ADBE Scale':'Scale','ADBE Rotate Z':'Rotation','ADBE Opacity':'Opacity','ADBE Anchor Point':'Anchor','ADBE Time Remapping':'TimeRemap'}
def dec(s):
    s=re.sub(r'\\x([0-9A-Fa-f]{2})',lambda m:chr(int(m.group(1),16)),s)
    return s
def fv(v):
    if isinstance(v,list): return '['+', '.join(f'{x:.5g}' for x in v)+']'
    return str(v)
def nm(g): return ALIAS.get(g.match) or PN.get(g.match) or g.name or g.match
SKIP_STATIC_PREFIX=('ADBE Material','ADBE Extrsn','PEDG2')
def seg(a,b,g,f):
    dt=(b['tu']-a['tu'])/g.tb
    if dt<=0 or 'val' not in a: return ''
    if a['iout']=='hold': return f'↳ HOLD {dt:.2f}s'
    va,vb=a['val'],b['val']
    import math
    if len(va)>1 and a.get('sp'):
        dv=math.dist(va,vb)
    else:
        diffs=[abs(y-x) for x,y in zip(va,vb)]
        if not diffs or max(diffs)==0: return f'↳ same value {dt:.2f}s'
        di=diffs.index(max(diffs)); dv=vb[di]-va[di]
    if a.get('sp') or len(va)==1: di=0
    if a['iout']=='lin' and b['iin']=='lin': return f'↳ LINEAR {dt:.2f}s'
    if dv==0: return f'↳ {dt:.2f}s'
    try:
        so=a['outS'][di]; io=a['outI'][di]; si=b['inS'][di]; ii=b['inI'][di]
    except Exception: return ''
    sgn=1 if (dv>0) else -1
    ad=abs(dv)
    x1=io; y1=sgn*so*io*dt/ (dv if not a.get('sp') else ad) if True else 0
    # use signed dv for non-spatial, magnitude for spatial
    dd = ad if a.get('sp') else dv
    y1=so*io*dt/dd; x2=1-ii; y2=1-si*ii*dt/dd
    if a['iout']=='lin': x1,y1=0.333,0.333
    if b['iin']=='lin': x2,y2=0.667,0.667
    v0=y1/x1 if x1 else 0; v1=(1-y2)/(1-x2) if x2<1 else 0
    if max(y1,y2)>1.02 or min(y1,y2)<-0.02: lab='OVERSHOOT/ANTICIPATE'
    elif v0<0.35 and v1<0.35: lab='EASE IN-OUT (S)'
    elif v0<0.35: lab='ACCELERATE (slow start, fast end)'
    elif v1<0.35: lab='DECELERATE (fast start, soft landing)'
    elif abs(v0-1)<0.25 and abs(v1-1)<0.25: lab='~LINEAR'
    else: lab='CUSTOM'
    return f'↳ {dt:.2f}s  bezier({x1:.2f},{y1:.2f},{x2:.2f},{y2:.2f})  startVel={v0:.2f} endVel={v1:.2f}  => {lab}'

def emit(g,L,d,out,infx=False):
    pad='  '*d
    if g.kind=='group':
        sub=[]
        isfx = g.match in ('ADBE Effect Parade',)
        for k in g.kids: emit(k,L,d+1,sub, infx or isfx)
        if g.match in('ADBE Material Options Group','ADBE Extrsn Options Group','ADBE Text Path Options','ADBE Text More Options'): sub=[x for x in sub if 'kf×' in x]
        if sub:
            out.append(f'{pad}▸ {g.name or g.match}')
            out.extend(sub)
    elif g.kind=='leaf':
        if g.match=='ADBE Group End': return
        if g.kfs:
            pct = g.match in ('ADBE Opacity','ADBE Scale','ADBE Mask Opacity')
            f = 100.0 if pct else 1.0
            out.append(f'{pad}• {nm(g)} kf×{len(g.kfs)}')
            ks=g.kfs
            for n_,k in enumerate(ks):
                t=L.start+k['tu']/g.tb
                val=fv([x*f for x in k['val']]) if 'val' in k else ''
                es=''
                if 'inS' in k and (k['iin']=='bez' or k['iout']=='bez'):
                    es=f" in(spd={fv([x*f for x in k['inS']])},inf={fv([x*100 for x in k['inI']])}%) out(spd={fv([x*f for x in k['outS']])},inf={fv([x*100 for x in k['outI']])}%)"
                out.append(f"{pad}    t={t:7.3f}  {val:28s} {k['iin']}/{k['iout']}{es}{' ROVE' if k['rove'] else ''}")
                if n_+1<len(ks):
                    out.append(pad+'      '+seg(k,ks[n_+1],g,f))
        elif g.static is not None and isinstance(g.static,list):
            if g.match in('ADBE Shadow Color',): return
            vals=g.static[:4]
            if g.match in ('ADBE Opacity','ADBE Scale'): vals=[x*100 for x in vals]
            if all(x==0 for x in vals) and not g.expr: return
            out.append(f'{pad}· {nm(g)} = {fv(vals)}')
        if g.expr:
            out.append(f'{pad}  EXPR[{nm(g)}]: {dec(g.expr)[:240]!r}')
    elif g.kind=='text':
        d_=g.cos
        if d_:
            docs=g_(d_,'1','1') or []
            fonts=[g_(f,'0','0','0') for f in (g_(d_,'0','1','0') or [])]
            for i,doc in enumerate(docs):
                txt=g_(doc,'0','0')
                c0=g_(doc,'0','6','0',0,'0','0','6') or {}
                fi=c0.get('0')
                tm=g.times[i] if i<len(g.times) else None
                out.append(f'{pad}TEXT t={None if tm is None else round(L.start+tm,3)} {txt!r} font={fonts[fi] if fi is not None and fi<len(fonts) else fi} size={c0.get("1")} fill={fv(g_(c0,"53","0","1"))} stroke={fv(g_(c0,"54","0","1"))} sw={c0.get("82")} trk={c0.get("5")}')
    elif g.kind=='markers':
        for t,it in zip(g.times,g.items): out.append(f'{pad}MARKER t={L.start+t:.3f} {it}')
def layer_report(C,i,L):
    out=[]
    if L.root: emit(L.root,L,1,out)
    s=f'[{i}] id={L.id} "{L.name}" type={["AV","light","cam","text","shape","3dmodel","","mesh"][L.type] if L.type<8 else L.type} par={L.parent or "-"} {L.start+L.inp:.3f}→{L.start+L.out:.3f}s src={L.src or "-"} blend={L.blend} matte={L.matte} {"ADJ " if L.adj else ""}{"3D " if L.threeD else ""}{"" if L.enabled else "OFF "}'
    return s+'\n'+'\n'.join(out)
if __name__=='__main__':
    ci=int(sys.argv[1]); C=cs[ci]
    for i,L in enumerate(C.layers): print(layer_report(C,i,L))
