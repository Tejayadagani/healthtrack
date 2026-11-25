import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HealthTrack App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders empty states for history table and chart when no records exist", async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(
      await screen.findByText(/no symptoms recorded for P001 yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no symptom data in the last 30 days for P001/i)
    ).toBeInTheDocument();
  });

  it("renders history oldest-first and safely escapes XSS-looking descriptions", async () => {
    const xssPayload = '<script>alert("xss")</script> & sore throat';
    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 1,
          patient_id: "P001",
          description: "Earlier headache",
          severity: 4,
          timestamp: "2026-11-20T09:00:00Z",
        },
        {
          id: 2,
          patient_id: "P001",
          description: xssPayload,
          severity: 8,
          timestamp: "2026-11-24T15:30:00Z",
        },
      ])
    );

    const { container } = render(<App />);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Earlier headache")).toBeInTheDocument();
    expect(within(rows[1]).getByText(xssPayload)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("validates empty/whitespace and over-limit descriptions inline before submitting", async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([]));
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    const textarea = screen.getByLabelText(/symptom description/i);
    const submitButton = screen.getByRole("button", { name: /log symptom/i });

    await user.click(submitButton);
    expect(
      screen.getByText(/please enter a symptom description/i)
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await user.type(textarea, "   ");
    await user.click(submitButton);
    expect(
      screen.getByText(/please enter a symptom description/i)
    ).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "a".repeat(501) } });
    await user.click(submitButton);
    expect(
      screen.getByText(/must be 500 characters or fewer/i)
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("submits a valid symptom, disables the button while saving, clears description, and preserves severity", async () => {
    const user = userEvent.setup();
    let resolvePost;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    const createdEntry = {
      id: 10,
      patient_id: "P001",
      description: "Migraine behind eyes",
      severity: 7,
      timestamp: "2026-11-25T06:00:00Z",
    };

    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockImplementationOnce(() => postPromise)
      .mockResolvedValueOnce(jsonResponse([createdEntry]));

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    const textarea = screen.getByLabelText(/symptom description/i);
    const slider = screen.getByLabelText(/severity \(1–10\)/i);

    await user.type(textarea, "Migraine behind eyes");
    fireEvent.change(slider, { target: { value: "7" } });
    expect(screen.getByTestId("severity-value")).toHaveTextContent("7 / 10");

    const submitButton = screen.getByRole("button", { name: /log symptom/i });
    await user.click(submitButton);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolvePost(
      jsonResponse(
        { message: "Symptom logged successfully", data: createdEntry },
        201
      )
    );

    expect(
      await screen.findByText(/symptom logged successfully/i)
    ).toBeInTheDocument();
    expect(await screen.findByText("Migraine behind eyes")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
    expect(slider).toHaveValue("7");
    expect(screen.getByTestId("severity-value")).toHaveTextContent("7 / 10");
  });

  it("shows a network error banner with Retry on failed GET and recovers on retry", async () => {
    const user = userEvent.setup();
    globalThis.fetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 1,
            patient_id: "P001",
            description: "Recovered symptom",
            severity: 3,
            timestamp: "2026-11-25T05:00:00Z",
          },
        ])
      );

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to reach the server/i);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Recovered symptom")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays server 422 validation messages and preserves entered form values", async () => {
    const user = userEvent.setup();
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Validation failed",
            errors: [
              {
                field: "description",
                message: "Server rejected description format",
              },
            ],
          },
          422
        )
      );

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    const textarea = screen.getByLabelText(/symptom description/i);
    await user.type(textarea, "Valid client text");
    await user.click(screen.getByRole("button", { name: /log symptom/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((el) =>
        el.textContent?.includes("Server rejected description format")
      )
    ).toBe(true);
    expect(textarea).toHaveValue("Valid client text");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("switches patients, aborts outdated GET requests, and prevents stale responses", async () => {
    const user = userEvent.setup();
    let capturedP1Signal;
    let resolveP1;

    globalThis.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/patients/P001/")) {
        capturedP1Signal = options.signal;
        return new Promise((resolve, reject) => {
          resolveP1 = resolve;
          options.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      if (url.includes("/patients/P002/")) {
        return Promise.resolve(
          jsonResponse([
            {
              id: 20,
              patient_id: "P002",
              description: "P002 dizziness",
              severity: 5,
              timestamp: "2026-11-24T11:00:00Z",
            },
          ])
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<App />);

    const select = screen.getByLabelText(/patient/i);
    await user.selectOptions(select, "P002");

    expect(capturedP1Signal?.aborted).toBe(true);
    expect(await screen.findByText("P002 dizziness")).toBeInTheDocument();

    // Even if a late resolver fired, P001 data must never appear under P002.
    resolveP1?.(
      jsonResponse([
        {
          id: 99,
          patient_id: "P001",
          description: "Stale P001 symptom",
          severity: 9,
          timestamp: "2026-11-24T12:00:00Z",
        },
      ])
    );

    await waitFor(() => {
      expect(screen.queryByText("Stale P001 symptom")).not.toBeInTheDocument();
    });
    expect(screen.getByText("P002 dizziness")).toBeInTheDocument();
  });

  it("renders separate graphs per health issue, supports filtering, and toggles combined trend", async () => {
    const user = userEvent.setup();
    const todayIso = new Date().toISOString();

    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 1,
          patient_id: "P001",
          description: "Dry cough in morning",
          severity: 6,
          timestamp: todayIso,
        },
        {
          id: 2,
          patient_id: "P001",
          description: "Tension headache",
          severity: 2,
          timestamp: todayIso,
        },
        {
          id: 3,
          patient_id: "P001",
          description: "Evening cough worsening",
          severity: 8,
          timestamp: todayIso,
        },
      ])
    );

    render(<App />);
    await screen.findByText("Dry cough in morning");

    // Separate cards exist for Cough (avg 7) and Headache (avg 2)
    expect(
      screen.getByRole("heading", { name: "Cough" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Headache" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cough: 1 UTC day \(2 entries\)\. Latest daily average is 7 out of 10/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Headache: 1 UTC day \(1 entry\)\. Latest daily average is 2 out of 10/i)
    ).toBeInTheDocument();

    // Filter down to Cough only via chip
    await user.click(screen.getByRole("button", { name: /^Cough \(2\)$/i }));
    expect(
      screen.queryByRole("heading", { name: "Headache" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cough" })
    ).toBeInTheDocument();

    // Search an unmatched issue and reset
    const searchInput = screen.getByLabelText(/search health issue graphs/i);
    await user.type(searchInput, "migraine");
    expect(
      screen.getByText(/no health issue graphs matching/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show all issues/i }));
    expect(
      screen.getByRole("heading", { name: "Headache" })
    ).toBeInTheDocument();

    // Toggle to All Combined 30-day average view
    await user.click(screen.getByRole("button", { name: /all combined/i }));
    expect(
      screen.getByText(/latest daily average is 5.33 out of 10/i)
    ).toBeInTheDocument();
  });

  it("allows logging a symptom under an optional health issue tag", async () => {
    const user = userEvent.setup();
    const createdEntry = {
      id: 40,
      patient_id: "P001",
      description: "Knee: Sharp ache on stairs",
      severity: 6,
      timestamp: new Date().toISOString(),
    };

    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "Symptom logged successfully", data: createdEntry },
          201
        )
      )
      .mockResolvedValueOnce(jsonResponse([createdEntry]));

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    await user.click(screen.getByRole("button", { name: /^Knee$/i }));
    await user.type(
      screen.getByLabelText(/symptom description/i),
      "Sharp ache on stairs"
    );
    await user.click(screen.getByRole("button", { name: /log symptom/i }));

    expect(
      await screen.findByText("Knee: Sharp ache on stairs")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Knee" })).toBeInTheDocument();
  });

  it("preserves form values after a failed POST and succeeds on manual resubmission without auto-retrying", async () => {
    const user = userEvent.setup();
    const createdEntry = {
      id: 50,
      patient_id: "P001",
      description: "Persistent dizziness",
      severity: 8,
      timestamp: new Date().toISOString(),
    };

    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "Symptom logged successfully", data: createdEntry },
          201
        )
      )
      .mockResolvedValueOnce(jsonResponse([createdEntry]));

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    const textarea = screen.getByLabelText(/symptom description/i);
    const slider = screen.getByLabelText(/severity \(1–10\)/i);

    await user.type(textarea, "Persistent dizziness");
    fireEvent.change(slider, { target: { value: "8" } });
    await user.click(screen.getByRole("button", { name: /log symptom/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to reach the server/i);
    expect(textarea).toHaveValue("Persistent dizziness");
    expect(slider).toHaveValue("8");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: /log symptom/i }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Persistent dizziness")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
    expect(slider).toHaveValue("8");
  });

  it("prioritizes submission error over an earlier fetch error while keeping Retry available", async () => {
    const user = userEvent.setup();
    globalThis.fetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse({ message: "Database write failed" }, 500)
      );

    render(<App />);

    const initialAlert = await screen.findByRole("alert");
    expect(initialAlert).toHaveTextContent(/unable to reach the server/i);

    const textarea = screen.getByLabelText(/symptom description/i);
    await user.type(textarea, "Offline chest tightness");
    await user.click(screen.getByRole("button", { name: /log symptom/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Database write failed"
      );
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(textarea).toHaveValue("Offline chest tightness");
  });

  it("ignores a late POST response if the user switched patients while POST was pending", async () => {
    const user = userEvent.setup();
    let resolveP1Post;
    const pendingPost = new Promise((resolve) => {
      resolveP1Post = resolve;
    });

    const p2Entry = {
      id: 60,
      patient_id: "P002",
      description: "P002 existing symptom",
      severity: 4,
      timestamp: new Date().toISOString(),
    };

    globalThis.fetch.mockImplementation((url, options = {}) => {
      if (url.includes("/patients/P001/")) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.endsWith("/api/symptoms") && options.method === "POST") {
        return pendingPost;
      }
      if (url.includes("/patients/P002/")) {
        return Promise.resolve(jsonResponse([p2Entry]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<App />);
    await screen.findByText(/no symptoms recorded for P001 yet/i);

    await user.type(
      screen.getByLabelText(/symptom description/i),
      "P001 transient symptom"
    );
    await user.click(screen.getByRole("button", { name: /log symptom/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/patient/i), "P002");

    const table = await screen.findByRole("table");
    expect(within(table).getByText("P002 existing symptom")).toBeInTheDocument();

    resolveP1Post(
      jsonResponse(
        {
          message: "Symptom logged successfully",
          data: {
            id: 99,
            patient_id: "P001",
            description: "P001 transient symptom",
            severity: 5,
            timestamp: new Date().toISOString(),
          },
        },
        201
      )
    );

    await waitFor(() => {
      expect(
        screen.queryByText(/symptom logged successfully/i)
      ).not.toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("table")).queryByText("P001 transient symptom")
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByText("P002 existing symptom")
    ).toBeInTheDocument();
  });
});
