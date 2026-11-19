"""Build a self-contained ZIP with deterministic file ordering and SHA256 manifest."""
import argparse,hashlib,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=root.parent/'output'/'interstellar-dust.zip');args=p.parse_args()
excluded={'node_modules','.git','__pycache__','.DS_Store','MANIFEST.sha256'}
files=[f for f in root.rglob('*') if f.is_file() and not any(part in excluded for part in f.relative_to(root).parts) and f.suffix not in {'.zip','.pyc'}]
files.sort(key=lambda f:str(f.relative_to(root)))
manifest=''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.relative_to(root).as_posix()+'\n' for f in files)
(root/'MANIFEST.sha256').write_text(manifest,encoding='utf-8')
args.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for file in files+[root/'MANIFEST.sha256']:z.write(file,'interstellar-dust/'+file.relative_to(root).as_posix())
print(str(args.output.resolve()))
print(str(len(files)+1)+' files; '+str(args.output.stat().st_size)+' bytes')
