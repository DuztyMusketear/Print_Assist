"""Allowlisted local preview assets; production file references are never URLs."""
import re
ASSETS = [{"id": "example-tower", "name": "Example calibration tower", "path": "/models/example-tower.stl",
           "units": "mm", "rotation_degrees": [0, 0, 0]},
          {"id":"nist-test-artifact","name":"NIST AM Test Artifact","path":"/demo-models/nist-test-artifact.stl","units":"mm","rotation_degrees":[0,0,0]}]


def known_visual_asset(value):
    # Uploaded references additionally require persisted registration at creation.
    if value is not None and value not in {asset['id'] for asset in ASSETS} and re.fullmatch(r'upload-[a-f0-9]{64}',value) is None:
        raise ValueError('Unknown visual asset')
    return value
