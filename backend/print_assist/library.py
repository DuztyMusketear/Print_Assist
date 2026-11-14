"""Bounded local STL intake and explicit print-profile approval; no slicing."""
import base64
import binascii
from copy import deepcopy
import math
import re
import struct

from .activity import record
from .modeling import create_task, move_task
from .visual_assets import ASSETS

MAX_BYTES = 10 * 1024 * 1024
MAX_TRIANGLES = 100000


def decode_mesh(encoded):
    try:
        data = base64.b64decode(encoded, validate=True)
    except binascii.Error as error:
        raise ValueError('Choose a valid STL file') from error
    if len(data) > MAX_BYTES:
        raise ValueError('STL exceeds the 10 MiB upload limit')
    count = struct.unpack_from('<I', data, 80)[0] if len(data) >= 84 else 0
    if len(data) >= 84 and (not data.startswith(b'solid') or 84 + count * 50 == len(data)):
        if count > MAX_TRIANGLES or 84 + count * 50 != len(data):
            raise ValueError('Invalid binary STL or more than 100,000 triangles')
        points = [struct.unpack_from('<3f', data, 84 + face * 50 + 12 + corner * 12)
                  for face in range(count) for corner in range(3)]
        normals = [struct.unpack_from('<3f', data, 84 + face * 50) for face in range(count)]
    else:
        try:
            text = data.decode('ascii')
            envelope = re.fullmatch(r'\s*solid[^\r\n]*[\r\n]+(.*?)\s*endsolid[^\r\n]*\s*', text, re.DOTALL)
            if envelope is None:
                raise ValueError('Invalid ASCII STL')
            pattern = r'facet\s+normal\s+(\S+)\s+(\S+)\s+(\S+)\s+outer\s+loop\s+' + r'vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+' * 3 + r'endloop\s+endfacet'
            body = envelope.group(1)
            if re.sub(pattern, '', body).strip():
                raise ValueError('ASCII STL must contain complete facets')
            facets = [tuple(map(float, face)) for face in re.findall(pattern, body)]
            normals = [face[:3] for face in facets]
            points = [face[offset:offset + 3] for face in facets for offset in (3, 6, 9)]
        except (UnicodeDecodeError, ValueError) as error:
            raise ValueError('Invalid ASCII STL') from error
    if not points or len(points) % 3 or len(points) // 3 > MAX_TRIANGLES:
        raise ValueError('STL must contain 1 to 100,000 complete triangles')
    if not all(math.isfinite(value) and abs(value) <= 3.4028234663852886e38 for point in points + normals for value in point):
        raise ValueError('STL contains nonfinite coordinates')
    # Match the Float32 precision used by Three before validating dimensions/area.
    points = [struct.unpack('<3f', struct.pack('<3f', *point)) for point in points]
    for index in range(0, len(points), 3):
        a, b, c = points[index:index + 3]
        u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
        if not any(u[i] * v[(i + 1) % 3] - u[(i + 1) % 3] * v[i] for i in range(3)):
            raise ValueError('STL contains a degenerate triangle')
    size = [max(p[i] for p in points) - min(p[i] for p in points) for i in range(3)]
    if any(value > limit for value, limit in zip(size, (220, 220, 250))):
        raise ValueError('Model exceeds the virtual 220 x 220 x 250 mm build volume')
    return data


def save_model(state, payload, digest):
    result = deepcopy(state)
    asset_id = 'upload-' + digest
    assets = result.setdefault('visual_assets', deepcopy(ASSETS))
    if not any(asset['id'] == asset_id for asset in assets):
        assets.append(dict(id=asset_id, name=payload['name'], path='/api/models/' + digest + '.stl', units='mm', rotation_degrees=[0, 0, 0]))
    result = create_task(result, dict(title=payload['name'], modelReference=payload['filename'],
        duration_seconds=payload['duration_seconds'], filament_grams=payload['filament_grams'],
        filament_type=payload['filament_type'], color=payload['color'], required_capabilities=['FFF'], visual_asset_id=asset_id))
    task_id = result['modeling_tasks'][-1]['id']
    for action in ['prepare-supports', 'submit-review', 'approve']:
        result = move_task(result, dict(task_id=task_id, action=action, support_assessment=payload['support_assessment']))
    record(result, 'model_uploaded', 'Print-ready model saved with operator estimates and support assessment')
    return result
