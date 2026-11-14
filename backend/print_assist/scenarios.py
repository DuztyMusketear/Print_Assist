"""Versioned, deterministic starting state; no inference dependencies."""


def initial_state() -> dict:
    return {
        "session_id": "", "revision": 0,
        "simulation_time": "2026-11-15T00:00:00Z", "running": False,
        "printers": [], "orders": [], "jobs": [], "events": [],
        "controls": {"agents_enabled": False, "automatic_triggers": False},
        "artifacts": [{
            "id": "figure-pla-blue", "name": "Blue PLA figure",
            "revision": 1, "reference": "fixtures/blue-figure.gcode",
            "filament_type": "PLA", "color": "blue",
            "duration_seconds": 7200, "filament_grams": 25,
            "required_capabilities": ["FFF"],
        }],
    }
