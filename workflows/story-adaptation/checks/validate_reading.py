"""Validate recorded coverage and file identity, never actual reading/comprehension.

Python 3.10+, standard library only. Run: python validate_reading.py WORKDIR
note_anchor accepts work/...md#anchor (relative to WORKDIR), a sibling/relative
Markdown file#anchor (relative to its JSON ledger), or an anchor alone / #anchor
in the ledger's companion .md. No search or guessed target file is performed.
Source and note references must be relative and remain within resolved WORKDIR;
symlinks are resolved before access. Markdown ATX headings and explicit HTML
anchor id/name attributes are supported; code fences do not define anchors.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PureWindowsPath
from urllib.parse import unquote


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _unique_keys(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate_json_key: " + key)
        value[key] = item
    return value


def _read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=_unique_keys)


def _anchors(text):
    """Extract the supported anchor forms, excluding quoted code examples."""
    anchors, counts = set(), {}
    fence = None
    for line in text.splitlines():
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker:
            run = marker.group(1)
            if fence is None:
                fence = run
            elif run[0] == fence[0] and len(run) >= len(fence):
                fence = None
            continue
        if fence is not None:
            continue
        for match in re.finditer(r'<a\b[^>]*\b(?:id|name)\s*=\s*(["\x27])(.*?)\1', line, re.I):
            anchors.add(match.group(2))
        heading = re.match(r"^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$", line)
        if heading:
            slug = re.sub(r"[^\w\s-]", "", heading.group(1).lower())
            slug = re.sub(r"\s", "-", slug)
            count = counts.get(slug, 0)
            counts[slug] = count + 1
            anchors.add(slug if count == 0 else f"{slug}-{count}")
    return anchors


def _missing(spans, last):
    """Merge intervals without allocating a set for every source paragraph."""
    cursor, missing, first, end = 1, 0, None, None
    for start, stop in sorted(spans):
        if start > cursor:
            first = cursor if first is None else first
            end = start - 1
            missing += start - cursor
        cursor = max(cursor, stop + 1)
    if cursor <= last:
        first = cursor if first is None else first
        end = last
        missing += last - cursor + 1
    return first, end, missing


def check(root):
    root = Path(root).resolve()
    errors, units, coverage = [], {}, {}
    count = 0

    def local(value, base=None):
        if not isinstance(value, str) or not value.strip() or "\x00" in value:
            raise ValueError("invalid_path")
        # Also reject Windows absolute/drive-relative paths on non-Windows hosts.
        if Path(value).is_absolute() or PureWindowsPath(value).drive or value.startswith(("/", "\\")):
            raise ValueError("absolute_path: " + value)
        path = ((base or root) / value.replace("\\", "/")).resolve()
        if not path.is_relative_to(root):
            raise ValueError("path_outside_work: " + value)
        return path

    try:
        manifest = _read_json(local("source/manifest.json"))
        if not isinstance(manifest, dict) or not isinstance(manifest.get("units"), list):
            raise ValueError("manifest_units_not_list")
        if not manifest["units"]:
            errors.append("empty_source")
        for index, unit in enumerate(manifest["units"]):
            label = f"source[{index}]"
            try:
                if not isinstance(unit, dict):
                    raise ValueError("unit_not_object")
                ident = unit.get("id")
                if not isinstance(ident, str) or not ident.strip():
                    raise ValueError("invalid_source_id")
                label = ident
                if ident in units:
                    errors.append("duplicate_source: " + ident)
                    continue
                units[ident] = unit
                paragraphs = unit.get("paragraphs")
                if type(paragraphs) is not int or paragraphs < 1:
                    raise ValueError("invalid_paragraph_count")
                if not isinstance(unit.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", unit["sha256"]):
                    raise ValueError("invalid_source_hash")
                path = local(unit.get("path"))
                if not path.is_file() or sha(path) != unit["sha256"]:
                    errors.append("source_hash: " + ident)
                    continue
                nums = [int(n) for n in re.findall(r"^P(\d+) ", path.read_text(encoding="utf-8-sig"), re.M)]
                if len(nums) != paragraphs or any(n != i for i, n in enumerate(nums, 1)):
                    errors.append("paragraph_sequence: " + ident)
            except (OSError, ValueError, TypeError) as ex:
                errors.append(f"invalid_source: {label}: {ex}")
    except (OSError, ValueError, TypeError) as ex:
        errors.append("invalid_manifest: " + str(ex))

    try:
        ledgers = sorted(local("work/readings").glob("*.json"))
    except (OSError, ValueError) as ex:
        ledgers = []
        errors.append("invalid_ledger_path: " + str(ex))
    for ledger in ledgers:
        try:
            ledger = local(str(ledger.relative_to(root)))
            records = _read_json(ledger)
            if not isinstance(records, list):
                raise ValueError("ledger_not_list")
        except (OSError, ValueError, TypeError) as ex:
            errors.append(f"invalid_ledger: {ledger.name}: {ex}")
            continue
        for index, record in enumerate(records):
            count += 1
            label = f"{ledger.name}[{index}]"
            try:
                if not isinstance(record, dict):
                    raise ValueError("record_not_object")
                ident = record.get("id")
                if not isinstance(ident, str) or not ident.strip():
                    raise ValueError("invalid_record_id")
                label += ": " + ident
                if ident not in units:
                    errors.append("unknown_unit: " + ident)
                    continue
                unit = units[ident]
                if record.get("read_status") != "read":
                    errors.append("not_read: " + ident)
                if record.get("sha256") != unit.get("sha256"):
                    errors.append("stale_reading: " + ident)
                spans = record.get("paragraphs_read")
                if not isinstance(spans, list) or not spans:
                    errors.append("missing_ranges: " + ident)
                else:
                    last = unit.get("paragraphs")
                    for span in spans:
                        if (not isinstance(span, list) or len(span) != 2
                                or any(type(n) is not int for n in span)
                                or type(last) is not int or not 1 <= span[0] <= span[1] <= last):
                            errors.append("invalid_range: " + ident)
                            continue
                        coverage.setdefault(ident, []).append(span)

                note = record.get("note_anchor")
                if not isinstance(note, str) or not note.strip():
                    raise ValueError("missing_note_anchor")
                target, separator, anchor = note.partition("#")
                if not separator:
                    if not re.fullmatch(r"[\w-]+", target):
                        raise ValueError("missing_note_anchor")
                    anchor, target = target, ""
                if not anchor:
                    raise ValueError("missing_note_anchor")
                if not target:
                    path = local(ledger.with_suffix(".md").name, ledger.parent)
                else:
                    target = target.replace("\\", "/")
                    base = root if target.startswith(("work/", "source/")) else ledger.parent
                    path = local(target, base)
                if not path.is_file():
                    errors.append("missing_note: " + ident)
                elif unquote(anchor) not in _anchors(path.read_text(encoding="utf-8-sig")):
                    errors.append("missing_note_anchor: " + ident)
            except (OSError, ValueError, TypeError) as ex:
                errors.append(f"invalid_record: {label}: {ex}")

    for ident, unit in units.items():
        last = unit.get("paragraphs")
        if type(last) is int and last > 0:
            first, end, missing = _missing(coverage.get(ident, []), last)
            if missing:
                errors.append(f"unread_range: {ident} {first}..{end} ({missing})")
    return {
        "status": "failed" if errors else "recorded_coverage_complete_requires_semantic_review",
        "units": len(units), "ledger_entries": count, "errors": errors,
        "limitation": "Validates evidence records and file identity; cannot prove actual reading or correct understanding.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workdir", type=Path)
    result = check(parser.parse_args().workdir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(bool(result["errors"]))
