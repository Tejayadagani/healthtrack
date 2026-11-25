const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getApiBaseUrl() {
  const configured = import.meta.env?.VITE_API_BASE_URL;
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export class ApiError extends Error {
  constructor(
    message,
    { status = null, fieldErrors = [], isAborted = false, isNetworkError = false } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.isAborted = isAborted;
    this.isNetworkError = isNetworkError;
  }
}

function isValidSymptomRecord(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "number" &&
    typeof item.patient_id === "string" &&
    typeof item.description === "string" &&
    typeof item.severity === "number" &&
    typeof item.timestamp === "string"
  );
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    throw new ApiError("Received a malformed response from the server.", {
      status: response.status,
    });
  }
}

async function requestJson(path, options = {}) {
  const url = `${getApiBaseUrl()}${path}`;
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("Request was cancelled.", { isAborted: true });
    }
    throw new ApiError(
      "Unable to reach the server. Please check your connection and try again.",
      { isNetworkError: true }
    );
  }

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    if (response.status === 422 && data && Array.isArray(data.errors)) {
      const combinedMessage =
        data.errors.map((err) => err.message).filter(Boolean).join(" ") ||
        data.message ||
        "Validation failed";
      throw new ApiError(combinedMessage, {
        status: response.status,
        fieldErrors: data.errors,
      });
    }

    const message =
      (data && (data.message || data.detail)) ||
      `Request failed with status ${response.status}.`;
    throw new ApiError(message, { status: response.status });
  }

  return { response, data };
}

export async function fetchPatientSymptoms(patientId, { signal } = {}) {
  const encodedId = encodeURIComponent(patientId);
  const { response, data } = await requestJson(
    `/api/patients/${encodedId}/symptoms`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    }
  );

  if (!Array.isArray(data) || !data.every(isValidSymptomRecord)) {
    throw new ApiError("Received malformed symptom history from the server.", {
      status: response.status,
    });
  }

  return data;
}

export async function createSymptom(payload, { signal } = {}) {
  const { response, data } = await requestJson("/api/symptoms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!data || typeof data !== "object" || !isValidSymptomRecord(data.data)) {
    throw new ApiError("Received malformed confirmation from the server.", {
      status: response.status,
    });
  }

  return data;
}
