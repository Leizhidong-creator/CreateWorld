"""Build a new immutable offline candidate. Never executes bundle code."""
import argparse
import json
from pathlib import Path
from runtime_core import load_bundle
from assembly_core import build


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        bundle, fingerprint = load_bundle(args.bundle)
        result = {"skill": "game-assembly", "passed": True, "errors": [],
                  **build(bundle, fingerprint, Path(args.bundle).parent, args.output)}
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        result = {"skill": "game-assembly", "passed": False, "errors": [str(exc)], "warnings": []}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__": raise SystemExit(main())
