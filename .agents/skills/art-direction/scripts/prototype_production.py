#!/usr/bin/env python3
"""Validate/export a visible prototype style without inventing player evidence."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

from PIL import Image
import yaml

STATUS = "prototype_selected_unvalidated"
VERSION = "prototype-1.0"
CATEGORIES = {"source_function", "craft", "readability", "technical", "production"}
STYLE_LISTS = ("palette", "shape_language", "lighting", "camera", "ui", "motion", "negative_rules")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def mapping(value, name):
    require(isinstance(value, dict), name + " must be a mapping")
    return value


def nonempty(value, name):
    require(isinstance(value, str) and value.strip(), name + " must be nonempty text")


def strings(value, name, allow_empty=False):
    require(isinstance(value, list) and (allow_empty or value), name + " must be a text list")
    for entry in value:
        nonempty(entry, name)


def dimensions(value, name):
    require(isinstance(value, list) and len(value) == 2 and all(type(x) is int and 1 <= x <= 16384 for x in value), name + " must contain two integer dimensions (1..16384)")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        require(isinstance(key, str), "YAML mapping keys must be strings")
        require(key not in result, "duplicate YAML key: " + key)
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def load(path):
    path = Path(path)
    require(path.stat().st_size <= 2 * 1024 * 1024, "decision exceeds 2 MiB")
    return yaml.load(path.read_text(encoding="utf-8-sig"), Loader=UniqueLoader)


def sample_path(base, text):
    nonempty(text, "sample.path")
    path = Path(text)
    require(not path.is_absolute() and not re.match(r"^[A-Za-z]:", text) and ".." not in path.parts and "\\" not in text, "sample.path must be a safe relative path with forward slashes")
    base = Path(base).resolve()
    target = base / path
    require(target.is_file(), "sample file missing")
    require(target.resolve().is_relative_to(base), "sample escapes decision directory")
    current = target
    while current != base:
        require(not current.is_symlink() and not (hasattr(current, "is_junction") and current.is_junction()), "sample path contains a link")
        current = current.parent
    require(target.stat().st_size <= 20 * 1024 * 1024, "sample exceeds 20 MiB")
    return target


def image_size(path):
    if path.suffix.lower() == ".svg":
        raw = path.read_bytes()
        require(b"<!DOCTYPE" not in raw.upper() and b"<!ENTITY" not in raw.upper(), "SVG DTD/entity unsupported")
        root = ET.fromstring(raw)
        require(root.tag.rsplit("}", 1)[-1] == "svg", "sample is not SVG")
        for element in root.iter():
            require(element.tag.rsplit("}", 1)[-1] not in {"script", "foreignObject", "image", "use"}, "SVG active or externally sourced content unsupported")
            for key, value in element.attrib.items():
                require(not key.rsplit("}", 1)[-1].lower().startswith("on"), "SVG event handler unsupported")
                require(key.rsplit("}", 1)[-1] != "href" and "url(" not in value.lower(), "SVG references unsupported in prototype sample")
        size = []
        for field in ("width", "height"):
            value = root.get(field, "")
            require(bool(re.fullmatch(r"[1-9][0-9]*(?:px)?", value)), "SVG needs explicit integer width/height")
            size.append(int(value.removesuffix("px")))
        require(all(x <= 16384 for x in size), "sample dimension too large")
        return tuple(size)
    require(path.suffix.lower() in {".png", ".webp", ".jpg", ".jpeg"}, "unsupported sample image format")
    with Image.open(path) as image:
        size = image.size
        require(all(1 <= x <= 16384 for x in size), "sample dimension too large")
        image.verify()
    with Image.open(path) as image:
        image.load()
    return size


def validate(data, base):
    data = mapping(data, "prototype")
    require(data.get("schema_version") == VERSION, "schema_version must be " + VERSION)
    require(data.get("mode") == "prototype-production", "mode must be prototype-production")
    require(data.get("status") == STATUS, "prototype status cannot claim player support or creator selection")
    require(type(data.get("revision")) is int and data["revision"] > 0, "revision must be a positive integer")
    slug = data.get("project_slug")
    require(isinstance(slug, str) and bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug)), "invalid project_slug")
    require(data.get("player_evidence") is None, "prototype cannot contain player evidence")
    brief = mapping(data.get("brief"), "brief")
    for name in ("user_request", "scope", "rationale", "camera"):
        nonempty(brief.get(name), "brief." + name)
    dimensions(brief.get("native_resolution"), "native_resolution")
    dimensions(brief.get("character_size"), "character_size")
    require(type(brief.get("tile_size")) is int and 1 <= brief["tile_size"] <= 1024, "invalid tile_size")
    require(all(c <= n for c, n in zip(brief["character_size"], brief["native_resolution"])), "character exceeds native viewport")
    strings(brief.get("constraints"), "brief.constraints")
    sample = mapping(data.get("sample"), "sample")
    path = sample_path(base, sample.get("path"))
    require(isinstance(sample.get("sha256"), str) and bool(re.fullmatch(r"[0-9a-f]{64}", sample["sha256"])), "invalid sample.sha256")
    require(sha256(path) == sample["sha256"], "sample SHA-256 does not match actual bytes")
    dimensions([sample.get("width"), sample.get("height")], "sample size")
    require(image_size(path) == (sample["width"], sample["height"]), "sample dimensions do not match decoded image")
    strings(sample.get("panels"), "sample.panels")
    require({"gameplay_scene", "native_character", "ui_hud"} <= set(sample["panels"]), "sample must declare scene, native character and UI panels")
    require(sample.get("origin") in ("manual", "generated", "existing"), "invalid sample.origin")
    checks = data.get("checks")
    require(isinstance(checks, list), "checks must be a list")
    seen = set()
    for check in checks:
        check = mapping(check, "check")
        category = check.get("category")
        require(isinstance(category, str) and category in CATEGORIES and category not in seen, "unknown/duplicate craft check category")
        seen.add(category)
        require(check.get("status") == "pass", category + " must pass before prototype export")
        nonempty(check.get("method"), category + ".method")
        nonempty(check.get("evidence"), category + ".evidence")
    require(seen == CATEGORIES, "all five craft categories required")
    style = mapping(data.get("style_system"), "style_system")
    for key in ("style_anchor", "pixel_policy"):
        nonempty(style.get(key), "style_system." + key)
    for key in STYLE_LISTS:
        strings(style.get(key), "style_system." + key)
    overrides = mapping(style.get("asset_overrides"), "asset_overrides")
    require(bool(overrides), "asset_overrides must not be empty")
    for key, value in overrides.items():
        nonempty(key, "asset override name")
        strings(value, "asset_overrides." + key)
    strings(data.get("assumptions"), "assumptions", allow_empty=True)
    strings(data.get("limitations"), "limitations")
    return path


def export_contract(data, decision, output):
    decision, output = Path(decision), Path(output)
    require(data == load(decision), "export data differs from the saved decision; save a new revision first")
    board = validate(data, decision.parent)
    require(not output.exists(), "refusing to overwrite an existing contract; create a new revision")
    # The output remains beside the decision so safe relative asset references remain stable.
    require(output.parent.resolve() == decision.parent.resolve(), "export beside prototype decision to preserve portable asset paths")
    contract = {
        "schema_version": VERSION,
        "contract_id": f"{data['project_slug']}-prototype-style-r{data['revision']:04d}",
        "revision": data["revision"], "project_slug": data["project_slug"],
        "decision_status": STATUS, "selection_authority": "engineering_constraints",
        "player_evidence": None, "prototype_scope": data["brief"]["scope"],
        "native_geometry": {key: copy.deepcopy(data["brief"][key]) for key in ("native_resolution", "camera", "tile_size", "character_size")},
        "reference_assets": [{"path": data["sample"]["path"], "sha256": sha256(board), "role": "prototype_composite_board"}],
        **{key: copy.deepcopy(data["style_system"][key]) for key in ("style_anchor", "pixel_policy", *STYLE_LISTS, "asset_overrides")},
        "assumptions": copy.deepcopy(data["assumptions"]), "limitations": copy.deepcopy(data["limitations"]),
        "provenance": {"prototype_decision": decision.name, "prototype_decision_sha256": sha256(decision)},
    }
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        yaml.safe_dump(contract, stream, allow_unicode=True, sort_keys=False)
    return contract


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "export-contract"))
    parser.add_argument("decision")
    parser.add_argument("--output")
    args = parser.parse_args()
    report = {"skill": "art-direction", "mode": "prototype-production", "passed": False, "errors": [],
              "warnings": ["Engineering checks do not establish player preference; visible panel declarations still require visual review."]}
    try:
        decision = Path(args.decision)
        data = load(decision)
        validate(data, decision.parent)
        if args.command == "export-contract":
            require(args.output, "export-contract requires --output")
            export_contract(data, decision, Path(args.output))
            report["output"] = str(Path(args.output).resolve())
        report.update(passed=True, decision_status=STATUS)
    except (ValueError, TypeError, KeyError, OSError, RecursionError, yaml.YAMLError, ET.ParseError, Image.DecompressionBombError) as exc:
        report["errors"].append(str(exc))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
