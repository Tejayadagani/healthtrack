import { useCallback, useEffect, useRef, useState } from "react";
import { createSymptom, fetchPatientSymptoms } from "../api/symptomsApi";

export const DEMO_PATIENTS = [
  { id: "P001", label: "P001 — Demo Patient 1" },
  { id: "P002", label: "P002 — Demo Patient 2" },
];

export function usePatientSymptoms(initialPatient = "P001") {
  const [selectedPatient, setSelectedPatient] = useState(initialPatient);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [lastSubmittedId, setLastSubmittedId] = useState(null);

  const selectedPatientRef = useRef(initialPatient);
  const abortControllerRef = useRef(null);
  const activeRequestIdRef = useRef(0);

  const loadSymptoms = useCallback(async (patientId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++activeRequestIdRef.current;

    setIsLoading(true);
    setFetchError(null);

    try {
      const data = await fetchPatientSymptoms(patientId, {
        signal: controller.signal,
      });

      if (
        selectedPatientRef.current !== patientId ||
        activeRequestIdRef.current !== requestId
      ) {
        return;
      }

      setLogs(data);
    } catch (error) {
      if (error?.isAborted || error?.name === "AbortError") {
        return;
      }
      if (
        selectedPatientRef.current !== patientId ||
        activeRequestIdRef.current !== requestId
      ) {
        return;
      }
      setFetchError(
        error?.message || "Failed to load patient symptom history."
      );
    } finally {
      if (
        selectedPatientRef.current === patientId &&
        activeRequestIdRef.current === requestId
      ) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    selectedPatientRef.current = selectedPatient;
    loadSymptoms(selectedPatient);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedPatient, loadSymptoms]);

  const selectPatient = useCallback((patientId) => {
    if (patientId === selectedPatientRef.current) {
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    selectedPatientRef.current = patientId;
    setSelectedPatient(patientId);
    setLogs([]);
    setFetchError(null);
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setLastSubmittedId(null);
    setIsLoading(true);
  }, []);

  const retryFetch = useCallback(() => {
    loadSymptoms(selectedPatientRef.current);
  }, [loadSymptoms]);

  const clearFeedback = useCallback(() => {
    setSubmitError(null);
    setSubmitSuccess(null);
  }, []);

  const submitSymptom = useCallback(
    async ({ description, severity }) => {
      const targetPatient = selectedPatientRef.current;
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const result = await createSymptom({
          patient_id: targetPatient,
          description,
          severity,
        });

        if (selectedPatientRef.current !== targetPatient) {
          return { ok: true, stale: true };
        }

        setLastSubmittedId(result.data.id);
        setSubmitSuccess(result.message || "Symptom logged successfully");
        await loadSymptoms(targetPatient);

        if (selectedPatientRef.current !== targetPatient) {
          return { ok: true, stale: true };
        }

        return { ok: true, stale: false, data: result.data };
      } catch (error) {
        if (selectedPatientRef.current !== targetPatient) {
          return { ok: false, stale: true };
        }

        setSubmitError({
          message: error?.message || "Unable to submit symptom entry.",
          fieldErrors: error?.fieldErrors || [],
        });
        return { ok: false, stale: false, error };
      } finally {
        if (selectedPatientRef.current === targetPatient) {
          setIsSubmitting(false);
        }
      }
    },
    [loadSymptoms]
  );

  return {
    selectedPatient,
    logs,
    isLoading,
    fetchError,
    isSubmitting,
    submitError,
    submitSuccess,
    lastSubmittedId,
    selectPatient,
    retryFetch,
    clearFeedback,
    submitSymptom,
  };
}
