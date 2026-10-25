import re
def parse_cos(raw):
    s=raw
    i=0
    n=len(s)
    def ws():
        nonlocal i
        while i<n and s[i] in b' \t\r\n': i+=1
    def val():
        nonlocal i
        ws()
        c=s[i:i+1]
        if s[i:i+2]==b'<<':
            i+=2; d={}
            while True:
                ws()
                if s[i:i+2]==b'>>': i+=2; return d
                assert s[i:i+1]==b'/', (i,s[i-20:i+40])
                j=i+1
                while s[j:j+1] not in b' \t\r\n<[(': j+=1
                k=s[i+1:j].decode(); i=j
                d[k]=val()
        if c==b'[':
            i+=1; a=[]
            while True:
                ws()
                if s[i:i+1]==b']': i+=1; return a
                a.append(val())
        if c==b'(':
            i+=1; buf=bytearray()
            while True:
                ch=s[i]
                if ch==0x5c: buf.append(s[i+1]); i+=2; continue
                if ch==0x29: i+=1; break
                buf.append(ch); i+=1
            b=bytes(buf)
            if b[:2]==b'\xfe\xff': return b[2:].decode('utf-16-be','replace')
            return b.decode('latin1')
        if c==b'/':
            j=i+1
            while j<n and s[j:j+1] not in b' \t\r\n<>[]()/': j+=1
            t=s[i:j].decode(); i=j; return t
        j=i
        while j<n and s[j:j+1] not in b' \t\r\n<>[]()/': j+=1
        t=s[i:j].decode(); i=j
        if t=='true': return True
        if t=='false': return False
        try: return int(t)
        except:
            try: return float(t)
            except: return t
    return val()
def g(d,*path):
    for p in path:
        try: d=d[p]
        except Exception: return None
    return d
