"""Pydantic v2 schemas for symptom validation and serialization."""

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, StrictInt, field_serializer, field_validator


def _ensure_utc(value: datetime) -> datetime:
    """Attach UTC timezone to naive datetimes or convert aware ones to UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class SymptomCreate(BaseModel):
    """Request payload for creating a symptom log entry."""

    patient_id: str
    description: str
    severity: StrictInt

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Patient ID is required")
        if len(trimmed) > 50:
            raise ValueError("Patient ID must be 50 characters or fewer")
        return trimmed

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Symptom description is required")
        if len(trimmed) > 500:
            raise ValueError("Symptom description must be 500 characters or fewer")
        return trimmed

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity_type(cls, value: Any) -> Any:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("Severity must be an integer between 1 and 10")
        return value

    @field_validator("severity")
    @classmethod
    def validate_severity_range(cls, value: int) -> int:
        if value < 1 or value > 10:
            raise ValueError("Severity must be between 1 and 10")
        return value


class SymptomLogOut(BaseModel):
    """Serialized symptom log returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: str
    description: str
    severity: int
    timestamp: datetime

    @field_validator("timestamp", mode="before")
    @classmethod
    def normalize_timestamp(cls, value: Any) -> Any:
        if isinstance(value, datetime):
            return _ensure_utc(value)
        return value

    @field_serializer("timestamp")
    def serialize_timestamp(self, value: datetime) -> str:
        utc_dt = _ensure_utc(value)
        return utc_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class SymptomCreateResponse(BaseModel):
    """Response envelope for POST /api/symptoms."""

    message: str
    data: SymptomLogOut


class ValidationErrorItem(BaseModel):
    """Single field-level validation error."""

    field: str
    message: str


class ValidationErrorResponse(BaseModel):
    """Error response envelope for HTTP 422 validation errors."""

    message: str = "Validation failed"
    errors: list[ValidationErrorItem]
