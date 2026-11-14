"""Run from the repository root using the project virtual environment."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
from uuid import uuid4


def run_commands(commands):
    for command in commands:
        result = subprocess.run(command, check=False)
        if result.returncode:
            return result.returncode
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["unit", "full", "coverage"])
    mode = parser.parse_args().mode
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    # A portable local Node install is optional; ordinary PATH works elsewhere.
    for node_dir in sorted((root / ".tools").glob("node-*-win-x64")):
        os.environ["PATH"] = str(node_dir) + os.pathsep + os.environ["PATH"]
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        parser.exit(2, "Node/npm not found. Follow docs/development.md.\n")
    run_id = uuid4().hex
    os.environ["COVERAGE_FILE"] = str(root / f".coverage-{run_id}")
    backend = [sys.executable, "-m", "pytest", "-q", "--tb=short", "-p", "no:cacheprovider", f"--basetemp=.pytest-tmp-{run_id}"]
    if mode == "unit":
        backend.append("backend/tests/unit")
    if mode == "coverage":
        backend += ["--cov=print_assist", "--cov-report=term-missing"]
    frontend = [npm,"run","coverage" if mode == "coverage" else "test","--workspace","frontend"]
    if mode == "coverage":
        frontend += ["--", f"--coverage.reportsDirectory=../.tools/coverage-{run_id}"]
    commands = [backend, frontend]
    if mode != "unit":
        commands += [[sys.executable, "scripts/schema.py", "--check"], [npm,"run","build"], [npm,"run","e2e"]]
    return run_commands(commands)


if __name__ == "__main__":
    raise SystemExit(main())
