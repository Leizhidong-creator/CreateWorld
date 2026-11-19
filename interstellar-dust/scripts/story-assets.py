from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[1]
# Characters are generated with character-generation; this script only maintains scene geometry.
# Refine geometry to the generated footprints. Image pixels and game coordinates are explicitly related.
geometries={'earth':[(80,60,240,175),(55,390,310,225),(480,75,180,135),(920,65,280,175),(960,400,130,65)],'room':[(45,65,80,160),(185,20,165,70),(470,60,125,80)]}
for name,obstacles in geometries.items():
 p=root/'assets'/name/'collision.json';s=json.loads(p.read_text());W,H=Image.open(p.parent/'scene.png').size
 ow,oh=(1280,720) if name=='earth' else (640,360);sx,sy=W/ow,H/oh
 s['coordinate_space']={'width':W,'height':H};s['metadata']['image_generation_calls']=1
 s['walkable'][0]['points']=[[12*sx,12*sy],[(ow-12)*sx,12*sy],[(ow-12)*sx,(oh-12)*sy],[12*sx,(oh-12)*sy]]
 s['obstacles']=[{'id':f'o{i}','shape':'rect','x':x*sx,'y':y*sy,'width':w*sx,'height':h*sy} for i,(x,y,w,h) in enumerate(obstacles)]
 anchor_points=[(400,340),(200,280),(400,480),(855,285),(925,305),(1025,495)] if name=='earth' else [(320,290),(210,145),(390,165),(520,155)]
 s['anchors']=[{'id':f'a{i}','kind':'spawn' if i==0 else 'interaction','x':x*sx,'y':y*sy} for i,(x,y) in enumerate(anchor_points)]
 # Slightly east of the corn, outside its final expanded footprint.
 if name=='earth':s['anchors'][2]['x']=400*sx
 p.write_text(json.dumps(s,indent=2))
