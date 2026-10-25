from aep import *
import math
def name_of(n):
    # tdsn / fnam style: 'Utf8' + 4 byte tag? body = b'Utf8' + string
    k=n.first('tdsn')
    if k is None: return ''
    b=k.body
    return tstr(b[4:]) if b[:4]==b'Utf8' else tstr(b)
def match_of(n):
    k=n.first('tdmn')
    return tstr(k.body) if k else ''
def ITEMTYPE(raw,size,spatial,dims):
    m={(4,152):'color',(4,128):'3d',(4,104):'2dsp',(4,88):'2d',(4,80):'orient',(4,64):'noval',(4,48):'1d',(4,16):'marker',(4,8):'shape'}
    t=m.get((raw,size),'unk')
    if t=='3d' and spatial: t='3dsp'
    return t
INTERP={1:'lin',2:'bez',3:'hold'}
def read_kf(item,t):
    time_units,i_in,i_out,kfl=struct.unpack('>iBBH',item[:8]); p=item[8:]
    d=dict(tu=time_units,iin=INTERP.get(i_in,i_in),iout=INTERP.get(i_out,i_out),flags=kfl,
           cont=bool(kfl&8),autob=bool(kfl&16),rove=bool(kfl&32))
    try:
        if t=='color':
            v=struct.unpack('>18d',p[:144]) if False else struct.unpack('>18d',p[:144])
            d.update(inS=[v[2]],inI=[v[3]],outS=[v[4]],outI=[v[5]],val=[v[7],v[8],v[9],v[6]]) # r,g,b,a
        elif t in('noval','orient'):
            v=struct.unpack('>6d',p[:48]); d.update(inS=[v[2]],inI=[v[3]],outS=[v[4]],outI=[v[5]])
        elif t in('2dsp','3dsp'):
            n=2 if t=='2dsp' else 3
            v=struct.unpack('>'+'d'*(5+3*n),p[8:8+8*(5+3*n)])
            d.update(inS=[v[1]],inI=[v[2]],outS=[v[3]],outI=[v[4]],val=list(v[5:5+n]),sp=True)
        elif t in('1d','2d','3d'):
            n={'1d':1,'2d':2,'3d':3}[t]
            v=struct.unpack('>'+'d'*(5*n),p[:40*n])
            d.update(val=list(v[:n]),inS=list(v[n:2*n]),inI=list(v[2*n:3*n]),outS=list(v[3*n:4*n]),outI=list(v[4*n:5*n]))
    except Exception as e: d['err']=str(e)
    return d
