"""Build the public, source-only download. Never include runtime data/secrets."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / "public/downloads/kutuphane-guncel.zip"
output.parent.mkdir(parents=True, exist_ok=True)
directories = ["app", "db", "drizzle", "build", "worker", "scripts", "tests", "BELGELER", "examples", ".openai", "public"]
files = list(root.glob("*"))
for directory in directories:
    files += list((root / directory).rglob("*"))
files += [root / ".gitignore", root / ".npmrc"]
allowed = []
for path in sorted(set(files)):
    if not path.is_file():
        continue
    rel = path.relative_to(root)
    if len(rel.parts) > 1 and rel.parts[0] not in directories:
        continue
    if "downloads" in rel.parts or any(part in {"node_modules", ".git", "outputs", "work", "dist", ".wrangler", "__pycache__"} for part in rel.parts):
        continue
    if path.name.startswith(".env") or path.suffix.lower() in {".key", ".pem", ".sqlite", ".db", ".zip", ".enc", ".tsbuildinfo", ".pyc"}:
        continue
    allowed.append((path, rel.as_posix()))
manifest = {name: hashlib.sha256(path.read_bytes()).hexdigest() for path, name in allowed}
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path, name in allowed:
        archive.write(path, name)
    archive.writestr("SOURCE-MANIFEST.json", json.dumps({"release": "2026-11-04-member-display", "scope": "source only; no passwords, live records or R2 backup", "sha256": manifest}, ensure_ascii=False, indent=2))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
shutil.copy2(output, root / "public/Coklu-Okullu-Kutuphane-Otomasyonu-Son-Surum.zip")
print(f"Source ZIP ready: {len(allowed)} files, {output.stat().st_size} bytes")
