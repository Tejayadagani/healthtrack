"""Automated backend tests for HealthTrack API and database constraints."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.main import app
from app.models import SymptomLog


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_symptom_returns_201_and_persists(client: TestClient) -> None:
    payload = {
        "patient_id": "P001",
        "description": "Headache since morning",
        "severity": 6,
    }
    post_res = client.post("/api/symptoms", json=payload)
    assert post_res.status_code == 201

    body = post_res.json()
    assert body["message"] == "Symptom logged successfully"
    created = body["data"]
    assert isinstance(created["id"], int)
    assert created["patient_id"] == "P001"
    assert created["description"] == "Headache since morning"
    assert created["severity"] == 6
    assert created["timestamp"].endswith("Z")

    get_res = client.get("/api/patients/P001/symptoms")
    assert get_res.status_code == 200
    records = get_res.json()
    assert len(records) == 1
    assert records[0] == created


def test_whitespace_trimming(client: TestClient) -> None:
    response = client.post(
        "/api/symptoms",
        json={
            "patient_id": "  P001  ",
            "description": "   Mild dizziness after standing   ",
            "severity": 4,
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["patient_id"] == "P001"
    assert data["description"] == "Mild dizziness after standing"


@pytest.mark.parametrize("bad_description", ["", "   ", "\t\n  "])
def test_empty_and_whitespace_descriptions_rejected(
    client: TestClient,
    bad_description: str,
) -> None:
    response = client.post(
        "/api/symptoms",
        json={
            "patient_id": "P001",
            "description": bad_description,
            "severity": 5,
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["message"] == "Validation failed"
    assert any(err["field"] == "description" for err in body["errors"])


def test_missing_description_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/symptoms",
        json={"patient_id": "P001", "severity": 5},
    )
    assert response.status_code == 422
    assert any(err["field"] == "description" for err in response.json()["errors"])


@pytest.mark.parametrize(
    "payload",
    [
        {"description": "Headache", "severity": 5},
        {"patient_id": "", "description": "Headache", "severity": 5},
        {"patient_id": "   ", "description": "Headache", "severity": 5},
    ],
)
def test_missing_and_empty_patient_ids_rejected(
    client: TestClient,
    payload: dict,
) -> None:
    response = client.post("/api/symptoms", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["message"] == "Validation failed"
    assert any(err["field"] == "patient_id" for err in body["errors"])


@pytest.mark.parametrize(
    "bad_severity",
    [0, 11, -1, 5.5, "5", "abc", True, False, None],
)
def test_invalid_severities_rejected(
    client: TestClient,
    bad_severity,
) -> None:
    response = client.post(
        "/api/symptoms",
        json={
            "patient_id": "P001",
            "description": "Fatigue",
            "severity": bad_severity,
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["message"] == "Validation failed"
    assert any(err["field"] == "severity" for err in body["errors"])


def test_missing_severity_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/symptoms",
        json={"patient_id": "P001", "description": "Fatigue"},
    )
    assert response.status_code == 422
    assert any(err["field"] == "severity" for err in response.json()["errors"])


def test_maximum_field_lengths(client: TestClient) -> None:
    max_patient_id = "P" * 50
    max_description = "D" * 500
    ok_res = client.post(
        "/api/symptoms",
        json={
            "patient_id": max_patient_id,
            "description": max_description,
            "severity": 10,
        },
    )
    assert ok_res.status_code == 201

    too_long_patient = client.post(
        "/api/symptoms",
        json={
            "patient_id": "P" * 51,
            "description": "Valid symptom",
            "severity": 1,
        },
    )
    assert too_long_patient.status_code == 422
    assert any(
        err["field"] == "patient_id" for err in too_long_patient.json()["errors"]
    )

    too_long_desc = client.post(
        "/api/symptoms",
        json={
            "patient_id": "P001",
            "description": "D" * 501,
            "severity": 1,
        },
    )
    assert too_long_desc.status_code == 422
    assert any(
        err["field"] == "description" for err in too_long_desc.json()["errors"]
    )


def test_multiple_rapid_submissions_have_valid_utc_timestamps(
    client: TestClient,
) -> None:
    timestamps: list[str] = []
    for idx in range(10):
        res = client.post(
            "/api/symptoms",
            json={
                "patient_id": "P001",
                "description": f"Rapid entry {idx}",
                "severity": (idx % 10) + 1,
            },
        )
        assert res.status_code == 201
        ts = res.json()["data"]["timestamp"]
        assert ts.endswith("Z")
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        assert parsed.tzinfo == timezone.utc
        timestamps.append(ts)

    assert len(set(timestamps)) == 10
    assert timestamps == sorted(timestamps)


def test_timestamp_ordering_oldest_first_with_id_tiebreaker(
    client: TestClient,
    db_session: Session,
) -> None:
    t_later = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)
    t_earlier = datetime(2026, 11, 18, 9, 30, 0, tzinfo=timezone.utc)

    first_inserted = SymptomLog(
        patient_id="P001",
        description="Later timestamp inserted first",
        severity=7,
        timestamp=t_later,
    )
    second_inserted = SymptomLog(
        patient_id="P001",
        description="Earlier timestamp inserted second",
        severity=3,
        timestamp=t_earlier,
    )
    third_inserted = SymptomLog(
        patient_id="P001",
        description="Same earlier timestamp higher id",
        severity=4,
        timestamp=t_earlier,
    )
    db_session.add_all([first_inserted, second_inserted, third_inserted])
    db_session.commit()

    response = client.get("/api/patients/P001/symptoms")
    assert response.status_code == 200
    descriptions = [item["description"] for item in response.json()]
    assert descriptions == [
        "Earlier timestamp inserted second",
        "Same earlier timestamp higher id",
        "Later timestamp inserted first",
    ]


def test_unknown_patient_returns_empty_list(client: TestClient) -> None:
    response = client.get("/api/patients/UNKNOWN_999/symptoms")
    assert response.status_code == 200
    assert response.json() == []


def test_patient_isolation(client: TestClient) -> None:
    client.post(
        "/api/symptoms",
        json={"patient_id": "P001", "description": "P1 headache", "severity": 5},
    )
    client.post(
        "/api/symptoms",
        json={"patient_id": "P002", "description": "P2 fever", "severity": 8},
    )

    p1_res = client.get("/api/patients/P001/symptoms")
    p2_res = client.get("/api/patients/P002/symptoms")
    assert p1_res.status_code == 200
    assert p2_res.status_code == 200

    p1_items = p1_res.json()
    p2_items = p2_res.json()
    assert len(p1_items) == 1
    assert len(p2_items) == 1
    assert p1_items[0]["patient_id"] == "P001"
    assert p1_items[0]["description"] == "P1 headache"
    assert p2_items[0]["patient_id"] == "P002"
    assert p2_items[0]["description"] == "P2 fever"


def test_xss_looking_text_is_preserved(client: TestClient) -> None:
    xss_text = '<script>alert("xss")</script> & <img src=x onerror=alert(1)>'
    post_res = client.post(
        "/api/symptoms",
        json={
            "patient_id": "P001",
            "description": xss_text,
            "severity": 5,
        },
    )
    assert post_res.status_code == 201
    assert post_res.json()["data"]["description"] == xss_text

    get_res = client.get("/api/patients/P001/symptoms")
    assert get_res.status_code == 200
    assert get_res.json()[0]["description"] == xss_text


@pytest.mark.parametrize("bad_severity", [0, 11, -3])
def test_database_severity_check_constraint(
    db_session: Session,
    bad_severity: int,
) -> None:
    db_session.add(
        SymptomLog(
            patient_id="P001",
            description="Direct DB constraint check",
            severity=bad_severity,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_cors_allows_only_configured_frontend_origin(client: TestClient) -> None:
    allowed = client.options(
        "/api/symptoms",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    disallowed = client.options(
        "/api/symptoms",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in disallowed.headers


def test_unexpected_server_error_hides_traceback() -> None:
    def broken_get_db():
        raise RuntimeError("sensitive internal connection detail")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_get_db
    try:
        with TestClient(app, raise_server_exceptions=False) as error_client:
            response = error_client.get("/api/patients/P001/symptoms")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    assert response.json() == {"message": "An unexpected internal error occurred"}
    assert "Traceback" not in response.text
    assert "sensitive internal connection detail" not in response.text
