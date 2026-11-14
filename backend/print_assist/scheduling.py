"""Deterministic scheduling transitions."""
from copy import deepcopy
from .activity import record
from .reservations import free_grams


def blocked_reason(printers,artifact):
    idle=[printer for printer in printers if printer['status']=='idle']
    if not idle:
        return 'No idle printer is available'
    capable=[printer for printer in idle if set(artifact['required_capabilities']).issubset(printer['capabilities'])]
    if not capable:
        return 'Available printers lack required capabilities'
    material=[printer for printer in capable if printer['material']['type']==artifact['filament_type'] and printer['material']['color']==artifact['color']]
    if not material:
        return 'Available printers have a different filament type or color'
    return 'Insufficient filament for the remaining work'


def schedule(state: dict, mode: str = "automatic", preserve_mode: bool = False) -> dict:
    result = deepcopy(state)
    for job_id in [j['id'] for j in result['jobs'] if j['status']=='planned']:
        job=next(j for j in result['jobs'] if j['id']==job_id)
        printer=next(p for p in result['printers'] if p['id']==job['printer_id'])
        if printer['status']=='idle':
            printer['status']='reserved';job['status']='pending'
            if job['schedule_mode']=='automatic': result=start_job(result,job['id'])
    orders = sorted(result["orders"], key=lambda order: (-order["priority"], order["production_due"], order["id"]))
    for order in orders:
        if order.get('requires_schedule_review'):
            continue
        if not preserve_mode or not order.get("schedule_mode"):
            order["schedule_mode"] = mode
        if order["schedule_mode"] != mode:
            continue
        artifact = next(item for item in result["artifacts"] if item["id"] == order["artifact_id"])
        existing = sum(job["order_id"] == order["id"] and job["status"] in ("running", "pending", "paused", "planned") for job in result["jobs"])
        for _ in range(max(0, order["quantity"] - order["successful_quantity"] - existing)):
            printer = next((item for item in result["printers"] if item["status"] == "idle"
                            and set(artifact["required_capabilities"]).issubset(item["capabilities"])
                            and item["material"]["type"] == artifact["filament_type"]
                            and item["material"]["color"] == artifact["color"]
                            and free_grams(result,item)+1e-9 >= artifact["filament_grams"]), None)
            if printer is None:
                record(result,'assignment_blocked',blocked_reason(result['printers'],artifact),
                       source='simulation' if preserve_mode else 'user',status='blocked',order_id=order['id'])
                break
            printer["status"] = "running" if mode == "automatic" else "reserved"
            attempt = sum(job["order_id"] == order["id"] for job in result["jobs"]) + 1
            result["jobs"].append({"id": f"{order['id']}-{attempt}", "order_id": order["id"], "printer_id": printer["id"], "status": "running" if mode == "automatic" else "pending", "elapsed_seconds": 0, "duration_seconds": artifact["duration_seconds"]})
            record(result,'job_assigned','Assigned work to '+printer['id'],source='simulation' if preserve_mode else 'user',
                   order_id=order['id'],printer_id=printer['id'],job_id=result['jobs'][-1]['id'])
    return result


def start_job(state: dict, job_id: str) -> dict:
    result = deepcopy(state)
    job = next(job for job in result["jobs"] if job["id"] == job_id)
    if job["status"] not in ("pending", "paused"):
        raise ValueError("Job is not pending")
    printer = next(printer for printer in result["printers"] if printer["id"] == job["printer_id"])
    if printer["status"] not in ("reserved", "paused"):
        raise ValueError("Printer is unavailable")
    order=next(order for order in result['orders'] if order['id']==job['order_id'])
    artifact=next(artifact for artifact in result['artifacts'] if artifact['id']==order['artifact_id'])
    if not set(artifact['required_capabilities']).issubset(printer['capabilities']):
        raise ValueError('Printer lacks required capabilities')
    remaining=artifact['filament_grams']*(1-job.get('elapsed_seconds',0)/artifact['duration_seconds'])
    if printer['material']['type']!=artifact['filament_type'] or printer['material']['color']!=artifact['color'] or printer['material']['grams']+1e-9<remaining:
        raise ValueError('Printer filament does not meet remaining requirements')
    printer["status"] = "running"
    job["status"] = "running"
    job.pop('suspended_status',None)
    record(result,'job_started','Started work on '+printer['id'],order_id=order['id'],printer_id=printer['id'],job_id=job['id'])
    return result
