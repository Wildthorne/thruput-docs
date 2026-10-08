#!/usr/bin/env python3
"""Package the static docs build with stable bytes and a reviewable handoff file."""

import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile

MAX_FILES = 4096
MAX_BYTES = 64 * 1024 * 1024


def package_snapshot(root: Path, output: Path) -> dict:
    manifest = json.loads((root / "snapshot.json").read_text())
    if (manifest.get("schemaVersion") != 1
            or not re.fullmatch(r"[0-9a-f]{40}", manifest.get("sourceRevision", ""))
            or not isinstance(manifest.get("sourceDirty"), bool)
            or not re.fullmatch(r"[0-9A-Za-z.+-]+", manifest.get("agentGuideCliVersion", ""))):
        raise ValueError("invalid snapshot identity")
    for required in ("index.html", "start/index.html", "agent-guide.md",
                     "markdown/index.md", "markdown/full.md", "markdown/manifest.json",
                     "llms.txt", "llms-full.txt"):
        if not (root / required).is_file():
            raise ValueError(f"missing {required}")
    markdown = json.loads((root / "markdown/manifest.json").read_text())
    if markdown.get("schemaVersion") != 1 or markdown.get("snapshot") != manifest:
        raise ValueError("Markdown export identity differs from the snapshot")
    files = []
    total = 0
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise ValueError(f"not a regular file or directory: {path}")
        if path.is_dir():
            continue
        name = path.relative_to(root).as_posix()
        if any(part.startswith(".") for part in Path(name).parts) or "\\" in name:
            raise ValueError(f"unsupported snapshot path: {name}")
        total += path.stat().st_size
        if total > MAX_BYTES or len(files) >= MAX_FILES:
            raise ValueError("snapshot exceeds size or file-count limit")
        files.append((name, path))
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "snapshot.tar.gz"
    # No machine-specific paths, ownership, modes, timestamps, or gzip filename.
    with archive.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as tar:
            for name, path in files:
                data = path.read_bytes()
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))
    data = archive.read_bytes()
    lock = {
        **manifest,
        "archive": archive.name,
        "archiveBytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    (output / "snapshot-lock.json").write_text(json.dumps(lock, indent=2) + "\n")
    return lock


if __name__ == "__main__":
    site = Path(__file__).resolve().parent.parent
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else site / "dist/docs-snapshot"
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else site / "dist/docs-artifact"
    print(json.dumps(package_snapshot(root, output), indent=2))
