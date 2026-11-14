"""Deterministic scheduling transitions."""
from copy import deepcopy


def schedule(state: dict, mode: str = "automatic", preserve_mode: bool = False) -> dict:
    result = deepcopy(state)
    orders = sorted(result["orders"], key=lambda order: (-order["priority"], order["production_due"], order["id"]))
    for order in orders:
        if not preserve_mode or not order.get("schedule_mode"):
            order["schedule_mode"] = mode
        if order["schedule_mode"] != mode:
            continue
        artifact = next(item for item in result["artifacts"] if item["id"] == order["artifact_id"])
        existing = sum(job["order_id"] == order["id"] and job["status"] in ("running", "pending", "paused") for job in result["jobs"])
        for _ in range(max(0, order["quantity"] - order["successful_quantity"] - existing)):
            printer = next((item for item in result["printers"] if item["status"] == "idle"
                            and set(artifact["required_capabilities"]).issubset(item["capabilities"])
                            and item["material"]["type"] == artifact["filament_type"]
                            and item["material"]["color"] == artifact["color"]
                            and item["material"]["grams"] >= artifact["filament_grams"]), None)
            if printer is None:
                break
            printer["status"] = "running" if mode == "automatic" else "reserved"
            attempt = sum(job["order_id"] == order["id"] for job in result["jobs"]) + 1
            result["jobs"].append({"id": f"{order['id']}-{attempt}", "order_id": order["id"], "printer_id": printer["id"], "status": "running" if mode == "automatic" else "pending", "elapsed_seconds": 0, "duration_seconds": artifact["duration_seconds"]})
    return result


def start_job(state: dict, job_id: str) -> dict:
    result = deepcopy(state)
    job = next(job for job in result["jobs"] if job["id"] == job_id)
    if job["status"] not in ("pending", "paused"):
        raise ValueError("Job is not pending")
    printer = next(printer for printer in result["printers"] if printer["id"] == job["printer_id"])
    if printer["status"] not in ("reserved", "paused"):
        raise ValueError("Printer is unavailable")
    printer["status"] = "running"
    job["status"] = "running"
    return result
