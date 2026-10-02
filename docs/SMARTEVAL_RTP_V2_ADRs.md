# SmartEval RTP_v2 — Architecture Decision Records (ADRs)

**Document Status:** Reference  
**Version:** 1.0.0  
**Date:** September 12, 2026  

This document captures all architectural decisions made for SmartEval RTP_v2. Each ADR follows the format:

- **Context:** The problem or situation that led to the decision.
- **Decision:** The chosen solution.
- **Status:** e.g., PROPOSED, ACCEPTED, SUPERSEDED.
- **Consequences:** The implications of the decision (positive, negative, neutral).

---

## ADR-019: Flutter Testing Strategy

**Context:** The specification originally referenced `flutter_driver` for integration and end‑to‑end testing. However, `flutter_driver` is deprecated since Flutter 2.10 and removed in Flutter 3.0. The modern, recommended approach is to use the `integration_test` package.

**Decision:** Adopt the `integration_test` package for all Flutter integration and end‑to‑end tests; deprecate `flutter_driver`.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Future‑proof testing setup, compatibility with current Flutter stable, better tooling and IDE support.
- *Negative:* None; migration is straightforward as the API is similar.
- *Impact:* Update `pubspec.yaml` to depend on `integration_test`; rewrite existing `flutter_driver` tests to use `integration_test`; update documentation and acceptance criteria accordingly.

---

## ADR-020: RBAC Roles and Platform Scope

**Context:** The system requires role‑based access control but the exact set of roles and the target platforms for the Flutter client were not explicitly defined, leading to ambiguity in implementation and testing.

**Decision:** 
- Define explicit RBAC roles: `SUPER_ADMIN` (full system access, including user management and system configuration), `FACULTY` (can upload Question Papers, Model Answers, and Answer Sheets; review assigned bundles; view own analytics; no access to user management or system configuration).  
  (Note: The specification only mentions Admin and Faculty; we map Admin → SUPER_ADMIN for clarity. No `STUDENT_VIEW_ONLY` role is added because no requirement in the specification necessitates a dedicated student role with UI access; students are represented in the system as `answer_sheets.student_id` but do not log in to the Flutter client.)
- Platform scope: Primary target = Windows 10/11 desktop (faculty grading workstations); Secondary = Android 10+ tablets (faculty grading in exam halls); Web (responsive) for lightweight access where justified (e.g., admin dashboards, quick look‑ups).  
  The Flutter client will be built with Flutter’s desktop, mobile, and web support; platform‑specific code will be isolated behind abstractions (e.g., `IPlatformService`).

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Clear guidance for UI/UX design, testing, and deployment; prevents scope creep.
- *Negative:* None.
- *Impact:* Implement role‑based route guards in GoRouter; adjust backend authorization middleware to check for `SUPER_ADMIN` and `FACULTY` claims; ensure Flutter conditional compilation for desktop/mobile/web features.

---

## ADR-021: JWT Refresh‑Token Architecture

**Context:** The original specification described JWT access tokens but did not define a refresh‑token mechanism, raising concerns about token theft, usability, and secure storage on Flutter clients.

**Decision:** 
- Use a two‑token strategy:
  - **Access token:** short‑lived (15 minutes), kept in memory only (not persisted), transmitted via `Authorization: Bearer <token>` header on each request.
  - **Refresh token:** long‑lived (7 days), stored securely via `flutter_secure_storage` (encrypted when the platform provides hardware‑backed encryption; falls back to encrypted preferences otherwise).  
- Provide endpoint `POST /api/v1/auth/refresh` that accepts a valid refresh token and returns a new access token (and optionally a new refresh token if rotation is enabled).  
- Refresh tokens are rotated on use (issue new refresh token, invalidate the old one) and are invalidated on logout, password change, or administrative revocation.  
- Access tokens are NOT stored in persistent storage to mitigate XSS risks; refresh tokens are protected by platform‑encrypted storage.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Limits exposure of access tokens; refresh token theft requires device compromise; rotation limits window of abuse.
- *Negative:* Slightly more complex login/logout flows; need to handle 401 responses and attempt token refresh automatically.
- *Impact:* Update Flutter auth service to manage token storage and automatic refresh; implement `/api/v1/auth/refresh` endpoint on backend; adjust login/logout flows; document security reasoning in the specification.

---

## ADR-022: BullMQ Job Reliability, Idempotency, Durability, and DLQ

