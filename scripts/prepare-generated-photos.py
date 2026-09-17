"""One-time import of approved generated menu photos; deployed pages use local WebP only."""
from pathlib import Path
from PIL import Image,ImageOps,ImageFilter,ImageDraw
import urllib.request,json,io,hashlib
root=Path(__file__).resolve().parents[1];dest=root/'public/images/products';dest.mkdir(parents=True,exist_ok=True)
batches=[
 ('https://d8j0ntlcm91z4.cloudfront.net/user_3CpFEvxerpl4o5efok2zUSBMeRV/hf_20260917_183520_a0ece7a1-0f28-49f6-a3dc-33561c028b5e.png',[15,16,17,18,19,20,21,23,25],3),
 ('https://d8j0ntlcm91z4.cloudfront.net/user_3CpFEvxerpl4o5efok2zUSBMeRV/hf_20260917_183520_89a31465-f129-4cbb-85b5-3a904d187e9c.png',[27,28,29,30,31,32,33,34,35],3),
 ('https://d8j0ntlcm91z4.cloudfront.net/user_3CpFEvxerpl4o5efok2zUSBMeRV/hf_20260917_183520_96269cdf-9534-471f-94ee-a4631c65c3b4.png',[36,37,38,39,40,41,42,43,44],3),
 ('https://d8j0ntlcm91z4.cloudfront.net/user_3CpFEvxerpl4o5efok2zUSBMeRV/hf_20260917_183521_799c703f-0a29-4bc1-bef2-7dba31059705.png',[45,46,48,49,50,51,52,54,55],3),
 ('https://d8j0ntlcm91z4.cloudfront.net/user_3CpFEvxerpl4o5efok2zUSBMeRV/hf_20260917_183521_4937273f-3ab5-401a-b5ba-5d3c300c4949.png',[53,56,57,58],2)
]
report=root/'test-results/photos';report.mkdir(parents=True,exist_ok=True)
for bi,(url,ids,n) in enumerate(batches):
 request=urllib.request.Request(url,headers={'User-Agent':'FanFood-Asset-Import/2'})
 with urllib.request.urlopen(request,timeout=90) as response: data=response.read(30_000_000)
 im=Image.open(io.BytesIO(data)).convert('RGB');w,h=im.size
 assert w>=1500 and h>=1500,(w,h)
 im.save(report/f'grid-{bi+1}.jpg',quality=90)
 for i,pid in enumerate(ids):
  if pid in (41,54):continue # Use the restaurant's own photos for these two products.
  row,col=divmod(i,n);tile=im.crop((round(col*w/n)+6,round(row*h/n)+6,round((col+1)*w/n)-6,round((row+1)*h/n)-6))
  bg=ImageOps.fit(tile,(720,540)).filter(ImageFilter.GaussianBlur(18));fg=ImageOps.contain(tile,(720,540),Image.Resampling.LANCZOS)
  bg.paste(fg,((720-fg.width)//2,(540-fg.height)//2));bg.save(dest/f'p{pid:03}.webp',quality=86,method=6)
m=json.loads((root/'src/data/menu.json').read_text());hashes=[]
contact=Image.new('RGB',(6*250,10*220),'#f8f4e7');d=ImageDraw.Draw(contact)
for i,p in enumerate(m['products']):
 file=root/'public'/p['image'].lstrip('/');assert file.is_file(),p['id']
 hashes.append(hashlib.sha256(file.read_bytes()).hexdigest())
 tile=Image.open(file);tile.thumbnail((244,183));x=(i%6)*250;y=(i//6)*220
 contact.paste(tile,(x+3,y+20));d.text((x+8,y+4),p['id']+(' - illustration' if p['imageRepresentative'] else ' - restaurant photo'),fill='#1f3a29')
assert len(set(hashes))==58,'Images must be unique per product'
contact.save(report/'all-58-products.jpg',quality=90)
print('Prepared 58 distinct product photos; local WebP bytes:',sum(x.stat().st_size for x in dest.glob('*.webp')))
