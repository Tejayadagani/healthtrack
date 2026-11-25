# HealthTrack

HealthTrack is a full-stack patient symptom tracking web application built for the AidenAI take-home assessment. It enables logging patient symptoms with severity ratings, reviewing chronological patient history in local browser time, and visualizing 30-day daily-average severity trends.

---

## Implemented Features

- **Database persistence (`SymptomLog`)**: SQLite-backed SQLAlchemy 2.x model (`symptom_logs` table) storing `id`, `patient_id` (max 50 chars), `description` (text), `severity` (integer `1`–`10` enforced by a database `CHECK` constraint), and server-generated UTC `timestamp`, indexed on `(patient_id, timestamp)`.
- **Symptom submission API (`POST /api/symptoms`)**: Validates trimmed non-empty `patient_id` and `description` (max 500 chars) and strict integer `severity` (`1`–`10`, rejecting strings, floats, booleans, and `null`), preserves special characters, and returns HTTP `201` with ISO 8601 UTC (`Z`) timestamps.
- **Patient history API (`GET /api/patients/{patient_id}/symptoms`)**: Returns records isolated to the requested patient, sorted in SQL via `ORDER BY timestamp ASC, id ASC` (oldest first, newest last), and returns `[]` for unknown patients.
- **Health check (`GET /api/health`)**: Returns `{"status": "ok"}`.
- **Interactive React UI**:
  - Demo patient selector (`P001` and `P002`, defaulting to `P001`) with `AbortController` request cancellation and stale-response protection for both GET and POST requests.
  - Symptom submission form with optional health-issue tag/chips, inline validation, 500-character counter, `1`–`10` severity slider, loading state (`disabled` while saving), description reset on success while preserving severity, and failure recovery without losing input.
  - Chronological history table converting UTC timestamps to browser-local time, rendering severity badges, wrapping long descriptions, safely escaping text (no `dangerouslySetInnerHTML`), and scrolling to the newest row after submission.
  - **30-Day Daily-Average Severity Charts** (Recharts `LineChart`) computing UTC daily averages client-side over the current UTC day plus the preceding 29 UTC calendar days (omitting days without records), with a default **Separate per Issue** view (individual charts grouped by health issue) and an **All Combined** toggle.
  - Accessible `role="alert"` error banners (prioritizing submission errors over earlier fetch errors) with manual `Retry` for failed GET requests and dismissible success toast feedback.

---

## Technology Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.x, SQLite, Pydantic v2, pytest, HTTPX, Uvicorn
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, lucide-react, Vitest, React Testing Library

---

## Architecture Diagram

```text
+-------------------------------------------------------------------+
|                   React 18 + Vite Frontend                        |
|                    (http://localhost:5173)                        |
|                                                                   |
|  PatientSelector ─▶ usePatientSymptoms (AbortController & guards) |
|  SymptomForm     ─▶ symptomsApi.js (fetch, 422 & network errors)  |
|  HistoryTable    ◀─ UTC-to-local formatting & safe JSX text       |
|  SeverityChart   ◀─ calculateDailyAverages(logs) (30 UTC days)    |
+---------------------------------+---------------------------------+
                                  |
                     HTTP / JSON (CORS restricted
                      to http://localhost:5173)
                                  |
                                  ▼
+-------------------------------------------------------------------+
|                     FastAPI Backend API                           |
|                    (http://localhost:8000)                        |
|                                                                   |
|  GET  /api/health                                                 |
|  POST /api/symptoms                     ─▶ Pydantic v2 validation |
|  GET  /api/patients/{id}/symptoms       ─▶ 422 custom handler     |
|                                         ─▶ SQLAlchemy 2.x ORM     |
+---------------------------------+---------------------------------+
                                  |
                                  ▼
+-------------------------------------------------------------------+
|                     SQLite Database                               |
|                (backend/healthtrack.db)                           |
|                                                                   |
|  Table: symptom_logs                                              |
|  Index: ix_symptom_logs_patient_timestamp (patient_id, timestamp) |
|  Check: ck_symptom_logs_severity_range (severity 1..10)           |
+-------------------------------------------------------------------+
```

