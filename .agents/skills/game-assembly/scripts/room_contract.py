"""Validate the explicit canvas-room-v1 backend without evaluating input code."""
import hashlib
import math
import re
import struct
import itertools
from collections import deque
from pathlib import Path
from assembly_core import no_links, safe_relative

FLAGS = {'briefed','powerReady','guidanceReady','eggHumor','eggRain'}
DIRECTIONS = {'up','down','left','right'}


def geometry_check(room):
    """Conservative 4 px navigation grid with swept full-body edges."""
    body=room['player']['body'];floor=room['walkable'];step=4
    obstacles=room['obstacles']+[{'x':n['x']-n['body']['width']/2,'y':n['y']-n['body']['height'],'width':n['body']['width'],'height':n['body']['height']} for n in room['npcs']]
    def overlap(a,b):return a[0]<b['x']+b['width']-1e-7 and a[2]>b['x']+1e-7 and a[1]<b['y']+b['height']-1e-7 and a[3]>b['y']+1e-7
    def clear(a,b):
        # Grid edges are axis aligned, so the union box is the exact swept shape.
        box=(min(a[0],b[0])-body['width']/2,min(a[1],b[1])-body['height'],max(a[0],b[0])+body['width']/2,max(a[1],b[1]))
        return box[0]>=floor['x']-1e-7 and box[1]>=floor['y']-1e-7 and box[2]<=floor['x']+floor['width']+1e-7 and box[3]<=floor['y']+floor['height']+1e-7 and not any(overlap(box,r) for r in obstacles)
    origin=(floor['x']+body['width']/2,floor['y']+body['height'])
    cols=int((floor['width']-body['width'])//step)+1;rows=int((floor['height']-body['height'])//step)+1
    spawn=(room['spawn']['x'],room['spawn']['y']);seen=set();queue=deque()
    for col in {math.floor((spawn[0]-origin[0])/step),math.ceil((spawn[0]-origin[0])/step)}:
        for row in {math.floor((spawn[1]-origin[1])/step),math.ceil((spawn[1]-origin[1])/step)}:
            pos=(origin[0]+col*step,origin[1]+row*step);via=(pos[0],spawn[1])
            if 0<=col<cols and 0<=row<rows and clear(spawn,via) and clear(via,pos):seen.add((col,row));queue.append((col,row))
    while queue:
        col,row=queue.popleft();pos=(origin[0]+col*step,origin[1]+row*step)
        for dc,dr in ((1,0),(-1,0),(0,1),(0,-1)):
            next_col,next_row=col+dc,row+dr
            if not 0<=next_col<cols or not 0<=next_row<rows or (next_col,next_row) in seen:continue
            target=(origin[0]+next_col*step,origin[1]+next_row*step)
            if clear(pos,target):seen.add((next_col,next_row));queue.append((next_col,next_row))
    def sight(a,b,r):
        near,far=0,1
        for index,key,size in ((0,'x','width'),(1,'y','height')):
            delta=b[index]-a[index];low,high=r[key],r[key]+r[size]
            if abs(delta)<1e-10:
                if a[index]<=low or a[index]>=high:return True
                continue
            u,v=(low-a[index])/delta,(high-a[index])/delta;near=max(near,min(u,v));far=min(far,max(u,v))
            if near>=far:return True
        return not(near<1-1e-6 and far>1e-6)
    targets=room['npcs']+room['hotspots'];selectable=set()
    for col,row in seen:
        pos=(origin[0]+col*step,origin[1]+row*step);candidates=[]
        for target in targets:
            dest=(target['x'],target['y']);distance=math.dist(pos,dest)
            if distance<=target['range'] and all(sight(pos,dest,r) for r in room['obstacles']):candidates.append((distance,target['id']))
        if candidates:selectable.add(min(candidates)[1])
        if len(selectable)==len(targets):break
    missing=[t['id'] for t in targets if t['id'] not in selectable]
    return {'gridStep':step,'reachablePositions':len(seen),'unreachableInteractions':missing,'scope':'full-body swept navigation and actual nearest-target selection, conservative grid'}


def power_solution(config):
    def rotate(mask,r):
        for _ in range(r):mask=((mask<<1)&15)|((mask>>3)&1)
        return mask
    def solved(rotations):
        masks=[rotate(t['mask'],r) for t,r in zip(config['tiles'],rotations)];n=config['size'];start=config['start']['row']*n+config['start']['col'];goal=config['goal']['row']*n+config['goal']['col']
        if not masks[start]&config['start']['port'] or not masks[goal]&config['goal']['port']:return False
        queue=[start];seen={start}
        for i in queue:
            if i==goal:return True
            for dr,dc,p,q in ((-1,0,1,4),(0,1,2,8),(1,0,4,1),(0,-1,8,2)):
                r,c=i//n+dr,i%n+dc;j=r*n+c
                if 0<=r<n and 0<=c<n and masks[i]&p and masks[j]&q and j not in seen:seen.add(j);queue.append(j)
        return False
    initial=[t['rotation'] for t in config['tiles']]
    if solved(initial):raise ValueError('power puzzle is already solved before player input')
    choices=[]
    for tile in config['tiles']:
        if tile['locked']:choices.append([tile['rotation']]);continue
        representatives={}
        for r in range(4):representatives.setdefault(rotate(tile['mask'],r),r)
        choices.append(list(representatives.values()))
    for count,rotations in enumerate(itertools.product(*choices),1):
        if count>250000:raise ValueError('power solvability unknown: state budget exhausted')
        if solved(rotations):return {'examinedStates':count,'solution':list(rotations)}
    raise ValueError('power puzzle has no legal solution')


def check_room(room, source_dir, check_media=True):
    errors, warnings = [], []
    def need(condition, text):
        if not condition: raise ValueError(text)
    def number(value): return type(value) in (int,float) and math.isfinite(value)
    def ident(value): return isinstance(value,str) and re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',value)
    def text(value): return isinstance(value,str) and bool(value.strip())
    def rect(value,label):
        need(isinstance(value,dict) and all(number(value.get(k)) for k in ('x','y','width','height')),label+' requires finite rectangle')
        need(value['width']>0 and value['height']>0 and value['x']>=0 and value['y']>=0 and value['x']+value['width']<=room['width'] and value['y']+value['height']<=room['height'],label+' out of room bounds')
    def body(value,label):
        need(isinstance(value,dict) and all(number(value.get(k)) and 4<=value[k]<=100 for k in ('width','height')),label+' body must be 4..100 pixels')
    def indexed(items,label,maximum=64):
        need(isinstance(items,list) and 1<=len(items)<=maximum,label+' requires bounded nonempty array')
        out={}
        for item in items:
            need(isinstance(item,dict) and ident(item.get('id')),label+' invalid ID')
            need(item['id'] not in out,label+' duplicate ID');out[item['id']]=item
        return out
    try:
        need(isinstance(room,dict),'room must be an object')
        need(type(room.get('schemaVersion')) is int and room['schemaVersion']==1 and room.get('backend')=='canvas-room-v1','unsupported room schema/backend')
        need(ident(room.get('id')) and text(room.get('title')) and text(room.get('subtitle')),'room identity/title/subtitle required')
        need(all(type(room.get(k)) is int and 128<=room[k]<=2048 for k in ('width','height')),'room dimensions must be integer 128..2048')
        rect(room.get('walkable'),'walkable')
        obstacles=room.get('obstacles');need(isinstance(obstacles,list) and len(obstacles)<=64,'obstacles must be bounded rectangle array')
        obstacle_ids=set()
        for obstacle in obstacles:
            rect(obstacle,'obstacle');need(ident(obstacle.get('id')) and obstacle['id'] not in obstacle_ids,'obstacle ID invalid/duplicate');obstacle_ids.add(obstacle['id'])
        player=room.get('player');need(isinstance(player,dict) and text(player.get('name')),'player required');body(player.get('body'),'player')
        need(number(player.get('speed')) and 20<=player['speed']<=400,'player speed must be 20..400 pixels/second')
        spawn=room.get('spawn');need(isinstance(spawn,dict) and all(number(spawn.get(k)) for k in ('x','y')) and spawn.get('direction') in DIRECTIONS,'spawn invalid')
        characters=indexed(room.get('characters'),'characters',17)
        for char in characters.values():
            cell=char.get('cell');anchor=char.get('footAnchor');sheets=char.get('sheets')
            need(isinstance(cell,dict) and all(type(cell.get(k)) is int and 8<=cell[k]<=256 for k in ('width','height')),'character cell invalid')
            need(isinstance(anchor,dict) and all(number(anchor.get(k)) for k in ('x','y')) and 0<=anchor['x']<=cell['width'] and 0<=anchor['y']<=cell['height'],'foot anchor invalid')
            need(number(char.get('scale')) and 0.5<=char['scale']<=4 and number(char.get('frameMs')) and 40<=char['frameMs']<=1000,'character scale/frame interval invalid')
            need(isinstance(sheets,dict) and set(sheets)==DIRECTIONS,'character requires exactly four direction sheets')
            for path in sheets.values(): safe_relative(path)
        need(player.get('characterId') in characters,'player character not declared')
        npcs=indexed(room.get('npcs'),'npcs',16)
        for npc in npcs.values():
            need(text(npc.get('name')) and npc.get('characterId') in characters,'NPC name/character invalid');body(npc.get('body'),'NPC')
            need(all(number(npc.get(k)) for k in ('x','y','range')) and 24<=npc['range']<=160 and npc.get('direction') in DIRECTIONS,'NPC position/range/direction invalid')
        dialogues=indexed(room.get('dialogues'),'dialogues')
        for dialogue in dialogues.values():
            branches=indexed(dialogue.get('branches'),'dialogue branches',32)
            for branch in branches.values():
                when=branch.get('when');need(isinstance(when,dict) and all(k in FLAGS and type(v) is bool for k,v in when.items()),'dialogue condition invalid')
                lines=branch.get('lines');need(isinstance(lines,list) and 1<=len(lines)<=30 and all(isinstance(line,dict) and text(line.get('speaker')) and text(line.get('text')) and len(line['text'])<=600 for line in lines),'dialogue lines invalid')
                effects=branch.get('setFlags',[]);need(isinstance(effects,list) and len(effects)<=1 and all(f=='briefed' for f in effects),'dialogue can only set briefed')
            need(any(not b['when'] for b in branches.values()),'dialogue needs an unconditional fallback')
        for npc in npcs.values(): need(npc.get('dialogueId') in dialogues,'NPC dialogue missing')
        hotspots=indexed(room.get('hotspots'),'hotspots',32)
        need(not set(npcs).intersection(hotspots),'NPC and hotspot IDs must be globally unique')
        counts={k:0 for k in ('power','guidance','egg','exit')};eggs=set()
        for hot in hotspots.values():
            need(hot.get('kind') in counts and text(hot.get('label')),'hotspot kind/label invalid');counts[hot['kind']]+=1
            need(all(number(hot.get(k)) for k in ('x','y','range')) and 24<=hot['range']<=160,'hotspot location/range invalid')
            need(isinstance(hot.get('requires'),list) and all(f in FLAGS for f in hot['requires']) and text(hot.get('lockedText')),'hotspot requires/lockedText invalid')
            if hot['kind']=='egg':
                need(hot.get('eggFlag') in ('eggHumor','eggRain') and hot['eggFlag'] not in eggs,'eggFlag invalid/duplicate');eggs.add(hot['eggFlag'])
                need(hot.get('dialogueId') in dialogues,'egg dialogue missing')
            if hot['kind'] in ('power','guidance'): need('briefed' in hot['requires'],'devices must require briefing')
            if hot['kind']=='exit': need(not any(f.startswith('egg') for f in hot['requires']),'eggs cannot gate the exit')
        need(all(counts[k]==1 for k in ('power','guidance','exit')),'one power/guidance/exit hotspot required')
        need(isinstance(room.get('ending'),dict) and text(room['ending'].get('title')) and text(room['ending'].get('text')),'ending text required')
        modules=room.get('modules');need(isinstance(modules,dict),'modules required')
        power=modules.get('power');need(isinstance(power,dict) and power.get('size') in (2,3),'power grid size must be 2 or 3')
        tiles=power.get('tiles');need(isinstance(tiles,list) and len(tiles)==power['size']**2,'power tile count invalid')
        for tile in tiles: need(isinstance(tile,dict) and type(tile.get('mask')) is int and 1<=tile['mask']<=15 and type(tile.get('rotation')) is int and 0<=tile['rotation']<=3 and type(tile.get('locked')) is bool,'power tile invalid')
        for label in ('start','goal'):
            endpoint=power.get(label);need(isinstance(endpoint,dict) and all(type(endpoint.get(k)) is int and 0<=endpoint[k]<power['size'] for k in ('row','col')) and type(endpoint.get('port')) is int and endpoint['port'] in (1,2,4,8),'power endpoint invalid')
        need(power['start']!=power['goal'],'power endpoints must differ')
        guidance=modules.get('guidance');need(isinstance(guidance,dict),'guidance module required')
        for key in ('initialAngle','initialVelocity','targetAngle','thrust','brake','angleTolerance','speedTolerance','holdSeconds','timeLimit'):need(number(guidance.get(key)),'guidance number required: '+key)
        need(all(-180<=guidance[k]<=180 for k in ('initialAngle','targetAngle')) and abs(guidance['initialVelocity'])<=120,'guidance initial values invalid')
        need(1<=guidance['thrust']<=200 and 1<=guidance['brake']<=300 and 1<=guidance['angleTolerance']<=15 and 0.1<=guidance['speedTolerance']<=10 and guidance['holdSeconds']==1 and 10<=guidance['timeLimit']<=120,'guidance limits invalid')
        wrap=lambda angle:(angle+180)%360-180
        need(abs(wrap(guidance['initialAngle']-guidance['targetAngle']))>guidance['angleTolerance'],'guidance must require actual input')
        angle=guidance['initialAngle'];hold=0
        for _ in range(math.ceil(guidance['timeLimit']*60)):
            angle=wrap(angle+guidance['initialVelocity']/60)
            hold=hold+1 if abs(wrap(angle-guidance['targetAngle']))<=guidance['angleTolerance'] and abs(guidance['initialVelocity'])<=guidance['speedTolerance'] else 0
            need(hold<60,'guidance can complete with no player input')
        # Body geometry includes static NPCs, independently of drawn sprite bounds.
        def box(actor,body):return {'x':actor['x']-body['width']/2,'y':actor['y']-body['height'],'width':body['width'],'height':body['height']}
        def overlaps(a,b):return a['x']<b['x']+b['width']-1e-7 and a['x']+a['width']>b['x']+1e-7 and a['y']<b['y']+b['height']-1e-7 and a['y']+a['height']>b['y']+1e-7
        npc_boxes=[box(n,n['body']) for n in npcs.values()];floor=room['walkable']
        for i,npc_box in enumerate(npc_boxes):
            rect(npc_box,'NPC body');need(not any(overlaps(npc_box,r) for r in obstacles+npc_boxes[:i]),'NPC overlaps obstacle or another NPC')
            need(npc_box['x']>=floor['x'] and npc_box['y']>=floor['y'] and npc_box['x']+npc_box['width']<=floor['x']+floor['width'] and npc_box['y']+npc_box['height']<=floor['y']+floor['height'],'NPC body outside walkable')
        spawn_box=box(spawn,player['body']);floor=room['walkable']
        need(spawn_box['x']>=floor['x'] and spawn_box['y']>=floor['y'] and spawn_box['x']+spawn_box['width']<=floor['x']+floor['width'] and spawn_box['y']+spawn_box['height']<=floor['y']+floor['height'],'spawn body outside walkable')
        need(not any(overlaps(spawn_box,r) for r in obstacles+npc_boxes),'spawn intersects obstacle or NPC')
        assets=room.get('assets');need(isinstance(assets,dict),'assets required');safe_relative(assets.get('background'))
        expected={assets['background']}|{p for c in characters.values() for p in c['sheets'].values()}
        media=room.get('media');need(isinstance(media,list) and 1<=len(media)<=100,'media manifest required')
        media_paths=set()
        for item in media:
            need(isinstance(item,dict),'media entry invalid');path=safe_relative(item.get('path'))
            need(path.lower().endswith('.png') and path.lower() not in media_paths,'media must be unique PNG paths');media_paths.add(path.lower())
            need(isinstance(item.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',item['sha256']),'media SHA256 required')
            if check_media:
                source=no_links(Path(source_dir)/path);need(source.is_file() and source.stat().st_size<=20*1024*1024,'media missing/oversize: '+path);raw=source.read_bytes()
                need(hashlib.sha256(raw).hexdigest()==item['sha256'],'media hash mismatch: '+path)
                need(len(raw)>=33 and raw[:8]==b'\x89PNG\r\n\x1a\n' and raw[12:16]==b'IHDR','invalid PNG header: '+path)
                w,h=struct.unpack('>II',raw[16:24])
                if path==assets['background']:need((w,h)==(room['width'],room['height']),'background dimensions differ from world coordinates')
                for char in characters.values():
                    if path in char['sheets'].values():need((w,h)==(char['cell']['width']*4,char['cell']['height']),'sprite sheet dimensions differ from four-frame contract')
        need({p.lower() for p in expected}==media_paths,'media list must exactly cover background and all direction sheets')
        geometry=geometry_check(room)
        need(not geometry['unreachableInteractions'],'full-body navigation cannot reach: '+','.join(geometry['unreachableInteractions']))
        solution=power_solution(power)
        warnings.append('PNG header/dimensions do not prove decoding. Browser loading and visual review remain required.')
    except (ValueError,TypeError,KeyError,AttributeError) as exc:errors.append(str(exc))
    return {'skill':'game-assembly','backend':'canvas-room-v1','passed':not errors,'errors':errors,'warnings':warnings,
            'geometry':locals().get('geometry'),'powerModel':locals().get('solution')}
