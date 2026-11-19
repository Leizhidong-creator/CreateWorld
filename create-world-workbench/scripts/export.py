from pathlib import Path
import sys,zipfile,hashlib,json
source=Path(sys.argv[1]).resolve()
target=Path(sys.argv[2]).resolve()
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
# Host already verifies manifest and its signed evidence before invoking this exporter.
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_symlink(): raise ValueError('Symbolic links are not exportable')
        if file.is_file():archive.write(file,file.relative_to(source).as_posix())
