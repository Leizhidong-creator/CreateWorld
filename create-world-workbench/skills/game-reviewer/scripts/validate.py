"""Independent finite-model, manifest and supplied browser-evidence verifier."""
import argparse
import hashlib
import json
from pathlib import Path
from runtime_core import emit_report, load_bundle, validate, replay, canonical
from assembly_core import no_links, safe_relative, FIXED_FILES, validate_assembly


def digest(data): return hashlib.sha256(data).hexdigest()


def review(bundle, fingerprint, artifact_dir=None, evidence_path=None, require_runtime=False, bundle_dir=None):
    result = {"skill": "game-reviewer", **validate_assembly(bundle, bundle_dir or Path.cwd()), "runtimeStatus": "unverified", "releaseReady": False}
    errors = result["errors"]
    if errors: return result
    manifest_hash = None
    if artifact_dir:
        try:
            root = no_links(artifact_dir)
            raw = no_links(root / "manifest.json").read_bytes()
            manifest = json.loads(raw)
            manifest_hash = digest(raw)
            if not isinstance(manifest, dict) or type(manifest.get("schemaVersion")) is not int or manifest["schemaVersion"] != 1:
                raise ValueError("invalid manifest schema")
            if manifest.get("bundleSha256") != fingerprint: raise ValueError("manifest belongs to different bundle")
            if manifest.get("status") != "candidate": raise ValueError("manifest status must be candidate")
            entries = manifest.get("files")
            if not isinstance(entries, list) or not entries: raise ValueError("manifest file list required")
            paths = set()
            for entry in entries:
                if not isinstance(entry, dict): raise ValueError("manifest file record invalid")
                relative = safe_relative(entry.get("path"))
                if relative.lower() in paths or relative.lower() == "manifest.json": raise ValueError("duplicate/reserved manifest path")
                paths.add(relative.lower())
                target = no_links(root / relative)
                if not target.is_file() or digest(target.read_bytes()) != entry.get("sha256"):
                    raise ValueError("manifest file missing/hash mismatch: " + relative)
            if not FIXED_FILES.issubset(paths): raise ValueError("required runtime files missing from manifest")
            actual = set()
            for path in root.rglob('*'):
                no_links(path)
                if path.is_file(): actual.add(path.relative_to(root).as_posix().lower())
            if actual != paths | {'manifest.json'}: raise ValueError("unexpected files outside immutable manifest")
            result['manifestSha256'] = manifest_hash
            result['artifactStatus'] = 'hash-verified'
        except (OSError, ValueError, TypeError, KeyError) as exc: errors.append(str(exc))
    if evidence_path:
        try:
            if not artifact_dir or not manifest_hash or errors: raise ValueError("valid artifact manifest required before browser evidence")
            evidence, _ = load_bundle(evidence_path)
            if not isinstance(evidence, dict): raise ValueError("browser evidence must be object")
            if type(evidence.get('schemaVersion')) is not int or evidence['schemaVersion'] != 1: raise ValueError('unsupported evidence schema')
            if evidence.get('runner') != 'playwright-real-input-v1' or evidence.get('status') != 'passed': raise ValueError('browser run not passed or unknown runner')
            if evidence.get('bundleSha256') != fingerprint or evidence.get('manifestSha256') != manifest_hash: raise ValueError('stale browser evidence fingerprint')
            for key in ('pageErrors', 'consoleErrors'):
                if type(evidence.get(key)) is not list or evidence[key]: raise ValueError(key + ' must be collected empty array')
            checks = evidence.get('checks')
            if isinstance(checks, dict) and any(value is not True for value in checks.values()): raise ValueError('reported browser check is failed or not a true boolean')
            if not isinstance(checks, dict) or any(checks.get(k) is not True for k in ('saveRestore', 'restart', 'mobileLayout', 'guardRejected', 'pause', 'invalidSave', 'keyboard', 'touch')): raise ValueError('required browser checks absent or not true booleans')
            journeys = evidence.get('journeys')
            if bundle['assembly']['assets'] and checks.get('assetsDecoded') is not True: raise ValueError('media decoding must be checked for supplied assets')
            if not isinstance(journeys, list) or not journeys or len(journeys) > 256: raise ValueError('bounded nonempty journeys required')
            covered, ids = set(), set()
            for journey in journeys:
                if not isinstance(journey, dict) or not isinstance(journey.get('id'), str) or not journey['id'] or journey['id'] in ids: raise ValueError('journey ID missing/duplicate')
                ids.add(journey['id'])
                final, expected = replay(bundle, journey.get('actions'))
                actual = journey.get('observations')
                if not isinstance(actual, list) or len(actual) != len(expected): raise ValueError('journey observation count mismatch')
                if canonical(actual) != canonical(expected): raise ValueError('journey observations do not match legal action replay')
                terminal = journey.get('terminalScreenId')
                if terminal != final['screenId'] or terminal not in bundle['flow']['terminals']: raise ValueError('journey does not reach declared terminal')
                covered.add(terminal)
            missing = set(bundle['flow']['terminals']) - covered
            if missing: raise ValueError('untested endings: ' + ','.join(sorted(missing)))
            result['runtimeStatus'] = 'evidence-consistent'
            result['warnings'].append('Evidence coherence does not authenticate a browser run. Host execution records and visual/semantic review remain required; no automatic release.')
        except (OSError, ValueError, TypeError, KeyError) as exc: errors.append(str(exc))
    else:
        result['warnings'].append('No browser evidence: runtime, visuals and gameplay quality remain unverified.')
    if require_runtime and result['runtimeStatus'] != 'evidence-consistent': errors.append('runtime evidence required but not verified')
    result['passed'] = not errors
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle'); parser.add_argument('--artifact-dir'); parser.add_argument('--evidence')
    parser.add_argument('--require-runtime', action='store_true'); parser.add_argument('--report')
    args = parser.parse_args()
    try:
        bundle, fingerprint = load_bundle(args.bundle)
        result = review(bundle, fingerprint, args.artifact_dir, args.evidence, args.require_runtime, Path(args.bundle).parent)
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        result = {'skill':'game-reviewer','passed':False,'errors':[str(exc)],'warnings':[], 'runtimeStatus':'unverified','releaseReady':False}
    return emit_report(result, args.bundle, args.report)


if __name__ == '__main__': raise SystemExit(main())
