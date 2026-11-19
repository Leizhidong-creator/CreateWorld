from pathlib import Path
import zipfile

root = Path(r"D:/develop/createworld/create-world-workbench")
out = Path(r"D:/develop/createworld/deploy")
out.mkdir(parents=True, exist_ok=True)

def zip_tree(source: Path, target: Path, excluded=()):
    excluded = set(excluded)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in source.rglob("*"):
            if not path.is_file() or path.suffix == ".log":
                continue
            if any(part in excluded for part in path.relative_to(source).parts):
                continue
            archive.write(path, path.relative_to(source))

zip_tree(root / "dist" / "web", out / "create-world-workbench-frontend.zip")
zip_tree(root, out / "create-world-workbench-source.zip", {"node_modules", "data", "dist", ".git"})
print("created", out / "create-world-workbench-frontend.zip")
print("created", out / "create-world-workbench-source.zip")
