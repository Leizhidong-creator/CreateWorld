"""Verify a canvas-room-v1 candidate and supplied real-input report without executing it."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from assembly_core import no_links, safe_relative
from runtime_core import load_bundle, emit_report

FIXED = {'index.html', 'runtime.js', 'style.css', 'room-data.js'}
FLAGS = ('briefed','powerReady','guidanceReady','eggHumor','eggRain','finished')
CHECKS = ('desktopFullScene','helpOverlay','assetDecode','threeNpcs','twoEggs','deviceGate',
          'dialogueCancelAndFocus','dialogueCancelKeyboard','threeNpcDialogues',
          'powerRejectsWrongRoute','powerRealControls','pauseFreezesSimulation',
          'guidanceRealControls','saveRestore','invalidSaveRejected','endingWithoutEggs',
          'restart','eggDiscoveries','collisionRealInput','mobileLayout','touchHoldRelease',
          'wallOcclusion','foregroundOcclusion')
SCREENSHOTS = {'room-after-briefing.png','power-puzzle.png','guidance-training.png',
               'ending.png','optional-discoveries.png','mobile.png','wall-occlusion.png','furniture-occlusion.png'}


def digest(raw): return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition: raise ValueError(message)


def number(value): return type(value) in (int,float) and math.isfinite(value)


def check_observation(room, state, fingerprint):
    require(isinstance(state,dict) and state.get('fingerprint')==fingerprint,'observation fingerprint missing or stale')
    for key in ('started','paused','saveOpen','helpOpen'):
        require(type(state.get(key)) is bool,'observation boolean invalid: '+key)
    require(state.get('mode') in ('loading','explore','dialogue','power','guidance','ending'),'observation mode invalid')
    story=state.get('story')
    require(isinstance(story,dict) and set(story)==set(FLAGS) and all(type(story[f]) is bool for f in FLAGS),'observation story requires exact boolean flags')
    require(not (story['powerReady'] or story['guidanceReady']) or story['briefed'],'observation violates briefing gate')
    require(not story['finished'] or all(story[f] for f in ('briefed','powerReady','guidanceReady')),'observation violates ending gate')
    require(state['mode']!='ending' or story['finished'],'ending mode without finished story')
    player=state.get('player');body=room['player']['body'];floor=room['walkable']
    require(isinstance(player,dict) and all(number(player.get(k)) for k in ('x','y')) and player.get('direction') in ('up','down','left','right'),'observation player invalid')
    box={'x':player['x']-body['width']/2,'y':player['y']-body['height'],'width':body['width'],'height':body['height']}
    require(box['x']>=floor['x']-1e-6 and box['y']>=floor['y']-1e-6 and box['x']+box['width']<=floor['x']+floor['width']+1e-6 and box['y']+box['height']<=floor['y']+floor['height']+1e-6,'observed body outside walkable')
    obstacles=room['obstacles']+[{'x':n['x']-n['body']['width']/2,'y':n['y']-n['body']['height'],**n['body']} for n in room['npcs']]
    require(not any(box['x']<r['x']+r['width']-1e-6 and box['x']+box['width']>r['x']+1e-6 and box['y']<r['y']+r['height']-1e-6 and box['y']+box['height']>r['y']+1e-6 for r in obstacles),'observed body penetrates obstacle or NPC')
    require(type(state.get('historyLength')) is int and 0<=state['historyLength']<=2000,'observation history bound invalid')


def review_room(room_path, artifact_dir, evidence_path=None, require_runtime=False):
    result={'skill':'game-reviewer','backend':'canvas-room-v1','passed':False,'errors':[],'warnings':[],
            'artifactStatus':'unverified','runtimeStatus':'unverified','releaseReady':False,
            'evidenceAuthenticity':'not-authenticated-by-json',
            'scope':'Artifact identity and supplied observation consistency; no replacement for host execution, geometry unit tests, dialogue or visual review.'}
    try:
        room,fingerprint=load_bundle(room_path)
        require(isinstance(room,dict) and type(room.get('schemaVersion')) is int and room['schemaVersion']==1 and room.get('backend')=='canvas-room-v1','unsupported room format')
        result['bundleSha256']=fingerprint
        require(isinstance(room.get('media'),list) and bool(room['media']),'room media required')
        declared={}
        for item in room['media']:
            require(isinstance(item,dict),'room media record invalid');relative=safe_relative(item.get('path'))
            require(relative.lower() not in declared and relative.lower() not in FIXED|{'manifest.json'},'duplicate/reserved room media path')
            declared[relative.lower()]=item.get('sha256')
        expected=FIXED|set(declared)
        root=no_links(artifact_dir);manifest,manifest_hash=load_bundle(no_links(root/'manifest.json'))
        require(isinstance(manifest,dict) and type(manifest.get('schemaVersion')) is int and manifest['schemaVersion']==1 and manifest.get('backend')=='canvas-room-v1','manifest schema/backend invalid')
        require(manifest.get('bundleSha256')==fingerprint,'manifest belongs to different room version')
        require(manifest.get('status')=='candidate','manifest must remain candidate')
        entries=manifest.get('files');require(isinstance(entries,list) and 4<=len(entries)<=104,'manifest file list invalid')
        paths=set()
        for item in entries:
            require(isinstance(item,dict),'manifest file record invalid');relative=safe_relative(item.get('path'));key=relative.lower()
            require(key not in paths and key!='manifest.json','duplicate/reserved manifest path');paths.add(key)
            file=no_links(root/relative);require(file.is_file() and file.stat().st_size<=24*1024*1024,'manifest file missing or excessive: '+relative)
            require(digest(file.read_bytes())==item.get('sha256'),'manifest file hash mismatch: '+relative)
            if key in declared:require(item['sha256']==declared[key],'asset manifest disagrees with source room: '+relative)
        require(paths==expected,'manifest must contain exactly runtime files and declared room media')
        actual=set()
        for file in root.rglob('*'):
            no_links(file)
            if file.is_file():actual.add(file.relative_to(root).as_posix().lower())
        require(actual==paths|{'manifest.json'},'unexpected files outside immutable manifest')
        data=(root/'room-data.js').read_text(encoding='utf-8');prefix='window.__ROOM_DATA__='
        require(data.startswith(prefix) and data.rstrip().endswith(';'),'room-data.js serialization invalid')
        embedded=json.loads(data[len(prefix):].rstrip()[:-1])
        require(embedded=={**room,'fingerprint':fingerprint},'embedded room differs from source room')
        result.update(artifactStatus='hash-verified',manifestSha256=manifest_hash)
        if evidence_path:
            evidence,_=load_bundle(evidence_path)
            require(isinstance(evidence,dict) and type(evidence.get('schemaVersion')) is int and evidence['schemaVersion']==1,'browser evidence schema invalid')
            require(evidence.get('runner')=='playwright-canvas-room-v1' and evidence.get('status')=='passed','browser run failed or unknown runner')
            require(evidence.get('bundleSha256')==fingerprint and evidence.get('manifestSha256')==manifest_hash,'browser evidence is stale for this room/build')
            for key in ('pageErrors','consoleErrors','failures'):
                require(type(evidence.get(key)) is list and not evidence[key],key+' must be a collected empty array')
            checks=evidence.get('checks')
            require(isinstance(checks,dict) and all(checks.get(k) is True for k in CHECKS),'required runtime checks absent or not exact true booleans')
            require(all(v is True for v in checks.values()),'additional runtime check failed or was not boolean')
            require(len(room.get('npcs',[]))==3 and sum(h['kind']=='egg' for h in room.get('hotspots',[]))==2,'threeNpcs/twoEggs claims conflict with room')
            events=evidence.get('events');require(isinstance(events,list) and 6<=len(events)<=2000,'bounded nonempty observation events required')
            for event in events:
                require(isinstance(event,dict) and isinstance(event.get('type'),str),'event record invalid')
                check_observation(room,event.get('state'),fingerprint)
            require(events[0]['type']=='start' and not any(events[0]['state']['story'].values()),'trace must start in initial story state')
            require(events[-1]['type']=='complete' and evidence.get('finalState')==events[-1]['state'],'finalState differs from final observation')
            require(any(e['type']=='circuit-solved' and e['state']['story']['powerReady'] for e in events),'missing observed circuit completion')
            require(any(e['type']=='guidance-solved' and e['state']['story']['guidanceReady'] for e in events),'missing observed guidance completion')
            require(any(e['state']['story']['finished'] and not e['state']['story']['eggHumor'] and not e['state']['story']['eggRain'] for e in events),'missing observed no-egg ending')
            require(events[-1]['state']['story']['eggHumor'] and events[-1]['state']['story']['eggRain'],'missing observed optional discoveries')
            visited={e.get('id') for e in events if e['type']=='interact'}
            require(all(n['id'] in visited for n in room['npcs']),'missing NPC interaction observations')
            screenshots=evidence.get('screenshots');require(isinstance(screenshots,list) and 6<=len(screenshots)<=32,'required screenshots missing')
            evidence_root=no_links(Path(evidence_path).parent);names=set()
            for record in screenshots:
                require(isinstance(record,dict) and isinstance(record.get('path'),str),'screenshot record invalid')
                path=Path(record['path']);path=no_links(path if path.is_absolute() else evidence_root/path)
                require(path.is_relative_to(evidence_root),'screenshot escapes evidence directory')
                require(path.name not in names,'duplicate screenshot name');names.add(path.name)
                require(path.is_file() and path.stat().st_size<=24*1024*1024,'screenshot missing/oversized')
                raw=path.read_bytes();require(raw.startswith(b'\x89PNG\r\n\x1a\n') and digest(raw)==record.get('sha256'),'screenshot tampered or not PNG')
            require(SCREENSHOTS<=names,'required gameplay screenshots absent')
            result.update(runtimeStatus='evidence-consistent',observationsChecked=len(events),runtimeChecksChecked=len(checks))
            result['warnings'].append('JSON and screenshots can be fabricated. This result does not authenticate execution; retain the trusted host runner invocation/output. Visual quality, story fidelity and player enjoyment remain separate reviews.')
        else:result['warnings'].append('No browser report supplied. Runtime and playability remain unverified.')
        if require_runtime:require(result['runtimeStatus']=='evidence-consistent','required runtime evidence not verified')
    except (OSError,ValueError,TypeError,KeyError,AttributeError,RecursionError) as exc:result['errors'].append(str(exc))
    result['passed']=not result['errors']
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('room');parser.add_argument('--artifact-dir',required=True)
    parser.add_argument('--evidence');parser.add_argument('--require-runtime',action='store_true');parser.add_argument('--report');args=parser.parse_args()
    result=review_room(args.room,args.artifact_dir,args.evidence,args.require_runtime)
    return emit_report(result,args.room,args.report)


if __name__=='__main__':raise SystemExit(main())
