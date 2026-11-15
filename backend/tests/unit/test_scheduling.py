import copy
import pytest

from print_assist.scenarios import initial_state


def test_schedule_starts_compatible_orders_by_deadline_then_priority():
    from print_assist.scheduling import schedule

    state = initial_state()
    state["orders"] = [
        {"id": "later", "artifact_id": "figure-pla-blue", "quantity": 1,
         "successful_quantity": 0, "status": "queued", "priority": 1,
         "production_due": "2026-11-20T12:00:00Z"},
        {"id": "urgent", "artifact_id": "figure-pla-blue", "quantity": 1,
         "successful_quantity": 0, "status": "queued", "priority": 2,
         "production_due": "2026-11-21T12:00:00Z"},
    ]
    original = copy.deepcopy(state)
    result = schedule(state)
    assert state == original
    assert [job["order_id"] for job in result["jobs"]] == ["later", "urgent"]
    assert all(job["status"] == "running" for job in result["jobs"])
    assert len({job["printer_id"] for job in result["jobs"]}) == 2


def test_completed_attempts_do_not_block_remaining_quantity():
    from print_assist.scheduling import schedule

    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 2,
                        "successful_quantity": 1, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    state["jobs"] = [{"order_id": "order", "printer_id": "printer-1", "status": "completed"}]
    result = schedule(state)
    assert len(result["jobs"]) == 2
    assert result["jobs"][-1]["status"] == "running"


def test_scheduling_does_not_reassign_active_work_or_incompatible_printers():
    from print_assist.scheduling import schedule

    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 2,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    state["printers"][0]["material"]["color"] = "red"
    state["printers"][1]["material"]["grams"] = 1
    first = schedule(state)
    assert len(first["jobs"]) == 1
    assert first["jobs"][0]["printer_id"] == "printer-3"
    assert schedule(first) == first


def test_manual_mode_waits_until_operator_starts_the_job():
    from print_assist.scheduling import schedule, start_job

    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 1,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    scheduled = schedule(state, mode="manual")
    assert scheduled["jobs"][0]["status"] == "pending"
    assert scheduled["printers"][0]["status"] == "reserved"
    started = start_job(scheduled, scheduled["jobs"][0]["id"])
    assert started["jobs"][0]["status"] == "running"
    assert started["printers"][0]["status"] == "running"


def test_progress_consumes_material_and_completes_only_once():
    from print_assist.scheduling import schedule
    from print_assist.simulation import advance

    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 1,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    started = schedule(state)
    halfway = advance(started, 3600)
    assert halfway["jobs"][0]["elapsed_seconds"] == 3600
    assert halfway["printers"][0]["material"]["grams"] == 987.5
    finished = advance(halfway, 3600)
    assert finished["jobs"][0]["status"] == "completed"
    assert finished["orders"][0]["successful_quantity"] == 1
    assert finished["orders"][0]["status"] == "print_complete"
    assert finished["printers"][0]["status"] == "idle"
    assert advance(finished, 3600)["orders"][0]["successful_quantity"] == 1


def test_start_rejects_running_job_or_unavailable_printer():
    from print_assist.scheduling import start_job
    state = initial_state()
    state["jobs"] = [{"id": "job", "printer_id": "printer-1", "status": "running"}]
    with pytest.raises(ValueError, match="not pending"):
        start_job(state, "job")
    state["jobs"][0]["status"] = "pending"
    with pytest.raises(ValueError, match="unavailable"):
        start_job(state, "job")


def test_advance_rejects_negative_and_counts_partial_order():
    from print_assist.scheduling import schedule
    from print_assist.simulation import advance
    state = initial_state()
    with pytest.raises(ValueError, match="negative"):
        advance(state, -1)
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 2,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    state["printers"][1]["status"] = "offline"
    state["printers"][2]["status"] = "offline"
    result = advance(schedule(state), 7200)
    assert result["orders"][0]["successful_quantity"] == 1
    assert result["orders"][0]["status"] == "queued"


def test_automatic_queue_starts_remaining_items_when_printers_become_free():
    from print_assist.scheduling import schedule
    from print_assist.simulation import advance
    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 4,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    started = schedule(state)
    assert len(started["jobs"]) == 3
    result = advance(started, 7200)
    assert len(result["jobs"]) == 4
    assert result["jobs"][-1]["status"] == "running"


def test_zero_advance_does_not_schedule_or_change_time():
    from print_assist.simulation import advance
    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 1,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    assert advance(state, 0) == state


def test_large_advance_matches_two_smaller_advances():
    from print_assist.scheduling import schedule
    from print_assist.simulation import advance
    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 4,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    started = schedule(state)
    assert advance(started, 14400) == advance(advance(started, 7200), 7200)


def test_unscheduled_order_can_change_mode():
    from print_assist.scheduling import schedule
    state = initial_state()
    state["orders"] = [{"id": "order", "artifact_id": "figure-pla-blue", "quantity": 1,
                        "successful_quantity": 0, "status": "queued", "priority": 1,
                        "production_due": "2026-11-20T12:00:00Z"}]
    for printer in state["printers"]:
        printer["status"] = "offline"
    state = schedule(state, "manual")
    state["printers"][0]["status"] = "idle"
    assert schedule(state, "automatic")["jobs"][0]["status"] == "running"