**Context:** The system relies on BullMQ for asynchronous job processing but did not specify how to guarantee job durability, prevent lost jobs, handle retries, or ensure idempotent processing, which could lead to duplicate work or data loss.

**Decision:** 
- **Idempotency:** All job processors (`ProcessDocumentJob`, `RunVisionJob`, etc.) must be idempotent: they check for existing outputs (e.g., database records, storage keys) before creating new ones, and safely skip or update if work is already done.
- **Job status persistence:** A `jobs` table in PostgreSQL stores the canonical state of each job:
  - `id` (string, BullMQ jobId)
  - `queue_name` (string)
  - `payload` (JSONB)
  - `status` (enum: waiting, active, completed, failed)
  - `attempts` (integer)
  - `last_error` (text, nullable)
  - `created_at`, `updated_at` (timestamps)
  Workers update this table before starting a job (set status to `active`, increment `attempts`) and after completion (set status to `completed`/`failed`, store error if any).
- **BullMQ options:** Queues are created with `removeOnComplete: false` and `removeOnFail: false` so that jobs remain in the queue until manually cleaned (relying on the `jobs` table for retention logic). This ensures that even if a worker crashes, the job can be retried from the queue.
- **Redis persistence:** Enable AOF (append‑only file) with `fsync` every second to survive Redis restarts.
- **Dead Letter Queue (DLQ):** After `maxAttempts` (default 3) a job is moved to a corresponding `<queue-name>:dlq` for manual inspection; it is not automatically retried.
- **Graceful shutdown:** Workers listen for SIGTERM, finish the current job, then exit; unacknowledged jobs are returned to the queue by BullMQ.
- **Metrics:** Export job latency, throughput, and failure rate via Prometheus for alerting.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* No lost jobs, predictable retry behavior, operational visibility, prevents duplicate processing.
- *Negative:* Slight increase in complexity for job processor implementation; requires the `jobs` table and maintenance logic.
- *Impact:* Implement the `jobs` table via Prisma; update all job processors to check persistence and update status; configure BullMQ queues accordingly; add DLQ handling; expose metrics.

---

## ADR-023: Model Answer Validation Gate

**Context:** The specification requires that faculty validate the Model Answer before it is used in evaluation, but did not describe how to enforce this gate or what happens if validation is missing.

**Decision:** 
- Add two columns to the `model_answers` table:
  - `validated_by` (FK → `users.id`, nullable)
  - `validated_at` (timestamp, nullable)
- When a Model Answer is uploaded, these fields are initially `NULL`.
- Faculty must explicitly validate the Model Answer via the UI (or API) which sets `validated_by` to the validating user’s ID and `validated_at` to the current timestamp.
- The Answer Sheet processing pipeline checks for a validated Model Answer before enqueuing any AI evaluation jobs:
  - If `validated_by` IS NULL or `validated_at` IS NULL for the related Model Answer, the answer sheet’s status is set to `MODEL_ANSWER_PENDING_VALIDATION` (a new status) and no evaluation jobs are enqueued.
  - A notification (via email or in‑app) is sent to the faculty responsible for validation.
- Evaluation jobs are enqueued only when a validated Model Answer exists for the related Question Paper.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Prevents use of unverified Model Answers, enforces faculty authority, creates an audit trail of validation.
- *Negative:* Adds a small step to the workflow; requires UI for validation.
- *Impact:* Extend Prisma schema; add validation endpoint/UI; modify Answer Sheet ingestion logic to check validation status; add new status `MODEL_ANSWER_PENDING_VALIDATION` and corresponding UI handling.

---

## ADR-024: Deterministic Question Mapping & Cross‑Page Reconstruction

**Context:** The specification describes question mapping with a confidence threshold and cross‑page answer reconstruction, but does not clarify whether the mapping is deterministic, how the confidence threshold is set, or the exact ordering of mapping vs. reconstruction.

