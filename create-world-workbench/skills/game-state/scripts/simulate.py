"""Replay declared actions and create/restore verified portable saves."""
import argparse
import json
from pathlib import Path
from runtime_core import load_bundle, validate_structure, replay, checkpoint, restore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    parser.add_argument("--actions", default="", help="comma separated interaction IDs")
    parser.add_argument("--restore", dest="restore_path")
    parser.add_argument("--save")
    args = parser.parse_args()
    try:
        bundle, fingerprint = load_bundle(args.bundle)
        errors = validate_structure(bundle)
        if errors: raise ValueError("; ".join(errors))
        actions = []
        if args.restore_path:
            saved, _ = load_bundle(args.restore_path)
            restore(bundle, fingerprint, saved)
            actions = saved["trace"]
        actions += args.actions.split(",") if args.actions else []
        final, observations = replay(bundle, actions)
        if args.save:
            with Path(args.save).open("x", encoding="utf-8") as handle:
                json.dump(checkpoint(bundle, fingerprint, actions), handle, ensure_ascii=False, indent=2)
        result = {"skill": "game-state", "passed": True, "errors": [], "warnings": [],
                  "bundleSha256": fingerprint, "state": final, "observations": observations}
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        result = {"skill": "game-state", "passed": False, "errors": [str(exc)], "warnings": []}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__": raise SystemExit(main())