---

## Project Structure

```text
.
├── .gitignore
├── README.md
├── backend/
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py          # Engine, SessionLocal, get_db dependency, init_db
│   │   ├── main.py              # FastAPI app, lifespan, CORS, exception handlers
│   │   ├── models.py            # SymptomLog ORM model & monotonic UTC clock helper
│   │   ├── routes.py            # /api/health, /api/symptoms, /api/patients/{id}/symptoms
│   │   └── schemas.py           # Pydantic v2 validation & UTC 'Z' serialization
│   ├── scripts/
│   │   ├── __init__.py
│   │   └── seed.py              # Idempotent synthetic demo data seeder
│   └── tests/
│       ├── conftest.py          # Isolated temp SQLite fixtures & TestClient
│       └── test_symptoms.py     # 29 backend API, validation, and DB constraint tests
└── frontend/
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── App.test.jsx
        ├── index.css
        ├── main.jsx
        ├── api/
        │   └── symptomsApi.js
        ├── components/
        │   ├── HistoryTable.jsx
        │   ├── PatientSelector.jsx
        │   ├── SeverityTrendChart.jsx
        │   └── SymptomForm.jsx
        ├── hooks/
        │   └── usePatientSymptoms.js
        ├── test/
        │   └── setup.js
│   │   └── utils/
│   │       ├── calculateDailyAverages.js
│   │       ├── calculateDailyAverages.test.js
│   │       ├── groupSymptomsByIssue.js
│   │       └── groupSymptomsByIssue.test.js
```

---

## Setup & Running the Application

### 1. Backend Setup

**macOS / Linux:**
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell):**
```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Seed Synthetic Demo Data (Optional, Idempotent)

Run from `backend/` with the virtual environment activated:

```bash
python -m scripts.seed
```

This inserts 9 synthetic records for `P001` and 5 synthetic records for `P002` across multiple UTC days in the last 30 days (including same-day entries). Re-running the command skips already-seeded records without creating duplicates.

### 3. Run the Backend Server

From `backend/` with the virtual environment activated:

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive OpenAPI docs are available at `http://localhost:8000/docs`.

### 4. Frontend Setup

In a second terminal:

**macOS / Linux / Windows:**
```bash
cd frontend
npm install
```

### 5. Run the Frontend Dev Server

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Test Commands

**Backend (31 tests):**
```bash
cd backend
source .venv/bin/activate  # macOS / Linux (or .\.venv\Scripts\Activate.ps1 on Windows)
pytest -v
```

**Frontend (21 tests + production build):**
```bash
cd frontend
npm test -- --run && npm run build
```

---

## API Reference & Examples

### `GET /api/health`

Response (`200 OK`):
```json
{
  "status": "ok"
}
```

### `POST /api/symptoms`

Request:
```json
{
  "patient_id": "P001",
  "description": "Headache since morning",
  "severity": 6
}
```

Success Response (`201 Created`):
```json
{
  "message": "Symptom logged successfully",
  "data": {
    "id": 1,
    "patient_id": "P001",
    "description": "Headache since morning",
    "severity": 6,
    "timestamp": "2026-11-24T10:30:00.123456Z"
  }
}
```

