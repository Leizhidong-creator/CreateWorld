"""Path-safe, deterministic offline candidate assembly."""
import hashlib
import json
import os
import re
import stat
from pathlib import Path, PurePosixPath
from runtime_core import validate, ID

VERSION = "1.0.0"
FIXED_FILES = {"index.html", "runtime.js", "style.css", "game-data.js"}
ALLOWED = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".wav", ".ogg", ".mp3"}
HASH = re.compile(r"^[a-f0-9]{64}$")
RESERVED = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)", re.I)


def sha256(data): return hashlib.sha256(data).hexdigest()


def no_links(path):
    path = Path(os.path.abspath(path))
    for component in [*reversed(path.parents), path]:
        if component.exists() or component.is_symlink():
            st = component.lstat()
            if stat.S_ISLNK(st.st_mode) or getattr(st, "st_file_attributes", 0) & 0x400:
                raise ValueError("symbolic/reparse paths are forbidden: " + str(component))
    return path


def safe_relative(value):
    if type(value) is not str or not value or len(value) > 240:
        raise ValueError("asset path must be nonempty relative text")
    if "\\" in value or ":" in value or "%" in value or "\x00" in value or value.startswith("/"):
        raise ValueError("unsafe asset path: " + value)
    parts = value.split("/")
    if any(p in ("", ".", "..") or not re.fullmatch(r"[A-Za-z0-9_.-]+", p)
           or p.endswith((".", " ")) or RESERVED.match(p) for p in parts):
        raise ValueError("unsafe asset path component: " + value)
    if PurePosixPath(value).is_absolute(): raise ValueError("absolute asset path forbidden")
    return value


def signature_matches(path, data):
    suffix = Path(path).suffix.lower()
    if suffix == ".png": return data.startswith(b"\x89PNG\r\n\x1a\n")
    if suffix in (".jpg", ".jpeg"): return data.startswith(b"\xff\xd8\xff")
    if suffix == ".gif": return data.startswith((b"GIF87a", b"GIF89a"))
    if suffix == ".webp": return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if suffix == ".wav": return data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    if suffix == ".ogg": return data.startswith(b"OggS")
    if suffix == ".mp3": return data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 255 and data[1] & 224 == 224)
    return False


