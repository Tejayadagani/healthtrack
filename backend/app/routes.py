"""API route handlers for health checks and patient symptom logs."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SymptomLog
from app.schemas import SymptomCreate, SymptomCreateResponse, SymptomLogOut

router = APIRouter(prefix="/api", tags=["symptoms"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Return basic service health status."""
    return {"status": "ok"}


@router.post(
    "/symptoms",
    response_model=SymptomCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_symptom(
    payload: SymptomCreate,
    db: Session = Depends(get_db),
) -> SymptomCreateResponse:
    """Validate and persist a new symptom log entry."""
    entry = SymptomLog(
        patient_id=payload.patient_id,
        description=payload.description,
        severity=payload.severity,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return SymptomCreateResponse(
        message="Symptom logged successfully",
        data=SymptomLogOut.model_validate(entry),
    )


@router.get(
    "/patients/{patient_id}/symptoms",
    response_model=list[SymptomLogOut],
)
def get_patient_symptoms(
    patient_id: str,
    db: Session = Depends(get_db),
) -> list[SymptomLog]:
    """Return all symptom logs for a patient ordered oldest to newest."""
    stmt = (
        select(SymptomLog)
        .where(SymptomLog.patient_id == patient_id.strip())
        .order_by(SymptomLog.timestamp.asc(), SymptomLog.id.asc())
    )
    return list(db.scalars(stmt).all())
