"""Read-only workflow integrity checks. Not a story or gameplay quality judge."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import sys
from urllib.parse import unquote

REQUIRED = [
    'README.md', 'RUN.md', 'project-profile.md', 'UPSTREAM.md', 'ACCEPTANCE.md',
    'methods/source-reading.md', 'methods/adaptation-design.md',
    'methods/script-writing.md', 'methods/script-review.md',
    'templates/game-script.md', 'templates/workspace/README.md',
    'templates/workspace/source/README.md',
    'templates/workspace/work/progress.md',
    'templates/workspace/output/README.md', 'sources.lock.json',
    'templates/reading-ledger.md', 'templates/episode-decisions.md',
    'templates/review-record.md', 'checks/validate_reading.py',
    'checks/test_validate_reading.py', 'checks/test_validate_workflow.py',
]

# Only executable method documents declare the current method version. Do not
# search historical UPSTREAM notes, templates, or arbitrary body text.
VERSIONED = [
    'RUN.md', 'project-profile.md', 'methods/source-reading.md',
    'methods/adaptation-design.md', 'methods/script-writing.md',
    'methods/script-review.md',
]


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def validate(root):
    root = Path(root).resolve()
    errors, notes, hashes = [], [], {}
    for name in REQUIRED:
        p = root / name
        if not p.is_file() or not p.stat().st_size:
            errors.append(f'missing_or_empty: {name}')
    try:
        lock = json.loads((root / 'sources.lock.json').read_text(encoding='utf-8'))
        if not lock.get('method_version') or not re.fullmatch('[a-f0-9]{40}', lock.get('upstream_commit', '')):
            errors.append('invalid_version_or_commit')
        for name in VERSIONED:
            p = root / name
            if not p.is_file():
                continue  # Already reported by the required-file check.
            header = '\n'.join(p.read_text(encoding='utf-8-sig').splitlines()[:8])
            versions = re.findall(
                r'^(?:方法版本|版本)\s*[:：]?\s*(\d+\.\d+\.\d+)(?=\s|[·：:]|$)',
                header, re.M,
            )
            if len(versions) != 1:
                errors.append(f'method_version_missing_or_ambiguous: {name}')
            elif versions[0] != lock.get('method_version'):
                errors.append(f'method_version_mismatch: {name}: {versions[0]} != {lock.get("method_version")}')
        if len([x for x in lock['authorities'] if x['role'] == 'authority']) != 2:
            errors.append('expected_two_authorities')
        if not lock['snapshots']:
            errors.append('missing_upstream_snapshots')
        for rec in lock['authorities']:
            p = Path(rec['path'])
            # The old game is evidence for this installation only, never a mandatory input.
            if rec['role'] == 'example-only' and not p.is_file():
                notes.append('optional_example_absent: ' + str(p))
                continue
            if not p.is_file() or digest(p) != rec['sha256']:
                errors.append('authority_changed_or_missing: ' + str(p))
        for rec in lock['snapshots']:
            p = (root / rec['local_path']).resolve()
            if not p.is_relative_to(root / 'third_party'):
                errors.append('snapshot_outside_reference_directory: ' + str(p))
            elif not p.is_file() or digest(p) != rec['sha256']:
                errors.append('snapshot_changed_or_missing: ' + rec['local_path'])
    except (OSError, ValueError, KeyError, TypeError) as ex:
        errors.append('invalid_lock: ' + str(ex))

    links = 0
    for p in sorted(root.rglob('*')):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if '__pycache__' in rel.parts:
            continue
        hashes[rel.as_posix()] = digest(p)
        if p.name in ('SKILL.md', 'AGENTS.md', 'CLAUDE.md') or any(
            x in rel.parts for x in ('.agents', '.claude-plugin', '.codex-plugin')
        ):
            errors.append('unexpected_discovery_entry: ' + rel.as_posix())
        if p.suffix != '.md' or 'third_party' in rel.parts:
            continue
        body = p.read_text(encoding='utf-8')
        # Strip fenced code before checking the documented inline links.
        body = re.sub(r'```.*?```', '', body, flags=re.S)
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', body):
            if target.startswith(('https://', 'http://', 'mailto:')):
                continue
            filename, _, fragment = unquote(target.strip('<>')).partition('#')
            path = Path(filename) if re.match(r'^[A-Za-z]:[/\\]', filename) else p.parent / filename
            path = path if filename else p
            links += 1
            if not path.exists():
                errors.append(f'broken_link: {rel} -> {target}')
            elif fragment and path.suffix == '.md':
                headings = re.findall(r'^#+\s+(.+)$', path.read_text(encoding='utf-8'), re.M)
                anchors = [re.sub(r'[^\w\s-]', '', h.lower()).replace(' ', '-') for h in headings]
                if fragment not in anchors:
                    errors.append(f'broken_anchor: {rel} -> {target}')
    return {
        'status': 'failed' if errors else 'file_integrity_passed_requires_text_review',
        'errors': errors, 'notes': notes, 'local_links_checked': links,
        'file_hashes': hashes,
        'limitations': ['Does not judge story fidelity, instruction semantics, or gameplay.',
                        'External web URLs and raw snapshot internal links are not checked.',
                        'Markdown link parser covers the inline syntax used by this workflow.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        result = validate(args.root)
        text = json.dumps(result, ensure_ascii=False, indent=2)
        if args.report:
            # Keep checks read-only with respect to all workflow/authority inputs.
            report = args.report.resolve()
            protected = args.root.resolve()
            if report.is_relative_to(protected) or report.exists():
                raise ValueError('report must be a new path outside the workflow')
            report.parent.mkdir(parents=True, exist_ok=True)
            with report.open('x', encoding='utf-8', newline='\n') as f:
                f.write(text + '\n')
        print(text)
        return 1 if result['errors'] else 0
    except (OSError, ValueError) as ex:
        print(json.dumps({'status': 'tool_error', 'error': str(ex)}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    sys.exit(main())
