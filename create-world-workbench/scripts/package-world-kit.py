#!/usr/bin/env python3
"""Package the fixed World Kit source library for later AI projects."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'packages' / 'source-library' / 'world-kit'
DEFAULT_OUTPUT = ROOT.parent / 'releases' / 'CreateWorldWorldKit-v1-20261030.zip'


def main() -> None:
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    files = sorted(path for path in SOURCE.rglob('*') if path.is_file() and path.name != 'MANIFEST.sha256')
    manifest = ''.join(
        f'{sha256(path.read_bytes()).hexdigest()}  {path.relative_to(SOURCE).as_posix()}\n'
        for path in files
    )
    (SOURCE / 'MANIFEST.sha256').write_text(manifest, encoding='utf-8')
    files.append(SOURCE / 'MANIFEST.sha256')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, Path('world-kit') / path.relative_to(SOURCE))
    print(f'{output} sha256={sha256(output.read_bytes()).hexdigest()} files={len(files)}')


if __name__ == '__main__':
    main()
