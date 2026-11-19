"""Creates original, code-native SVG pixel art and small WAV sound fixtures. No remote inputs."""
from pathlib import Path
import math,wave,struct
root=Path(__file__).resolve().parents[1]/'assets'
root.mkdir(exist_ok=True)
colors=[('traveler','#26383e','#dfb783','#a0a38d','#e8ddad'),('keeper','#393839','#caa676','#779080','#d3b465'),('archivist','#3e3034','#d8b994','#91716a','#c6ad87')]
for name,hair,skin,coat,scarf in colors:
    parts=['<svg xmlns="http://www.w3.org/2000/svg" width="48" height="96" viewBox="0 0 48 96" shape-rendering="crispEdges">']
    for row in range(4):
        for frame in range(3):
            ox=frame*16;oy=row*24
            def rect(x,y,w,h,c):parts.append(f'<rect x="{ox+x}" y="{oy+y}" width="{w}" height="{h}" fill="{c}"/>')
            bob=1 if frame==1 else 0
            rect(4,2+bob,8,7,hair);rect(3,4+bob,10,4,hair)
            if row!=3:
                rect(5 if row!=1 else 4,5+bob,7,5,skin)
                rect(5,3+bob,7,3,hair)
                if row==0:rect(6,7+bob,1,1,'#1c2529');rect(10,7+bob,1,1,'#1c2529')
                else:rect(5 if row==1 else 11,7+bob,1,1,'#1c2529')
            rect(5,10+bob,7,9,coat);rect(4,11+bob,9,6,coat)
            rect(5,10+bob,7,2,scarf);rect(10,11+bob,2,5,scarf)
            rect(3,13+bob,2,5,skin);rect(12,13+bob,2,5,skin)
            rect(5,19,3,3+(frame==0),'#25323b');rect(9,19,3,3+(frame==2),'#25323b')
            rect(4,22+(frame==0),4,1,'#16232a');rect(9,22+(frame==2),4,1,'#16232a')
    parts.append('</svg>');(root/(name+'.svg')).write_text(''.join(parts))
(root/'joystick-base.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#12262cd9" stroke="#b2aa80" stroke-width="2"/><circle cx="64" cy="64" r="49" fill="none" stroke="#b2aa8033" stroke-width="1"/><path d="M64 16v10M64 102v10M16 64h10M102 64h10" stroke="#d2c095" stroke-width="3"/></svg>')
(root/'joystick-knob.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#9a9c78" stroke="#e5d5a2" stroke-width="3"/><circle cx="32" cy="32" r="20" fill="#6e806c"/><circle cx="32" cy="32" r="4" fill="#d8c99c"/></svg>')
(root/'icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#152a32" d="M0 0h32v32H0z"/><path fill="#dbb877" d="M10 5h12v4H10zM8 10h16v12H8zM12 23h8v4h-8z"/><path fill="#fff3c9" d="M13 12h6v8h-6z"/></svg>')
rate=22050
for name,duration,notes,volume in [('tap',.09,[440],.14),('notice',.35,[440,660],.2),('success',.7,[392,494,587,784],.18),('ambient',8,[196,246.94,293.66,392],.08)]:
    frames=[]
    for i in range(int(rate*duration)):
        t=i/rate
        if name=='ambient':
            fade=min(1,t/.7,(duration-t)/.7)
            v=sum(math.sin(2*math.pi*f*t)*(.5+.5*math.sin(2*math.pi*t/8+j)) for j,f in enumerate(notes))/len(notes)*fade
        else:
            index=min(len(notes)-1,int(t/duration*len(notes)));phase=(t%(duration/len(notes)))/(duration/len(notes));v=math.sin(2*math.pi*notes[index]*t)*math.sin(math.pi*phase)**2
        frames.append(struct.pack('<h',int(max(-1,min(1,v*volume))*32767)))
    with wave.open(str(root/(name+'.wav')),'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes(b''.join(frames))
print('Generated original SVG art and audio in assets/')
