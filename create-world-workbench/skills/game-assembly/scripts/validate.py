"""Validate a multi-screen candidate before assembly."""
import argparse
import json
from pathlib import Path
from runtime_core import emit_report, load_bundle
from assembly_core import validate_assembly


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    parser.add_argument("--report")
    args = parser.parse_args()
    try:
        bundle, fingerprint = load_bundle(args.bundle)
        result = {"skill": "game-assembly", "bundleSha256": fingerprint,
                  **validate_assembly(bundle, Path(args.bundle).parent)}
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        result = {"skill": "game-assembly", "passed": False, "errors": [str(exc)], "warnings": []}
    return emit_report(result, args.bundle, args.report)


if __name__ == "__main__": raise SystemExit(main())
