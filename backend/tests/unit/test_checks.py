import sys

from scripts.check import run_commands


def test_runner_stops_and_propagates_failure(tmp_path):
    sentinel = tmp_path / "should-not-exist"
    result = run_commands([
        [sys.executable, "-c", "raise SystemExit(7)"],
        [sys.executable, "-c", f"from pathlib import Path; Path({str(sentinel)!r}).touch()"],
    ])
    assert result == 7
    assert not sentinel.exists()


def test_runner_success_creates_expected_artifact(tmp_path):
    output = tmp_path / "ran"
    assert run_commands([[sys.executable,"-c",f"from pathlib import Path; Path({str(output)!r}).write_text('ok')"]]) == 0
    assert output.read_text() == "ok"
