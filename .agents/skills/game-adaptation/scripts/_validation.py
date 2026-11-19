"""Self-contained strict JSON loading and diagnostics for this skill."""
import argparse
import json
import re
import sys
from pathlib import Path

ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")


class Check:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def require(self, condition, message):
        if not condition:
            self.errors.append(message)
        return bool(condition)

    def obj(self, value, path):
        if not self.require(isinstance(value, dict), f"{path}: expected object"):
            return {}
        return value

    def seq(self, value, path, nonempty=False):
        if not self.require(isinstance(value, list), f"{path}: expected array"):
            return []
        if nonempty:
            self.require(bool(value), f"{path}: must not be empty")
        return value

    def text(self, value, path):
        return self.require(isinstance(value, str) and bool(value.strip()), f"{path}: expected nonempty text")

    def identity(self, value, path):
        return self.require(isinstance(value, str) and bool(ID.fullmatch(value)), f"{path}: invalid ID")

    def index(self, value, path, nonempty=True):
        result = {}
        for i, item in enumerate(self.seq(value, path, nonempty)):
            item = self.obj(item, f"{path}[{i}]")
            key = item.get("id")
            if self.identity(key, f"{path}[{i}].id"):
                self.require(key not in result, f"{path}: duplicate ID {key}")
                result[key] = item
        return result

    def refs(self, value, known, path, nonempty=False):
        result = []
        for i, key in enumerate(self.seq(value, path, nonempty)):
            if self.identity(key, f"{path}[{i}]"):
                self.require(key in known, f"{path}: unknown reference {key}")
                self.require(key not in result, f"{path}: duplicate reference {key}")
                result.append(key)
        return result


def top(bundle, check):
    bundle = check.obj(bundle, "bundle")
    check.require(type(bundle.get("schemaVersion")) is int and bundle["schemaVersion"] == 1,
                  "schemaVersion: expected integer 1")
    check.identity(bundle.get("id"), "id")
    check.text(bundle.get("title"), "title")
    return bundle


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def run(skill, validate):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=f"Validate {skill} project-bundle contract")
    parser.add_argument("bundle")
    parser.add_argument("--report")
    args = parser.parse_args()
    check = Check()
    try:
        source = Path(args.bundle)
        if source.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("input exceeds 2 MiB")
        bundle = json.loads(source.read_text(encoding="utf-8-sig"), object_pairs_hook=unique_pairs,
                            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"invalid number {value}")))
        validate(top(bundle, check), check)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError) as exc:
        check.errors.append(f"input/validation failure: {exc}")
    result = {"skill": skill, "passed": not check.errors, "errors": check.errors, "warnings": check.warnings}
    if args.report:
        try:
            report = Path(args.report)
            if report.resolve() == Path(args.bundle).resolve():
                raise ValueError("report path must not overwrite input")
            report.parent.mkdir(parents=True, exist_ok=True)
            report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except (OSError, ValueError) as exc:
            check.errors.append(f"report failure: {exc}")
            result["passed"] = False
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1
