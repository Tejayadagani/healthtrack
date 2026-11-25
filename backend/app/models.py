"""SQLAlchemy ORM models for HealthTrack."""

import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

_timestamp_lock = threading.Lock()
_last_timestamp: datetime | None = None


def utc_now() -> datetime:
    """Return a strictly monotonic timezone-aware UTC datetime."""
    global _last_timestamp
    now = datetime.now(timezone.utc)
    with _timestamp_lock:
        if _last_timestamp is not None and now <= _last_timestamp:
            now = _last_timestamp + timedelta(microseconds=1)
        _last_timestamp = now
        return now


class SymptomLog(Base):
    """Stores a single patient symptom entry."""

    __tablename__ = "symptom_logs"
    __table_args__ = (
        CheckConstraint(
            "severity >= 1 AND severity <= 10",
            name="ck_symptom_logs_severity_range",
        ),
        Index("ix_symptom_logs_patient_timestamp", "patient_id", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