def validate_assembly(bundle, bundle_dir, max_states=10000):
    result = validate(bundle, max_states)
    errors = result["errors"]
    if errors: return result
    section = bundle.get("assembly")
    if not isinstance(section, dict): errors.append("assembly section is required"); result["passed"] = False; return result
    for action in bundle["interactions"]:
        spec = action.get("inputSpec")
        if spec is not None:
            if not isinstance(spec, dict) or spec.get("gesture") != "press" or "moduleId" in spec:
                errors.append(action["id"] + ": this runtime supports native button press only; gesture/module implementation required")
            elif not isinstance(spec.get("devices"), list) or not spec["devices"] or any(d not in ("keyboard", "pointer", "touch") for d in spec["devices"]):
                errors.append(action["id"] + ": unsupported runtime input device")
            else:
                bindings = spec.get("bindings")
                supported = {"keyboard": ("Enter", "Space", "Enter/Space"), "pointer": ("click",), "touch": ("tap",)}
                if not isinstance(bindings, dict) or any(bindings.get(d) not in supported[d] for d in spec["devices"]):
                    errors.append(action["id"] + ": unsupported binding; use focused-button Enter/Space, click or tap")
    if section.get("entryScreen") != bundle.get("flow", {}).get("startScreen"):
        errors.append("assembly entryScreen must match flow.startScreen")
    required, statuses = section.get("requiredArtifactIds"), section.get("artifactStatus")
    if not isinstance(required, list) or any(type(i) is not str or not ID.fullmatch(i) for i in required):
        errors.append("requiredArtifactIds must be valid IDs")
    elif len(set(required)) != len(required): errors.append("duplicate required artifact ID")
    if not isinstance(statuses, dict): errors.append("artifactStatus must be an object")
    else:
        if any(not ID.fullmatch(k) or v not in ("passed", "candidate", "failed", "blocked") for k, v in statuses.items()):
            errors.append("artifactStatus contains invalid ID/status")
        if isinstance(required, list):
            for key in required:
                if type(key) is str and statuses.get(key) != "passed": errors.append("required artifact is not passed: " + key)
    assets = section.get("assets")
    ids, paths = set(), set()
    if not isinstance(assets, list) or len(assets) > 128: errors.append("assets must be array, at most 128")
    else:
        total = 0
        for asset in assets:
            try:
                if not isinstance(asset, dict) or type(asset.get("id")) is not str or not ID.fullmatch(asset["id"]):
                    raise ValueError("asset requires valid ID")
                if asset["id"] in ids: raise ValueError("duplicate asset ID")
                ids.add(asset["id"])
                relative = safe_relative(asset.get("path"))
                if relative.lower() in paths or relative.lower() in FIXED_FILES or relative.lower() == "manifest.json":
                    raise ValueError("duplicate or reserved asset path")
                paths.add(relative.lower())
                if Path(relative).suffix.lower() not in ALLOWED: raise ValueError("asset media extension not supported")
                if type(asset.get("sha256")) is not str or not HASH.fullmatch(asset["sha256"]): raise ValueError("asset sha256 required")
                target = no_links(Path(bundle_dir) / relative)
                if not target.is_file(): raise ValueError("asset is missing: " + relative)
                if target.stat().st_size > 20 * 1024 * 1024: raise ValueError("asset exceeds 20 MiB")
                total += target.stat().st_size
                if total > 100 * 1024 * 1024: raise ValueError("assets exceed 100 MiB total")
                data = target.read_bytes()
                if sha256(data) != asset["sha256"]: raise ValueError("asset hash mismatch: " + relative)
                if not signature_matches(relative, data): raise ValueError("asset content does not match media extension: " + relative)
            except (ValueError, OSError, TypeError) as exc: errors.append(str(exc))
    for screen in bundle.get("flow", {}).get("screens", []):
        if "assetIds" in screen and (not isinstance(screen["assetIds"], list) or any(a not in ids for a in screen["assetIds"])):
            errors.append("screen assetIds references undeclared assets")
    result["passed"] = not errors
    if not assets: result["warnings"].append("No external art/audio assets: this is a functional greybox, not final art.")
    return result


def build(bundle, fingerprint, bundle_dir, output):
    result = validate_assembly(bundle, bundle_dir)
    if not result["passed"]: raise ValueError("; ".join(result["errors"]))
    target = no_links(output)
    if target.exists(): raise ValueError("immutable output already exists: " + str(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    no_links(target.parent)
    target.mkdir()  # exclusive; a failed build remains an unverified candidate, never overwritten
    template = Path(__file__).resolve().parent.parent / "assets"
    files = []
    def write(relative, data):
        name = target / safe_relative(relative)
        name.parent.mkdir(parents=True, exist_ok=True)
        no_links(name)
        with name.open("xb") as handle: handle.write(data)
        files.append({"path": relative, "sha256": sha256(data)})
    for name in ("index.html", "runtime.js", "style.css"):
        write(name, (template / name).read_bytes())
    runtime_data = {key: bundle[key] for key in ("id", "title", "state", "flow", "interactions", "assembly")}
    runtime_data["bundleSha256"] = fingerprint
    encoded = json.dumps(runtime_data, ensure_ascii=True, separators=(",", ":")).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    write("game-data.js", ("window.__SKILL_GAME_DATA__ = " + encoded + ";\n").encode("utf-8"))
    for asset in bundle["assembly"]["assets"]:
        source = no_links(Path(bundle_dir) / asset["path"])
        data = source.read_bytes()
        if sha256(data) != asset["sha256"]: raise ValueError("asset changed during build")
        write(asset["path"], data)
    manifest = {"schemaVersion": 1, "bundleSha256": fingerprint, "runtimeVersion": VERSION,
                "status": "candidate", "files": sorted(files, key=lambda item: item["path"])}
    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with (target / "manifest.json").open("xb") as handle: handle.write(manifest_data)
    return {"output": str(target), "manifestSha256": sha256(manifest_data), "manifest": manifest,
            "warnings": result["warnings"]}
