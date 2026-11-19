"""Build canvas-room-v1 into a new immutable offline directory."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from assembly_core import no_links,safe_relative
from runtime_core import load_bundle,emit_report
from room_contract import check_room


def build_room(room,fingerprint,source_dir,output):
    report=check_room(room,source_dir)
    if not report['passed']:raise ValueError('; '.join(report['errors']))
    target=no_links(output)
    if target.exists():raise ValueError('immutable output already exists')
    target.parent.mkdir(parents=True,exist_ok=True);no_links(target.parent);target.mkdir()
    template=Path(__file__).resolve().parents[1]/'assets'/'canvas-room'
    files=[]
    def write(path,data):
        dest=no_links(target/safe_relative(path));dest.parent.mkdir(parents=True,exist_ok=True)
        with dest.open('xb') as handle:handle.write(data)
        files.append({'path':path,'sha256':hashlib.sha256(data).hexdigest()})
    for name in ('index.html','style.css'):write(name,(template/name).read_bytes())
    engine=re.sub(r'^export ', '', (template/'engine.js').read_text(encoding='utf-8'), flags=re.M)
    runtime=re.sub(r'^import .*?;\s*', '', (template/'runtime.js').read_text(encoding='utf-8'), count=1)
    write('runtime.js',(engine+'\n'+runtime).encode('utf-8'))
    data={**room,'fingerprint':fingerprint}
    encoded=json.dumps(data,ensure_ascii=True,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    write('room-data.js',('window.__ROOM_DATA__='+encoded+';\n').encode('utf-8'))
    for item in room['media']:
        raw=no_links(Path(source_dir)/item['path']).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=item['sha256']:raise ValueError('media changed during build')
        write(item['path'],raw)
    manifest={'schemaVersion':1,'backend':'canvas-room-v1','runtimeVersion':'1.0.0','bundleSha256':fingerprint,'status':'candidate','files':sorted(files,key=lambda f:f['path'])}
    raw=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    with (target/'manifest.json').open('xb') as handle:handle.write(raw)
    return {'skill':'game-assembly','backend':'canvas-room-v1','passed':True,'errors':[],'warnings':report['warnings'],'output':str(target),'manifestSha256':hashlib.sha256(raw).hexdigest()}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('room');parser.add_argument('--output');parser.add_argument('--validate-only',action='store_true');parser.add_argument('--report');args=parser.parse_args()
    try:
        room,fingerprint=load_bundle(args.room)
        if args.validate_only:result=check_room(room,Path(args.room).parent)
        elif not args.output:raise ValueError('--output is required for building')
        else:result=build_room(room,fingerprint,Path(args.room).parent,args.output)
    except (OSError,ValueError,TypeError,KeyError,RecursionError) as exc:result={'skill':'game-assembly','backend':'canvas-room-v1','passed':False,'errors':[str(exc)],'warnings':[]}
    return emit_report(result,args.room,args.report)


if __name__=='__main__':raise SystemExit(main())
