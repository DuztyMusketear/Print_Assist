"""Generate frontend types from the actual API contract without a server."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from print_assist.api import create_app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    check = parser.parse_args().check
    target = ROOT / "frontend/src/types.ts"
    (ROOT / ".tools").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=ROOT / ".tools") as temporary:
        folder = Path(temporary)
        schema = folder / "openapi.json"
        schema.write_text(json.dumps(create_app(folder / "schema.sqlite3").openapi()), encoding="utf-8")
        output = folder / "types.ts"
        tool = ROOT / "node_modules/.bin" / ("openapi-typescript.cmd" if sys.platform == "win32" else "openapi-typescript")
        subprocess.run([str(tool),str(schema),"-o",str(output)],check=True,cwd=ROOT)
        generated = output.read_text(encoding="utf-8")
        if check:
            if target.read_text(encoding="utf-8") != generated:
                raise SystemExit("API types drifted. Run python scripts/schema.py")
        else:
            target.write_text(generated,encoding="utf-8")


if __name__ == "__main__":
    main()
