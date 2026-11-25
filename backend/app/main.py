"""FastAPI application entry point, middleware, and error handlers."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.routes import router as symptoms_router
from app.schemas import ValidationErrorItem, ValidationErrorResponse

ALLOWED_ORIGINS = ["http://localhost:5173"]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize database tables on application startup."""
    init_db()
    yield


app = FastAPI(
    title="HealthTrack API",
    description="Patient symptom tracking API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Format request validation failures into a consistent 422 payload."""
    errors: list[ValidationErrorItem] = []
    for err in exc.errors():
        loc_parts = [str(part) for part in err.get("loc", []) if part != "body"]
        field = ".".join(loc_parts) if loc_parts else "body"
        raw_message = str(err.get("msg", "Invalid value"))
        clean_message = raw_message.removeprefix("Value error, ")
        errors.append(ValidationErrorItem(field=field, message=clean_message))

    body = ValidationErrorResponse(message="Validation failed", errors=errors)
    return JSONResponse(
        status_code=422,
        content=body.model_dump(),
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    _request: Request,
    _exc: Exception,
) -> JSONResponse:
    """Return a safe 500 response without exposing tracebacks or patient data."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "An unexpected internal error occurred"},
    )


app.include_router(symptoms_router)
