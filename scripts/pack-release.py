#!/usr/bin/env python3
"""Package the complete current project, keeping runtime data and caches private."""
import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
DIRECTORIES = ('.agents/skills', 'create-world-workbench', 'interstellar-dust',
               'docs', 'scripts')
ROOT_FILES = ('README.md', 'AGENTS.md', '.gitignore', 'release-info.json')
SKIP = {'.git', 'node_modules', 'data', 'projects', '__pycache__',
        '.pytest_cache', '.DS_Store'}


def release_files():
    result = [ROOT / name for name in ROOT_FILES]
    for directory in DIRECTORIES:
        for file in (ROOT / directory).rglob('*'):
            rel = file.relative_to(ROOT)
            if any(part in SKIP for part in rel.parts):
                continue
            if 'fixtures/runtime-acceptance' in rel.as_posix():
                continue
            if file.name.startswith('.env') or file.suffix in {'.log', '.pyc'}:
                continue
            if not file.is_file() or file.is_symlink():
                continue
            result.append(file)
    return sorted(set(result))


def main():
    metadata = json.loads((ROOT / 'release-info.json').read_text())
    filename = metadata['archive']
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'releases' / filename
    if not (ROOT / 'create-world-workbench/dist/web/index.html').is_file():
        raise SystemExit('Run npm run build in create-world-workbench first.')
    files = release_files()
    manifest = ROOT / 'MANIFEST.sha256'
    manifest.write_text(''.join(
        f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(ROOT).as_posix()}\n'
        for file in files), encoding='utf-8')
    files.append(manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, Path('CreateWorldAgent') / file.relative_to(ROOT))
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise SystemExit('ZIP integrity check failed.')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (output.parent / 'SHA256SUMS').write_text(f'{digest}  {output.name}\n', encoding='utf-8')
    print(json.dumps({'archive': str(output), 'files': len(files),
                      'bytes': output.stat().st_size, 'sha256': digest}, indent=2))


if __name__ == '__main__':
    main()
