"""Allowlisted local preview assets; production file references are never URLs."""
ASSETS = [{"id": "example-tower", "name": "Example calibration tower", "path": "/models/example-tower.stl",
           "units": "mm", "rotation_degrees": [0, 0, 0]}]


def known_visual_asset(value):
    if value is not None and value not in {asset['id'] for asset in ASSETS}:
        raise ValueError('Unknown visual asset')
    return value