Validation Error Response (`422 Unprocessable Entity`):
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "severity",
      "message": "Severity must be between 1 and 10"
    }
  ]
}
```

### `GET /api/patients/{patient_id}/symptoms`

Success Response (`200 OK`, ordered oldest to newest):
```json
[
  {
    "id": 1,
    "patient_id": "P001",
    "description": "Headache since morning",
    "severity": 6,
    "timestamp": "2026-11-24T10:30:00.123456Z"
  }
]
```

Unknown patient IDs return `200 OK` with `[]`.

---

## Design Decisions & Trade-Offs

- **SQLite vs. PostgreSQL**: SQLite is simple and requires no database server, making setup effortless for a take-home demo, but it is less suitable for high-concurrency production workloads due to file-level write locking.
- **FastAPI + Separate React SPA vs. Server-Rendered Templates**: FastAPI provides convenient Pydantic validation and automatic API documentation, but requires maintaining a separate frontend build and explicit CORS configuration.
- **Client-Side 30-Day Daily Averages vs. Dedicated Trends Endpoint**: Computing daily averages in the frontend (`calculateDailyAverages`) avoids adding and maintaining another API endpoint, but backend SQL aggregation would scale better for patients with very large histories.
- **`create_all()` vs. Alembic Migrations**: `Base.metadata.create_all()` inside FastAPI's `lifespan` is convenient and zero-config for a demo, but production systems should use Alembic migrations to evolve schemas safely without data loss.
- **Dual Validation (Frontend + Backend)**: Frontend validation provides immediate inline feedback without unnecessary network round trips, while backend Pydantic validation and the SQL `CHECK` constraint remain essential for correctness and security against direct API calls.

---

## Edge Cases Handled

- **Strict integer severity**: Rejects booleans (`true`/`false`), floats (`5.5`), numeric strings (`"5"`), `null`, out-of-range numbers (`0`, `11`, `-1`), and missing values.
- **Whitespace & special characters**: Trims leading/trailing whitespace on `patient_id` and `description`, rejects whitespace-only inputs, and preserves special characters such as `<script>` without HTML-encoding at rest while safely rendering them as text in React.
- **Rapid consecutive submissions**: `utc_now()` uses a lock-guarded monotonic microsecond check so rapid submissions receive strictly increasing UTC timestamps, backed by deterministic SQL ordering `ORDER BY timestamp ASC, id ASC`.
- **SQLite naive datetimes**: `SymptomLogOut` normalizes naive datetimes returned by SQLite as UTC and serializes every timestamp with a `Z` suffix.
- **Race conditions when switching patients**: Switching from `P001` to `P002` clears previous data immediately, cancels any in-flight GET via `AbortController`, and checks `selectedPatientRef.current` so late GET or POST responses never overwrite the newly selected patient's UI.
- **30-day UTC chart boundaries**: `calculateDailyAverages` anchors the cutoff at midnight UTC 29 days prior to the current UTC date, excludes future timestamps after `now`, groups strictly by UTC calendar date, rounds to 2 decimals, and omits days without entries rather than inventing zeros.

---

## Limitations & Security / Privacy Notes

- **Synthetic demonstration only**: All demo patient IDs (`P001`, `P002`) and seeded entries are synthetic.
- **No authentication or authorization**: Patient ID filtering in `/api/patients/{patient_id}/symptoms` is data scoping only, not authorization. No authentication is implemented because it is outside the assignment scope.
- **Not production-ready for real patient data**: Do not use this application for real Protected Health Information (PHI) without adding authentication, role-based access control, HTTPS/TLS, encrypted storage, audit logging, and formal compliance controls. This project does **not** claim HIPAA compliance.
- **No automatic POST retries**: Failed `POST /api/symptoms` requests display an error banner and preserve form inputs for manual retry to prevent duplicate symptom logs.

---

### AI Usage Disclosure

**AI Tools Used:** Google Antigravity and ChatGPT.

**How AI Was Used:** AI tools assisted with project planning, backend and frontend implementation, debugging, automated test creation, code review, and documentation.

**Personal Verification:** I manually ran the HealthTrack application in my browser and reviewed its functionality, including symptom submission, validation, patient history, patient switching, and severity visualizations. I also reviewed the automated test results and production build output.

**Technical Decisions:** I reviewed the project's architecture and design decisions to understand how the FastAPI backend, SQLite database, React frontend, and severity calculations work.