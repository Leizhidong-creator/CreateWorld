"""Conservative raster navigation for a finite rectangular foot body.

Pixels touched by the full swept body must all be walkable. The 4px grid
can reject unusually narrow routes; it never treats a point route as body proof.
"""
from array import array
from collections import deque
import math

def check_body(mask, anchors, footprint, step=4):
    if not isinstance(anchors,list) or any(not isinstance(a,dict) or not isinstance(a.get('id'),str) or not a['id'].strip() or any(type(a.get(k)) not in (int,float) or not math.isfinite(a[k]) for k in ('x','y')) for a in anchors):
        raise ValueError('body anchors require nonempty id and finite numeric coordinates')
    if type(step) is not int or step<1 or step>16:
        raise ValueError('navigation step must be an integer from 1 to 16')
    if not isinstance(footprint,dict) or any(type(footprint.get(k)) not in (int,float) or not math.isfinite(footprint[k]) or not 0<footprint[k]<=128 for k in ('width','height')) or footprint.get('foot_inset',0)!=0:
        raise ValueError('foot_body requires finite width/height in (0,128] and foot_inset=0')
    width,height=mask.size; stride=width+1
    # Summed-area table counts blocked pixels. All edges are checked continuously
    # in this raster, including cells between neighbouring grid samples.
    pixels=mask.load(); prefix=array('I',[0])*((height+1)*stride)
    for y in range(height):
        total=0; row=(y+1)*stride; previous=y*stride
        for x in range(width):
            total+=int(pixels[x,y]==0)
            prefix[row+x+1]=prefix[previous+x+1]+total
    def clear(a,b):
        left=math.floor(min(a[0],b[0])-footprint['width']/2)
        right=math.ceil(max(a[0],b[0])+footprint['width']/2)
        top=math.floor(min(a[1],b[1])-footprint['height'])
        bottom=math.ceil(max(a[1],b[1]))
        if left<0 or top<0 or right>=width or bottom>=height:return False
        total=prefix[(bottom+1)*stride+right+1]-prefix[top*stride+right+1]-prefix[(bottom+1)*stride+left]+prefix[top*stride+left]
        return total==0
    def neighbors_of(p):
        return {(int(c),int(r)) for c in (math.floor(p[0]/step),math.ceil(p[0]/step)) for r in (math.floor(p[1]/step),math.ceil(p[1]/step))}
    def connect(p,cell):
        q=(cell[0]*step,cell[1]*step)
        return any(clear(p,via) and clear(via,q) for via in ((q[0],p[1]),(p[0],q[1])))
    blocked=[a['id'] for a in anchors if not clear((a['x'],a['y']),(a['x'],a['y']))]
    if not anchors:return dict(passed=True,blockedAnchors=[],unreachableAnchors=[],reachableCells=0,scope='no anchors supplied')
    spawn=next((a for a in anchors if a.get('kind')=='spawn'),anchors[0]);p=(spawn['x'],spawn['y'])
    seen={c for c in neighbors_of(p) if connect(p,c)}; queue=deque(seen)
    while queue:
        x,y=queue.popleft()
        for cell in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if cell in seen:continue
            if clear((x*step,y*step),(cell[0]*step,cell[1]*step)):
                seen.add(cell);queue.append(cell)
    missing=[]
    for a in anchors:
        p=(a['x'],a['y'])
        if not any(c in seen and connect(p,c) for c in neighbors_of(p)):missing.append(a['id'])
    return dict(passed=not blocked and not missing,blockedAnchors=blocked,unreachableAnchors=missing,reachableCells=len(seen),gridStep=step,scope='full rectangular foot-body, conservative 1px raster, swept axis-aligned 4px navigation; engine integration still required')
