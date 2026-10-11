from PIL import Image, ImageDraw, ImageFont
import random
S=1024; NAVY=(27,35,64,255); INK=(27,35,64,255); M='/home/user/ur-live/docs/design/assets/mascot/'; F='poppins800.woff2'
def word(bg,size,cx,cy,color,dot):
    d=ImageDraw.Draw(bg); f=ImageFont.truetype(F,size); t='urdeal'; xs=[]; x=0
    for ch in t: xs.append(x); x+=d.textlength(ch,font=f)-size*0.035
    ds=size*0.18; total=x+size*0.08+ds; b=d.textbbox((0,0),t,font=f)
    x0=cx-total/2; base=cy+(b[3]-b[1])/2; top=base-b[3]
    for ch,ox in zip(t,xs): d.text((x0+ox,top),ch,font=f,fill=color)
    dx=x0+x+size*0.08; d.ellipse((dx,base-ds,dx+ds,base),fill=dot)
def qr(d,x,y,size,color=INK,n=21):
    c=size/n; random.seed(7)
    def mod(i,j): d.rectangle((x+i*c,y+j*c,x+(i+1)*c-0.5,y+(j+1)*c-0.5),fill=color)
    def finder(i0,j0):
        for i in range(7):
            for j in range(7):
                if i in(0,6) or j in(0,6) or (2<=i<=4 and 2<=j<=4): mod(i0+i,j0+j)
    for i in range(n):
        for j in range(n):
            inF=(i<8 and j<8) or (i>n-9 and j<8) or (i<8 and j>n-9)
            if not inF and random.random()<0.48: mod(i,j)
    finder(0,0); finder(n-7,0); finder(0,n-7)
def face(name,w,bottom,cut):
    f=Image.open(M+name+'.png').convert('RGBA'); f=f.crop(f.getbbox()); f=f.crop((0,0,f.width,int(f.height*cut)))
    r=w/f.width; return f.resize((w,int(f.height*r)),Image.LANCZOS), bottom
def ticket(b,x0,y0,x1,y1,stub,word_size,qr_size):
    t=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(t)
    d.rounded_rectangle((x0,y0,x1,y1),radius=44,fill=(255,255,255,255)); cy=(y0+y1)/2; r=40
    d.ellipse((x0-r,cy-r,x0+r,cy+r),fill=(0,0,0,0)); d.ellipse((x1-r,cy-r,x1+r,cy+r),fill=(0,0,0,0))
    sx=x1-stub
    for yy in range(int(y0+26),int(y1-26),30): d.line((sx,yy,sx,yy+14),fill=(207,211,216,255),width=5)
    b.alpha_composite(t); d=ImageDraw.Draw(b)
    qx=sx+(stub-qr_size)/2-10; qr(d,qx,cy-qr_size/2,qr_size)
    word(b,word_size,(x0+50+sx)/2,cy,INK,(28,105,239,255))
V={}
# Q1: 얼굴 조금 더(반다나까지), 티켓 아래 + QR 스텁
b=Image.new('RGBA',(S,S),NAVY); f,_=face('otter-face-happy',680,0,0.86); b.alpha_composite(f,(int(S/2-340),int(S*0.70-f.height)))
ticket(b,100,610,924,890,250,112,150); V['Q1']=b
# Q2: 유달이 더 크게 · 티켓 낮고 넓게
b=Image.new('RGBA',(S,S),NAVY); f,_=face('otter-face-happy',760,0,0.92); b.alpha_composite(f,(int(S/2-380),int(S*0.76-f.height)))
ticket(b,90,680,934,920,240,104,140); V['Q2']=b
# Q3: 윙크 버전 (Q1 구도)
b=Image.new('RGBA',(S,S),NAVY); f,_=face('otter-face-wink',680,0,0.86); b.alpha_composite(f,(int(S/2-340),int(S*0.70-f.height)))
ticket(b,100,610,924,890,250,112,150); V['Q3']=b
# Q4: 신난 얼굴 (Q2 구도)
b=Image.new('RGBA',(S,S),NAVY); f,_=face('otter-face-excited',760,0,0.92); b.alpha_composite(f,(int(S/2-380),int(S*0.76-f.height)))
ticket(b,90,680,934,920,240,104,140); V['Q4']=b
for k,v in V.items():
    v.save(f'{k}.png')
    for nm,shape in [('ios','r'),('circ','c')]:
        m=Image.new('L',(S,S),0); dr=ImageDraw.Draw(m)
        (dr.rounded_rectangle((0,0,S,S),radius=int(S*0.2237),fill=255) if shape=='r' else dr.ellipse((0,0,S,S),fill=255))
        o=Image.new('RGBA',(S,S),(0,0,0,0)); o.paste(v,(0,0),m); o.save(f'{nm}-{k}.png')
L=[('P6','6 (지난 안)'),('Q1','6-A 얼굴 더 + QR'),('Q2','6-B 유달이 크게 + 티켓 아래로'),('Q3','6-C 윙크 + QR'),('Q4','6-D 신난 얼굴 + QR')]
others=['#FFCD00','#03C75A','#0064FF','#FF5A5A','#78787F','#FAFAFA']
def home(k,dark):
    tiles=''.join(f'<div style="width:60px;height:60px;border-radius:13px;background:{c}"></div>' if i!=4 else f'<div style="text-align:center"><img src="ios-{k}.png" style="width:60px;height:60px;display:block"><div style="font-size:11px;color:{"#fff" if dark else "#16181C"};margin-top:4px">유어딜</div></div>' for i,c in enumerate(others))
    bgc='linear-gradient(160deg,#2B3550,#1A2033)' if dark else 'linear-gradient(160deg,#E9E4F5,#F7F1EA)'
    return f'<div style="background:{bgc};border-radius:16px;padding:12px;display:grid;grid-template-columns:repeat(3,60px);gap:12px;justify-content:center;align-items:start">{tiles}</div>'
cells=''.join(f'<div class=c><img src="ios-{k}.png" width=220><div class=lab>{n}</div>{home(k,True)}{home(k,False)}<div style="display:flex;gap:12px;align-items:center"><img src="circ-{k}.png" width=80><img src="circ-{k}.png" width=44></div></div>' for k,n in L)
open('q-board.html','w').write(f'''<html><head><meta charset=utf-8><style>body{{font-family:'Pretendard','Noto Sans KR',sans-serif;background:#F8F7FC;color:#16181C;padding:24px;width:1500px;margin:0}}
.g{{display:grid;grid-template-columns:repeat(5,1fr);gap:24px}}.c{{display:flex;flex-direction:column;gap:12px;align-items:flex-start}}.lab{{font-size:15px;font-weight:700}}h3{{margin:0 0 18px;font-size:20px}}</style></head><body>
<h3>앱 아이콘 6번 발전 — 티켓 오른쪽에 QR · 유달이 더 보이게</h3><div class=g>{cells}</div></body></html>''')