class Prop: pass
def leaf(tdbs,layer_tb,tdb4_cache=None):
    p=Prop(); p.name=name_of(tdbs); p.kind='leaf'
    t4=tdbs.first('tdb4').body
    p.dims=u(t4,'H',2)[0]; flags=t4[5]; p.spatial=bool(flags&8)
    p.tb=u(t4,'I',12)[0] or layer_tb
    p.animated=bool(t4[0x44]) if len(t4)>0x44 else False
    p.static=None
    cd=tdbs.first('cdat')
    if cd is not None:
        b=cd.body; p.static=list(struct.unpack('>'+'d'*(len(b)//8),b[:len(b)//8*8])) if len(b)>=8 else b.hex()
    lst=tdbs.first('list')
    p.kfs=[]
    if lst is not None:
        lh=lst.first('lhd3').body
        cnt=u(lh,'I',8)[0]; isz=u(lh,'I',16)[0]; raw=lh[23]
        t=ITEMTYPE(raw,isz,p.spatial,p.dims)
        data=lst.first('ldat').body
        p.itype=t
        for i in range(cnt):
            p.kfs.append(read_kf(data[i*isz:(i+1)*isz],t))
    p.expr=None
    for k in tdbs.kids:
        if k.id=='Utf8' and k.sz>4 and k is not tdbs.first('tdsn'):
            s=k.body.decode('utf8','replace')
            p.expr=s
    p.extra=[k.id if k.id!='LIST' else 'L:'+k.typ for k in tdbs.kids]
    return p
def group(tdgp,layer_tb):
    g=Prop(); g.kind='group'; g.name=name_of(tdgp); g.match=''; g.kids=[]
    pend=''
    for k in tdgp.kids:
        if k.id=='tdmn': pend=tstr(k.body)
        elif k.id=='LIST' and k.typ=='tdgp':
            sg=group(k,layer_tb); sg.match=pend; g.kids.append(sg)
        elif k.id=='LIST' and k.typ=='tdbs':
            p=leaf(k,layer_tb); p.match=pend; g.kids.append(p)
        elif k.id=='LIST' and k.typ=='sspc':
            sg=Prop(); sg.kind='group'; sg.match=pend; sg.kids=[]
            fn=k.first('fnam'); sg.name=tstr(fn.body[4:]) if fn else ''
            for kk in k.kids:
                if kk.id=='LIST' and kk.typ=='tdgp':
                    sub=group(kk,layer_tb); sg.kids=sub.kids
            g.kids.append(sg)
        elif k.id=='LIST' and k.typ=='btds':
            p=Prop(); p.kind='text'; p.name=name_of(tdgp) ; p.match=pend
            p.docs=[]
            for kk in k.kids:
                if kk.id=='LIST' and kk.typ=='tdbs':
                    t4=kk.first('tdb4').body; tb=u(t4,'I',12)[0] or layer_tb
                    lst=kk.first('list')
                    p.tb=tb; p.times=[]
                    if lst is not None:
                        lh=lst.first('lhd3').body; cnt=u(lh,'I',8)[0]; isz=u(lh,'I',16)[0]
                        data=lst.first('ldat').body
                        for i in range(cnt):
                            p.times.append(struct.unpack('>i',data[i*isz:i*isz+4])[0]/tb)
                if kk.id=='LIST' and kk.typ=='btdk':
                    from cos import parse_cos
                    raw=b'<<'+D[kk.off:kk.off+kk.sz-4]+b'>>'
                    try: p.cos=parse_cos(raw)
                    except Exception as e: p.cos=None; p.err=str(e)
            g.kids.append(p)
        elif k.id=='LIST' and k.typ in('mrst',):
            p=Prop(); p.kind='markers'; p.name='Marker'; p.match=pend; p.items=[]
            tb=layer_tb
            ks=[kk for kk in k.walk() if kk.id=='LIST' and kk.typ=='tdbs']
            t4=ks[0].first('tdb4').body; tb=u(t4,'I',12)[0] or layer_tb
            lst=ks[0].first('list'); times=[]
            if lst is not None:
                lh=lst.first('lhd3').body; cnt=u(lh,'I',8)[0]; isz=u(lh,'I',16)[0]
                data=lst.first('ldat').body
                for i in range(cnt): times.append(struct.unpack('>i',data[i*isz:i*isz+4])[0]/tb)
            for kk in k.walk():
                if kk.id=='LIST' and kk.typ=='Nmrd':
                    us=[x for x in kk.kids if x.id=='Utf8']
                    p.items.append([tstr(x.body) for x in us])
            p.times=times
            g.kids.append(p)
        elif k.id=='LIST' and k.typ=='om-s':
            tb_=k.first('tdbs')
            p=leaf(tb_,layer_tb) if tb_ else Prop()
            p.match=pend; p.kind='leaf'; p.name=pend
            # path shapes
            p.shapes=[]
            ok=k.first('omks')
            if ok:
                for sh in ok.kids:
                    if sh.id=='LIST' and sh.typ=='shap':
                        lst=sh.first('list')
                        if lst is None: continue
                        lh=lst.first('lhd3').body; cnt=u(lh,'I',8)[0]; isz=u(lh,'I',16)[0]
                        data=lst.first('ldat').body
                        pts=[struct.unpack('>ff',data[i*isz:i*isz+8]) for i in range(cnt)] if isz==8 else []
                        p.shapes.append(pts)
            g.kids.append(p)
        elif k.id=='LIST' and k.typ in('omks','otst','Als2'):
            pass
    return g
def comps():
    res=[]
    for it in root.walk():
        if it.id=='LIST' and it.typ=='Item' and it.first('cdta'):
            c=it.first('cdta').body
            ts=u(c,'H',5)[0]; itb=u(c,'I',8)[0]
            C=Prop(); 
            nm=[k for k in it.kids if k.id=='Utf8'][0].body
            C.name=tstr(nm); C.fps=itb/256/ts; C.itb=itb; C.w,C.h=u(c,'HH',140)
            C.dur=u(c,'I',44)[0]/u(c,'I',48)[0]
            C.id=u(it.first('iide').body,'I')[0]
            C.node=it; C.layers=[]
            for ly in it.find('LIST'):
                if ly.typ!='Layr': continue
                L=Prop(); b=ly.first('ldta').body
                L.id=u(b,'I')[0]; L.stretch_div=u(b,'I',0x4c)[0] if False else 1
                sd,sdv=u(b,'iI',12); ind,indv=u(b,'iI',20); od,odv=u(b,'iI',28)
                L.start=sd/sdv if sdv else 0
                L.inp=ind/indv if indv else 0; L.out=od/odv if odv else 0
                L.src=u(b,'I',40)[0]; L.type=b[131]; L.parent=u(b,'I',132)[0]
                L.fl1=b[37];L.fl2=b[38];L.fl3=b[39]
                L.name=b[64:96].split(b'\0')[0].decode('utf8','replace')
                L.blend=b[0x63]; L.matte=b[0x6b]
                L.label=b[61]
                L.adj=bool(b[38]&2); L.nul=bool(b[38]&0x80); L.threeD=bool(b[38]&4); L.enabled=bool(b[39]&1); L.solo=bool(b[38]&8); L.shy=bool(b[39]&0x40);L.mb=bool(b[39]&8)
                L.node=ly
                tg=ly.first('tdgp')
                L.root=group(tg,C.itb) if tg else None
                C.layers.append(L)
            res.append(C)
    return res
