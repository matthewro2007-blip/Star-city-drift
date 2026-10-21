"""2.0.0 Blackriver: playable 2028 Silas art from Jack's silas_player HD strips (paint-over).
silas_c14 = orange C-14 prison jumpsuit (M0-4 + unlockable outfit), silas_red = new red suit (M5+).
Writes assets/sprites/silas_{c14,red}_hd_anim{,_wide}.png and adds both keys to anims_enemies.json. Run from the game root."""
import json,colorsys,numpy as np
from scipy import ndimage as nd
from PIL import Image,ImageDraw,ImageFont
PF=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',9)
def hsv(a):
    r,g,b=[a[...,i]/255. for i in range(3)];mx=np.max(a[...,:3],-1)/255.;mn=np.min(a[...,:3],-1)/255.;d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))/6;return h,d/(mx+1e-6),mx
def suit(f):
    a=np.array(f).astype(float);A=a[...,3]>10;h,s,v=hsv(a);H,W=A.shape;yy=np.arange(H)[:,None]*np.ones((1,W))
    hair=(s<0.12)&(v>0.35)&(yy<110)
    skin=A&(h<0.11)&(s>0.15)&(s<0.65)&(v>0.45)
    head=nd.binary_dilation(skin|hair,np.ones((7,7)))|(nd.binary_dilation(hair,np.ones((15,15)))&(yy<np.argmax((skin|hair).any(1)[::-1][::-1])+60))
    navy=A&(((h>0.5)&(h<0.75)&(s>0.12)&(v>0.2))|((s<0.18)&(v>0.3)&(v<0.9)))&~head
    tie=A&((h<0.03)|(h>0.97))&(s>0.72)&(v>0.45)
    ys_a=np.nonzero(A.any(1))[0];yb=ys_a.max()
    dark=A&(v<=0.22)&~head&~skin
    shoe=dark&(yy>yb-26)
    lab,n=nd.label(dark&~shoe);sz=nd.sum(np.ones_like(lab),lab,range(1,n+1))
    big=np.isin(lab,[i+1 for i in range(n) if sz[i]>3500])
    glove=dark&(s<0.2)&nd.binary_opening(dark&(s<0.2),np.ones((7,7)))
    navy=(navy|big)&~glove
    M=nd.binary_closing(navy|tie,np.ones((7,7)))&A&~skin&~hair&~glove   # swallow lapel/hem/tie ink lines
    # flat shading: heavy blur of luminance inside mask removes construction lines
    L=a[...,:3].mean(-1)/255.;Lb=nd.gaussian_filter(np.where(M,L,0),5)/(nd.gaussian_filter(M.astype(float),5)+1e-6)
    Lb=(Lb-Lb[M].min())/(np.ptp(Lb[M])+1e-6) if M.any() else Lb
    k=0.62+0.5*Lb;base=np.array([238,112,24.])
    out=a.copy()
    for i in range(3): out[...,i]=np.where(M,np.clip(base[i]*k,0,255),out[...,i])
    out[...,3]=np.where(M,255,out[...,3])
    edge=M&~nd.binary_erosion(M,np.ones((3,3)))&nd.binary_dilation(~M,np.ones((3,3)))
    out[edge]=[40,18,8,255]
    # leg seam: gap between legs keeps a dark line where original was ink
    out[hair,0]=np.clip(a[hair,0]*1.18+20,0,255);out[hair,1]=np.clip(a[hair,1]*1.18+19,0,255);out[hair,2]=np.clip(a[hair,2]*1.18+16,0,255)
    im=Image.fromarray(out.astype(np.uint8));d=ImageDraw.Draw(im)
    ys,xs=np.nonzero(M)
    if len(ys):
        y0=ys.min();top=xs[ys<y0+14];cx=int(np.median(top)) if len(top) else int(xs.mean())
        tieys,tiexs=np.nonzero(tie)
        if len(tiexs): cx=int(np.median(tiexs)); y0=int(tieys.min())+2
        hgt=ys.max()-ys.min()
        d.polygon([(cx-11,y0-2),(cx+11,y0-2),(cx,y0+12)],fill=(246,244,236),outline=(40,18,8))   # white undershirt collar
        z1=y0+int(hgt*0.42);d.line([(cx,y0+12),(cx,z1)],fill=(120,48,8),width=2)
        for yb in range(y0+18,z1,12): d.ellipse((cx-2,yb-2,cx+2,yb+2),fill=(250,210,150))
        d.line([(cx-3,z1),(cx+3,z1)],fill=(120,48,8),width=2)
        px=cx+9;py=y0+18
        if M[min(py+6,H-1),min(px+14,W-1)]:
            d.rectangle((px,py,px+28,py+13),fill=(244,240,228),outline=(40,18,8));d.text((px+2,py+1),'C-14',font=PF,fill=(20,20,20))
        wy=y0+int(hgt*0.38);row=np.nonzero(M[wy])[0]   # elastic waist band instead of a jacket belt/hem
    return im

