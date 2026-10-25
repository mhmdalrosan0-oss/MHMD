import struct,sys,json,glob
F=glob.glob('/root/.claude/uploads/77cda27d-9f23-5a08-9702-31aa44268ac8/*.aep')[0]
D=open(F,'rb').read()
class N:
    __slots__=('id','typ','sz','off','body','kids','par')
    def __init__(s,id,typ,sz,off,body,par):
        s.id=id;s.typ=typ;s.sz=sz;s.off=off;s.body=body;s.kids=[];s.par=par
    def find(s,i): return [k for k in s.kids if k.id==i or (k.id=='LIST' and k.typ==i)]
    def first(s,i):
        for k in s.kids:
            if k.id==i or (k.id=='LIST' and k.typ==i): return k
    def walk(s):
        yield s
        for k in s.kids: yield from k.walk()
def parse(off,end,par):
    while off+8<=end:
        cid=D[off:off+4].decode('latin1'); sz=struct.unpack('>I',D[off+4:off+8])[0]
        b=off+8
        if cid=='LIST':
            n=N('LIST',D[b:b+4].decode('latin1'),sz,b+4,None,par); parse(b+4,b+sz,n)
        else:
            n=N(cid,None,sz,b,D[b:b+sz],par)
        par.kids.append(n)
        off=b+sz+(sz&1)
root=N('ROOT','',0,0,None,None); parse(12,len(D),root)
def lid(n): return n.typ if n.id=='LIST' else n.id
def u(b,fmt,o=0): return struct.unpack_from('>'+fmt,b,o)
def utf8(n):
    b=n.body
    return b.split(b'\0')[0].decode('utf8','replace')
def tstr(b): return b.split(b'\0')[0].decode('utf8','replace')