**Decision:** 
- **Deterministic mapping:** Given identical vision output (detected regions, text, layout) and an identical Question Paper structure (list of question numbers, sub‑parts, max marks), the mapping algorithm (heuristic OCR/Tesseract fallback followed by VLM refinement) will always produce the same mapping result (same question number and confidence for each region). This ensures reproducibility for a given input.
- **Configurable confidence threshold:** The threshold that determines whether a mapping is considered reliable (default 0.85) is configurable via environment variable or admin setting (e.g., `QUESTION_MAPPING_CONFIDENCE_THRESHOLD`). This allows tuning without code changes.
- **Cross‑page reconstruction runs after mapping:** Answer reconstruction (multi‑page stitching) is performed only after question mapping has been completed for **all** pages of an answer sheet. It uses the mapped question numbers to group segments and then applies spatial overlap and semantic continuation heuristics to stitch answer fragments across pages. No reconstruction is attempted on unmapped segments.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Clear, testable behavior; reproducibility aids debugging and auditing; flexibility to adjust strictness.
- *Negative:* None.
- *Impact:* Update the Vision and Question Mapping services to log inputs and outputs for testing; make the threshold configurable; ensure the Answer Reconstruction job waits for the `question-mapping` queue to drain for a given answer sheet before starting.

---

## ADR-025: Verification, Faculty Review, Final‑Mark Rules & Optimistic Locking

**Context:** The specification outlines the flow AI → verification → faculty review → final marks and mentions optimistic locking to prevent overwrites, but does not detail the handling of verification failure, the scope of the version check, or the exact logic for computing the final mark.

**Decision:** 
- **Verification failure:** If the AI verification step (`Qwen2.5‑Coder 14B`) returns `passed == false`, the answer segment is **not** discarded; instead, its status is set to `NEEDS_FACULTY_REVIEW` (or retains that status if already set by low‑confidence mapping). Verification failure does **not** block progression to faculty review; it simply means the AI evaluation is considered unverified and must be reviewed by faculty.
- **Optimistic locking scope:** The `answer_segments` table includes a `version_id` column (integer) that is incremented on every update to the row. Any process that reads or writes an answer segment **must** include the current `version_id` in its request:
  - On **read**: the client/service must send the `version_id` it last saw; if the row has changed, the operation can detect a conflict (though read‑only operations may proceed with stale data if acceptable).
  - On **write/update**: the request must include the expected `version_id`; the operation succeeds only if the row’s current `version_id` matches the expected value, after which the `version_id` is incremented. If the values do not match, the operation fails with `409 Conflict`.
  This check is performed at the start of **AI evaluation**, **verification**, **faculty review**, and **finalization** steps to ensure no intervening update has occurred.
- **Final‑mark logic:** 
  - If the faculty supplies an override (`faculty_reviews.reviewed_marks` is not null) during review, the final mark is that override value.
  - Otherwise, if the faculty approves the review (i.e., `faculty_reviews.approved_at` is set) without overriding, the final mark equals the AI‑suggested mark (`ai_evaluations.suggested_marks`).
  - The final mark is persisted in the `final_marks` table together with references to the faculty review, the AI evaluation, and the decision metadata (`decided_by`, `decided_at`).
  - Faculty approval is required for the final mark to be stored; without approval, the answer sheet remains in `READY_FOR_REVIEW` or `NEEDS_FACULTY_REVIEW`.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Prevents lost updates, makes verification a gatekeeper (not a blocker), preserves faculty authority, clear audit trail.
- *Negative:* Slightly more complex checkout logic; requires version_id handling in all services.
- *Impact:* Add `version_id` to `answer_segments` table; update all services (evaluation, verification, faculty review, finalization) to include version checks; adjust API contracts to require `version_id` on mutating operations; update UI to handle conflict resolution (prompt user to reload).

---

## ADR-026: Immutable Audit Log & Provenance Terminology

**Context:** The specification previously mentioned “Event Sourcing” as a cross‑cutting concern, but the actual mechanism is an audit log that records actions and state snapshots, not a true event‑sourced system where state is rebuilt from events.

**Decision:** 
- Replace the term “Event Sourcing” with “Immutable Audit Log” throughout all documentation.
- The `audit_log` table stores:
  - `id` (auto‑increment)
  - `entity_type` (string, e.g., `answer_sheet`, `final_mark`)
  - `entity_id` (FK to the respective table)
  - `action` (`CREATED`, `UPDATED`, `DELETED`, `APPROVED`, `FAILED`)
  - `performed_by` (user ID or the string `system` for automated actions)
  - `before_json` (JSONB, nullable, snapshot of the entity before the change)
  - `after_json` (JSONB, nullable, snapshot after the change)
  - `timestamp` (when the action occurred)
