import pytest
from pydantic import ValidationError

from print_assist.contracts import validate_order


def test_valid_order_is_normalized_to_utc(order):
    order["production_due"] = "2026-11-15T07:00:00-05:00"
    result = validate_order(order)
    assert result.production_due.isoformat() == "2026-11-15T12:00:00+00:00"
    assert result.quantity == 2


@pytest.mark.parametrize("field,value", [
    ("quantity", 0), ("quantity", -1), ("quantity", 1.5),
    ("quantity", True), ("quantity", "2"), ("priority", -1),
    ("priority", 1.5), ("artifact_id", ""),
    ("production_due", "2026-11-17T00:00:00Z"),
    ("production_due", "2026-11-15T00:00:00"),
    ("ship_by", "not-a-date"), ("unexpected", "value"),
])
def test_invalid_order_is_rejected(order, field, value):
    order[field] = value
    with pytest.raises(ValidationError):
        validate_order(order)


def test_equal_due_and_ship_times_are_allowed(order):
    order["production_due"] = order["ship_by"]
    assert validate_order(order).quantity == 2
