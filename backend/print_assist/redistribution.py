"""Transfer approved unfinished parts when ordinary controls remove capacity."""
from copy import deepcopy
from datetime import datetime, timedelta

from .activity import record
from .reservations import ACTIVE, free_grams
from .schedule_impact import capture_schedule, compare_parts, compare_schedules


def redistribute(state, source_printer=None, action='retry'):
    """Keep completed/healthy work fixed, with full retries for interrupted parts.

    Deferred parts remain active commitments, so the normal scheduler cannot
    regenerate them. They are retried when scheduling next observes capacity.
    """
    result = deepcopy(state)
    if source_printer is not None:
        printer = next(p for p in result['printers'] if p['id'] == source_printer)
        printer['status'] = 'paused' if action == 'pause' else 'offline'
    # Ordinary scheduling does not need impact projection when nothing moves.
    if not any(j['status'] in ACTIVE and (j.get('workload_transfer_pending')
            or j['printer_id'] == source_printer) for j in result['jobs']):
        return result
    before = capture_schedule(state)
    orders = {o['id']: o for o in result['orders']}
    waste = 0
    for job in list(result['jobs']):
        if job['printer_id'] != source_printer or job['status'] not in ACTIVE:
            continue
        order = orders[job['order_id']]
        # ACTIVE jobs are already approved commitments, including applied
        # recovery attempts. Historical incident metadata and sibling-part
        # holds must not prevent transferring this specific approved part.
        # Unapproved incident-owned attempts remain failed/recovery_pending.
        artifact = next(a for a in result['artifacts'] if a['id'] == order['artifact_id'])
        job.setdefault('part_key', job['id'])
        if job['status'] == 'running' or job.get('elapsed_seconds', 0):
            consumed = artifact['filament_grams'] * job.get('elapsed_seconds', 0) / artifact['duration_seconds']
            job.update(status='failed', waste_grams=consumed)
            waste += consumed
            attempt = 1 + sum(j['order_id'] == order['id'] for j in result['jobs'])
            retry = dict(id=f"{order['id']}-{attempt}", order_id=order['id'],
                printer_id=source_printer, part_key=job['part_key'], replaces_job_id=job['id'],
                duration_seconds=artifact['duration_seconds'], elapsed_seconds=0,
                schedule_mode=job.get('schedule_mode', order.get('schedule_mode') or 'automatic'))
            result['jobs'].append(retry)
            job = retry
        job.update(status='paused', workload_transfer_pending=True,
            transfer_source=source_printer)
        job.pop('suspended_status', None)

    pending = [j for j in result['jobs'] if j.get('workload_transfer_pending') and j['status'] in ACTIVE]
    # Remove the blocked source commitments only from the planning copy.
    draft = deepcopy(result)
    pending_ids = {j['id'] for j in pending}
    draft['jobs'] = [j for j in draft['jobs'] if j['id'] not in pending_ids]
    capacity = {p['id']: 0 if p['status'] == 'idle' and not p.get('fault') else None for p in draft['printers']}
    for job in draft['jobs']:
        printer = next(p for p in draft['printers'] if p['id'] == job['printer_id'])
        if job['status'] == 'running' and printer['status'] == 'running' and not printer.get('fault'):
            capacity[printer['id']] = job['duration_seconds'] - job.get('elapsed_seconds', 0)
    for job in draft['jobs']:
        if job['status'] == 'planned' and capacity[job['printer_id']] is not None:
            if job.get('schedule_mode') == 'manual':
                # Its operator start has no known time. Do not promise an
                # automatic finish behind a manual queue's unknown wait.
                capacity[job['printer_id']] = None
            else:
                capacity[job['printer_id']] += job['duration_seconds']
    stock = {p['id']: free_grams(draft, p) for p in draft['printers']}
    now = datetime.fromisoformat(result['simulation_time'].replace('Z', '+00:00'))
    assignments, blocked = [], []
    for job in sorted(pending, key=lambda j: (orders[j['order_id']]['production_due'],
            -orders[j['order_id']]['priority'], j['id'])):
        order = orders[job['order_id']]
        artifact = next(a for a in result['artifacts'] if a['id'] == order['artifact_id'])
        candidates = [p for p in draft['printers'] if capacity[p['id']] is not None
            and set(artifact['required_capabilities']).issubset(p['capabilities'])
            and p['material']['type'] == artifact['filament_type']
            and p['material']['color'] == artifact['color']
            and stock[p['id']] + 1e-9 >= artifact['filament_grams']]
        if order['status'] == 'cancelled':
            candidates = []
        if not candidates:
            blocked.append(dict(order_id=order['id'], job_id=job['id'], part_key=job['part_key'], quantity=1,
                reason='Approved transfer needs healthy compatible capacity and unreserved filament; review held orders or restore capacity.'))
            continue
        printer = min(candidates, key=lambda p: (capacity[p['id']], p['id']))
        pid = printer['id']
        start = capacity[pid]
        capacity[pid] += artifact['duration_seconds']
        stock[pid] -= artifact['filament_grams']
        job.update(printer_id=pid, status='planned',
            schedule_mode=job.get('schedule_mode', order.get('schedule_mode') or 'automatic'),
            estimated_start=(now + timedelta(seconds=start)).isoformat(),
            estimated_finish=(now + timedelta(seconds=capacity[pid])).isoformat())
        job.pop('workload_transfer_pending')
        assignments.append(dict(job_id=job['id'], order_id=order['id'], part_key=job['part_key'],
            action='restarted' if job.get('replaces_job_id') else 'moved'))
    if action == 'retry' and not assignments:
        return result
    after = capture_schedule(result)
    transfer_id = f"transfer-{len(result.get('workload_transfers', [])) + 1}"
    affected = {j['order_id'] for j in pending}
    impacts = compare_schedules(before, after, result, dict(id=transfer_id, order_ids=affected))
    for impact in impacts:
        impact['waste_grams'] = sum(j.get('waste_grams', 0) for j in result['jobs']
            if j['printer_id'] == source_printer and j['order_id'] == impact['order_id']
            and j['status'] == 'failed' and j['id'] in {b['id'] for b in before['jobs'] if b['status'] in ACTIVE})
    late = sum(i['risk'] == 'late' for i in impacts)
    parts = compare_parts(before, after, assignments + [dict(b, action='blocked') for b in blocked])
    for part in parts:
        due = datetime.fromisoformat(orders[part['order_id']]['production_due'].replace('Z', '+00:00'))
        finish = part['revised_finish']
        part['risk'] = 'unavailable' if finish is None else 'late' if datetime.fromisoformat(finish) > due else 'on_time'
    late_parts = sum(p['risk'] == 'late' for p in parts)
    summary = f"{len(assignments)} parts transferred; {len(blocked)} blocked; {late} late orders, {late_parts} late parts; {waste:.1f} g interrupted-print waste."
    sources = sorted({j['transfer_source'] for j in pending})
    report_source = source_printer or sources[0]
    result.setdefault('workload_transfers', []).append(dict(id=transfer_id,
        timestamp=result['simulation_time'], source_printer=report_source, source_printers=sources, action=action,
        before=before, after=after, impacts=impacts, part_impacts=parts,
        blocked=blocked, summary=summary, waste_grams=waste))
    record(result, 'workload_transferred', summary, source='system', printer_id=report_source)
    return result
