import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("package_snapshot", Path(__file__).with_name("package-snapshot.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PackageSnapshotTests(unittest.TestCase):
    def fixture(self, root):
        (root / "start").mkdir()
        (root / "index.html").write_text("Home")
        (root / "start/index.html").write_text("Start")
        (root / "agent-guide.md").write_text("Guide")
        (root / "snapshot.json").write_text(json.dumps({
            "schemaVersion": 1, "sourceRevision": "a" * 40,
            "sourceDirty": False, "agentGuideCliVersion": "0.16.0-rc.1",
        }))

    def test_bytes_ignore_source_mtime_and_permissions(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name) / "site"
            root.mkdir()
            self.fixture(root)
            first = module.package_snapshot(root, Path(name) / "first")
            (root / "index.html").chmod(0o755)
            import os
            os.utime(root / "index.html", (1, 1))
            second = module.package_snapshot(root, Path(name) / "second")
            self.assertEqual(first, second)

    def test_rejects_symlinks_and_hidden_files(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name) / "site"
            root.mkdir()
            self.fixture(root)
            link = root / "escape"
            link.symlink_to(root / "index.html")
            with self.assertRaises(ValueError):
                module.package_snapshot(root, Path(name) / "out")
            link.unlink()
            (root / ".env").write_text("private")
            with self.assertRaises(ValueError):
                module.package_snapshot(root, Path(name) / "out")


if __name__ == "__main__":
    unittest.main()
