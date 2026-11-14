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
        if 0 < boundary < seconds:
            return advance(advance(result, boundary), seconds - boundary)
    result["simulation_time"] = (datetime.fromisoformat(result["simulation_time"].replace("Z", "+00:00")) + timedelta(seconds=seconds)).isoformat()
    for job in result["jobs"]:
        if job["status"] != "running" or job['printer_id'] not in eligible:
            continue
        order = next(item for item in result["orders"] if item["id"] == job["order_id"])
        artifact = next(item for item in result["artifacts"] if item["id"] == order["artifact_id"])
        printer = next(item for item in result["printers"] if item["id"] == job["printer_id"])
        elapsed = job.get("elapsed_seconds", 0)
        delta = min(seconds, artifact["duration_seconds"] - elapsed)
        consumed=artifact["filament_grams"] * delta / artifact["duration_seconds"]
        if consumed>printer['material']['grams']+1e-9:
            raise ValueError('Insufficient filament to advance work')
        printer['material']['grams']=max(0,printer['material']['grams']-consumed)
        job["elapsed_seconds"] = elapsed + delta
        if job["elapsed_seconds"] == artifact["duration_seconds"]:
            job["status"] = "completed"
            printer["status"] = "idle"
            order["successful_quantity"] += 1
            record(result,'job_completed','Completed one item',source='simulation',order_id=order['id'],printer_id=printer['id'],job_id=job['id'])
            if order["successful_quantity"] == order["quantity"]:
                order["status"] = "print_complete"
    return schedule(schedule(result, "automatic", preserve_mode=True), "manual", preserve_mode=True)