- This table provides an immutable trail of all state‑changing operations.
- Provenance for an answer sheet is obtained by joining the core tables (`answer_sheet` → `document_pages` → `vision_results` → `question_mappings` → `answer_segments` → `ai_evaluations` → `ai_verifications` → `faculty_reviews` → `final_marks`) and enriching with metadata from the audit log (who performed each action, when, and what changed).  
- The endpoint `GET /api/v1/audit/provenance/:answerSheetId` returns a chronological graph that includes the audit log entries for each step.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Correct terminology avoids confusion; provides a clear, queryable history of changes.
- *Negative:* None.
- *Impact:* Update all references in the specification, architecture, and other documents; no code changes needed as the implementation already matches this description.

---

## ADR-027: API Error Contract, 202 Responses, and SSE Usage

**Context:** The API documentation lacked a standardized error contract, did not specify the behavior of `202 Accepted` responses (e.g., polling guidance), and was unclear about when Server‑Sent Events (SSE) should be used versus other real‑time mechanisms.

**Decision:** 
- **Standard error contract:** All error responses (any 4xx or 5xx) return a JSON object with the following shape:
  ```json
  {
    "success": false,
    "error": {
      "code":      "<error_code_string>",   // e.g., "VALIDATION_ERROR", "UNAUTHORIZED"
      "message":   "<human‑readable message>",
      "details":   null   // optional, any additional validation errors or context
    }
  }
  ```
  Success responses return `{ "success": true, "data": <payload> }`.
- **`202 Accepted` responses:** Every endpoint that enqueues a job for asynchronous processing returns `202 Accepted` with:
  - Header: `Retry‑After: <seconds>` (suggested polling interval, default 5 seconds)
  - Body: 
    ```json
    {
      "jobId":      "<bullmq_job_id>",
      "statusEndpoint": "/api/v1/jobs/:jobId"
    }
    ```
  Clients may poll the status endpoint or subscribe to SSE for updates.
- **SSE usage:** Server‑Sent Events are used **only** for:
  - Job‑status updates (changes in the `jobs` table: waiting → active → completed/failed)
  - System notifications (e.g., job‑failure alerts, validation‑required prompts)
  SSE is **not** used for general UI updates; the client relies on polling or SSE for these specific streams. WebSocket is reserved for future low‑latency, bidirectional needs (e.g., faculty chat) but is not currently implemented.
- **Content‑Type:** SSE endpoints return `text/event-stream` with properly formatted `data:` lines.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Consistency across the API, predictable client behavior, clear polling guidance, separation of concerns for real‑time streams.
- *Negative:* Requires updates to all job‑creating endpoints and status‑checking endpoint; clients must implement retry‑after handling.
- *Impact:* Update all relevant controller methods to return the standardized error format; add `Retry‑After` header to 202 responses; implement or update the SSE endpoint for job status; update API documentation (OpenAPI) accordingly; update Flutter networking layer to handle the error contract and SSE streams.

---

## ADR-028: Measurable Performance Requirements

**Context:** The original NFRs for latency and FPS were qualitative (e.g., “under normal load”, “on target hardware”) making them difficult to verify objectively.

**Decision:** 
- **NFR‑002 (Latency):** 
  > “95th percentile end‑to‑end latency for a standard answer sheet (≤ 5 pages) shall be ≤ 90 seconds under nominal load, where nominal load is defined as **10 concurrent answer‑sheet processing jobs**.”
  Measurement: Use a load‑generation script to submit 10 answer‑sheet uploads simultaneously (or in a tight burst) and record the time from upload completion to the `final_marks` record being written for each. Compute the 95th percentile across the samples.
- **NFR‑004 (FPS):** 
  > “Flutter client shall achieve ≥60 frames per second (FPS) during PDF zoom/pan interactions on target hardware, defined as a **mid‑range Windows 10/11 laptop (Intel i5‑1235U, 8 GB RAM, integrated graphics) or equivalent Android tablet (e.g., Samsung Galaxy Tab S8)**. FPS is measured as the average over a 10‑second interaction session using Flutter’s performance overlay.”
  Measurement: Run the Flutter app on the specified hardware, open a typical answer sheet (≤ 5 pages, moderate complexity), perform continuous zoom and pan gestures for 10 seconds, and record the average FPS from the performance overlay.

**Status:** ACCEPTED

**Consequences:**
- *Positive:* Clear, testable, reproducible criteria; enables performance regression testing.
- *Negative:* Requires defining and maintaining benchmark hardware specifications.
- *Impact:* Update the Non‑Functional Requirements section in the specification; update Acceptance Criteria to reflect the measurable definitions; ensure performance tests are included in the CI/CD pipeline (or at least in the validation plan).

---

*End of ADRs document*