def red(f):
    a=np.array(f).astype(float);A=a[...,3]>10;h,s,v=hsv(a);H,W=A.shape;yy=np.arange(H)[:,None]*np.ones((1,W))
    out=a.copy()
    hair=A&(yy<110)&(s<0.12)&(v>0.35)
    for i,m in enumerate((1.18*255,1.18*252,1.18*246)): out[...,i]=np.where(hair,np.clip(v*m+20,0,255),out[...,i])
    blue=A&(h>0.55)&(h<0.7)
    hb=blue&(yy<140)
    for i,m in enumerate((235,232,228)): out[...,i]=np.where(hb,v*m,out[...,i])
    suitm=blue&(s>0.25)&(v<0.6)&~hb
    vv=np.clip(v*1.35,0,1);r_,g_,b_=[np.vectorize(lambda q,j=j: colorsys.hsv_to_rgb(0.995,0.72,q)[j])(vv) for j in range(3)]
    for i,c in enumerate((r_,g_,b_)): out[...,i]=np.where(suitm,c*255,out[...,i])
    tie=A&((h<0.03)|(h>0.97))&(s>0.5)&~hair
    for i,c in enumerate((22,22,26)): out[...,i]=np.where(tie,c,out[...,i])
    return Image.fromarray(out.astype(np.uint8))

E=json.load(open('assets/sprites/anims_enemies.json'));SP=E['characters']['silas_player']
for tag,fn in (('c14',suit),('red',red)):
    imgs={};done=set();ch=json.loads(json.dumps(SP))
    for n,stt in ch['states'].items():
        if 'file' not in stt: continue
        files=stt['file'] if isinstance(stt['file'],list) else [stt['file']]*len(stt['sx'])
        for i,x in enumerate(stt['sx']):
            f=files[i]
            if f not in imgs: imgs[f]=(Image.open(f).convert('RGBA'),Image.new('RGBA',Image.open(f).size,(0,0,0,0)))
            src,dst=imgs[f]
            box=(x,stt['sy'][i],x+stt['sw'][i],stt['sy'][i]+stt['sh'][i])
            if (f,box) in done: continue
            done.add((f,box));dst.paste(fn(src.crop(box)),box[:2])
        rp=lambda f: f.replace('silas_player_hd','silas_'+tag+'_hd')
        stt['file']=[rp(f) for f in stt['file']] if isinstance(stt['file'],list) else rp(stt['file'])
    for f,(s_,d_) in imgs.items(): d_.save(f.replace('silas_player_hd','silas_'+tag+'_hd'),optimize=True)
    for k in ('file','wideFile'):
        if k in ch and ch[k]: ch[k]=ch[k].replace('silas_player','silas_'+tag)
    E['characters']['silas_'+tag]=ch
    print(tag,len(done),'cells')
json.dump(E,open('assets/sprites/anims_enemies.json','w'))
