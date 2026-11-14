"""Deterministic, manually advanced simulated production."""
from copy import deepcopy
from datetime import datetime, timedelta
from .scheduling import schedule
from .activity import record


def advance(state: dict, seconds: int) -> dict:
    if seconds < 0:
        raise ValueError("Time advance must not be negative")
    if seconds == 0:
        return deepcopy(state)
    result = deepcopy(state)
    eligible={printer['id'] for printer in result['printers'] if printer['status']=='running'}
    running = [job for job in result["jobs"] if job["status"] == "running" and job['printer_id'] in eligible]
    if running:
        boundary = min(job.get("duration_seconds", 7200) - job.get("elapsed_seconds", 0) for job in running)
        for job in running:
            order=next(o for o in result['orders'] if o['id']==job['order_id'])
            artifact=next(a for a in result['artifacts'] if a['id']==order['artifact_id'])
            printer=next(p for p in result['printers'] if p['id']==job['printer_id'])
            exhaustion=printer['material']['grams']*artifact['duration_seconds']/artifact['filament_grams']
            if exhaustion<=1e-9:
                from .incidents import inject_fault
                result=inject_fault(result,dict(printer_id=printer['id'],fault_type='filament_runout',event_id=f"runout:{job['id']}:{result['simulation_time']}"))
                return advance(result,seconds)
            boundary=min(boundary,exhaustion)
        if 0 < boundary < seconds:
            return advance(advance(result, boundary), seconds - boundary)
    result["simulation_time"] = (datetime.fromisoformat(result["simulation_time"].replace("Z", "+00:00")) + timedelta(seconds=seconds)).isoformat()
    exhausted=[]
    for job in result["jobs"]:
        if job["status"] != "running" or job['printer_id'] not in eligible:
            continue
        order = next(item for item in result["orders"] if item["id"] == job["order_id"])
        artifact = next(item for item in result["artifacts"] if item["id"] == order["artifact_id"])
        printer = next(item for item in result["printers"] if item["id"] == job["printer_id"])
        elapsed = job.get("elapsed_seconds", 0)
        delta = min(seconds, artifact["duration_seconds"] - elapsed)
        consumed=artifact["filament_grams"] * delta / artifact["duration_seconds"]
        printer['material']['grams']=max(0,printer['material']['grams']-consumed)
        job["elapsed_seconds"] = elapsed + delta
        if job["elapsed_seconds"] >= artifact["duration_seconds"]-1e-9:
            job["status"] = "completed"
            printer["status"] = "idle"
            order["successful_quantity"] += 1
            record(result,'job_completed','Completed one item',source='simulation',order_id=order['id'],printer_id=printer['id'],job_id=job['id'])
            if order["successful_quantity"] == order["quantity"]:
                order["status"] = "print_complete"
        elif printer['material']['grams']<=1e-9:
            exhausted.append((printer['id'],job['id']))
    for printer_id,job_id in exhausted:
        from .incidents import inject_fault
        result=inject_fault(result,dict(printer_id=printer_id,fault_type='filament_runout',event_id=f"runout:{job_id}:{result['simulation_time']}"))
    from .recovery import refresh_incidents
    return refresh_incidents(schedule(schedule(result, "automatic", preserve_mode=True), "manual", preserve_mode=True))
