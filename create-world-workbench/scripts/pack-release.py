#!/usr/bin/env python3
"""Package tool source and bundled skill release; never include user projects or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'output/redesign-v2/create-world-workbench-v2.zip'
output.parent.mkdir(parents=True,exist_ok=True)
skip={'node_modules','data','projects','.git','__pycache__','.DS_Store','.pytest_cache'}
with ZipFile(output,'w',ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        rel=file.relative_to(root)
        if any(part in skip for part in rel.parts) or not file.is_file() or file.is_symlink():continue
        if rel.parts[:2]==('fixtures','runtime-acceptance'):continue
        archive.write(file,Path('create-world-workbench')/rel)
print(output)
