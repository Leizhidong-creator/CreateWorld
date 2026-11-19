"""Validate state contracts and bounded reachability."""
import argparse
import json
from pathlib import Path
from runtime_core import emit_report, load_bundle, validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    parser.add_argument("--report")
    parser.add_argument("--max-states", type=int, default=10000)
    args = parser.parse_args()
    try:
        bundle, fingerprint = load_bundle(args.bundle)
        result = {"skill": "game-state", "bundleSha256": fingerprint, **validate(bundle, args.max_states)}
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        result = {"skill": "game-state", "passed": False, "errors": [str(exc)], "warnings": []}
    return emit_report(result, args.bundle, args.report)


if __name__ == "__main__": raise SystemExit(main())
