"""Idempotent synthetic seed script for HealthTrack demo data."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import SymptomLog


def _build_seed_entries(now: datetime) -> list[dict]:
    """Build synthetic symptom records across the past 30 UTC days."""
    today_midnight = datetime(
        now.year, now.month, now.day, 12, 0, 0, tzinfo=timezone.utc
    )

    return [
        # P001: 9 synthetic records across 6 UTC days (including same-day pairs)
        {
            "patient_id": "P001",
            "description": "Mild morning tension headache",
            "severity": 4,
            "timestamp": today_midnight - timedelta(days=18, hours=3),
        },
        {
            "patient_id": "P001",
            "description": "Fatigue and eye strain after screen work",
            "severity": 6,
            "timestamp": today_midnight - timedelta(days=18, hours=-4),
        },
        {
            "patient_id": "P001",
            "description": "Dry cough and scratchy throat",
            "severity": 5,
            "timestamp": today_midnight - timedelta(days=12, hours=2),
        },
        {
            "patient_id": "P001",
            "description": "Worsening cough with mild chest tightness",
            "severity": 7,
            "timestamp": today_midnight - timedelta(days=9, hours=1),
        },
        {
            "patient_id": "P001",
            "description": "Low-grade fever and body aches",
            "severity": 8,
            "timestamp": today_midnight - timedelta(days=5, hours=4),
        },
        {
            "patient_id": "P001",
            "description": "Fever subsiding, lingering fatigue",
            "severity": 6,
            "timestamp": today_midnight - timedelta(days=5, hours=-3),
        },
        {
            "patient_id": "P001",
            "description": "Mild nasal congestion in the morning",
            "severity": 3,
            "timestamp": today_midnight - timedelta(days=2, hours=2),
        },
        {
            "patient_id": "P001",
            "description": "Occasional cough, energy improving",
            "severity": 2,
            "timestamp": today_midnight - timedelta(days=1, hours=3),
        },
        {
            "patient_id": "P001",
            "description": "Slight residual throat dryness",
            "severity": 2,
            "timestamp": today_midnight - timedelta(days=1, hours=-2),
        },
        # P002: 5 synthetic records across 4 UTC days (including same-day pair)
        {
            "patient_id": "P002",
            "description": "Lower back stiffness upon waking",
            "severity": 6,
            "timestamp": today_midnight - timedelta(days=14, hours=4),
        },
        {
            "patient_id": "P002",
            "description": "Lightheadedness after standing quickly",
            "severity": 5,
            "timestamp": today_midnight - timedelta(days=10, hours=1),
        },
        {
            "patient_id": "P002",
            "description": "Sharp knee soreness during walk",
            "severity": 7,
            "timestamp": today_midnight - timedelta(days=4, hours=3),
        },
        {
            "patient_id": "P002",
            "description": "Knee soreness easing after rest",
            "severity": 4,
            "timestamp": today_midnight - timedelta(days=4, hours=-2),
        },
        {
            "patient_id": "P002",
            "description": "Mild afternoon nausea",
            "severity": 3,
            "timestamp": today_midnight - timedelta(days=1, hours=1),
        },
    ]


def seed() -> tuple[int, int]:
    """Insert synthetic demo records if they do not already exist."""
    init_db()
    now = datetime.now(timezone.utc)
    entries = _build_seed_entries(now)

    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        existing_pairs = set(
            db.execute(
                select(SymptomLog.patient_id, SymptomLog.description)
            ).all()
        )

        for item in entries:
            key = (item["patient_id"], item["description"])
            if key in existing_pairs:
                skipped += 1
                continue
            db.add(
                SymptomLog(
                    patient_id=item["patient_id"],
                    description=item["description"],
                    severity=item["severity"],
                    timestamp=item["timestamp"],
                )
            )
            existing_pairs.add(key)
            inserted += 1

        db.commit()
    finally:
        db.close()

    return inserted, skipped


if __name__ == "__main__":
    added, already_present = seed()
    print(f"Seed complete: inserted={added}, skipped={already_present}")
