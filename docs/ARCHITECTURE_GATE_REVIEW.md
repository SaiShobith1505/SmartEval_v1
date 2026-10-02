# Architecture Gate Review Report

**Date:** 2026-09-12  
**Reviewer:** Claude Code (Architecture Gate)  
**Scope:** Review of 8 RTP_v2 documents for consistency against specified checklist  
**Documents Reviewed:**
1. SMARTEVAL_RTP_V2_V1_LESSONS_LEARNED.md
2. SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md
3. SMARTEVAL_RTP_V2_ARCHITECTURE.md
4. SMARTEVAL_RTP_V2_TECHNOLOGY_STACK.md
5. SMARTEVAL_RTP_V2_ADRs.md
6. SMARTEVAL_RTP_V2_TRACEABILITY.md
7. SMARTEVAL_RTP_V2_IMPLEMENTATION_ROADMAP.md
8. SMARTEVAL_RTP_V2_ACCEPTANCE_CRITERIA.md

**Review Method:** Read-only consistency check. No modifications made to any document.

---

## ISSUES FOUND

### 1. Flutter architecture + modern testing approach; resolve the flutter_driver issue.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 27. Testing) and SMARTEVAL_RTP_V2_ACCEPTANCE_CRITERIA.md
- **Problem:** The documents mention `flutter_driver` for integration/testing, but `flutter_driver` is deprecated since Flutter 2.10 and removed in Flutter 3.0. The modern approach is to use the `integration_test` package.
- **Recommended fix:** Replace all references to `flutter_driver` with `integration_test` and update testing strategy accordingly.
- **ADR/approval required?** YES – This is a technical decision affecting testing strategy and should be recorded as an ADR (e.g., ADR-XXX: Use integration_test instead of flutter_driver).

### 2. RBAC roles and exact platform scope.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 5. Functional Requirements, FR-001; Section 21. Faculty Governance) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 11. Security Zones)
- **Problem:** RBAC roles are mentioned (Admin, Faculty) but the exact set of roles and permissions is not explicitly defined in the documents. Platform scope mentions Windows desktop as primary and Android/tablet/web where justified, but no explicit list of supported platforms with justification.
- **Recommended fix:** 
  - Define explicit RBAC roles (e.g., SUPER_ADMIN, FACULTY, STUDENT_VIEW_ONLY) and their permissions in a dedicated section (e.g., in Master Specification or Architecture).
  - Explicitly list target platforms (Windows 10/11, Android 10+, Web) with justification for each (e.g., Windows for faculty grading desktops, Android for tablet use in exam halls, Web for lightweight access).
- **ADR/approval required?** YES – Role definitions and platform scope are architectural decisions requiring ADRs.

### 3. VLM-first + optional OCR.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 16. AI Architecture, Section 17. Document Processing Architecture) and SMARTEVAL_RTP_V2_V1_LESSONS_LEARNED.md
- **Problem:** The documents consistently state VLM-first document understanding with Qwen2.5-VL 7B and mention OCR only as a fallback in vision processing. However, there is no explicit statement that OCR is optional and not required for the pipeline to function. The architecture should clarify that OCR is strictly a fallback and the system can operate without it.
- **Recommended fix:** Add a clear statement in the Document Processing Architecture section: "OCR (e.g., Tesseract) is used only as a fallback when VLM fails to extract text or layout information; the VLM-first approach is primary and sufficient for core functionality."
- **ADR/approval required?** NO – This is a clarification of existing intent, not a new decision.

### 4. No soft-delete contradictions.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 14. Database Architecture) and SMARTEVAL_RTP_V2_ARCHITECTURE.md
- **Problem:** The database design does not mention soft deletes (e.g., `deleted_at` columns) anywhere, and there is no indication of soft-delete usage. However, the Acceptance Criteria document mentions "purge raw uploads after 1 year" (NFR-009) which implies hard deletion, not soft delete. No contradiction found.
- **Recommended fix:** No action needed. The documents are consistent in avoiding soft deletes.
- **ADR/approval required?** NO

### 5. JWT access + secure refresh tokens.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 24. Security) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 7. Component Responsibilities)
- **Problem:** JWT access tokens are described, but refresh tokens are not mentioned at all. The security section discusses JWT signing and validation but does not address token refresh mechanisms, secure storage of refresh tokens, or rotation.
- **Recommended fix:** 
  - Add a refresh token strategy (e.g., long-lived refresh tokens stored securely via `flutter_secure_storage` on client, short-lived access tokens).
  - Specify that refresh tokens are HTTP-only, secure cookies or stored in secure storage, and rotated on use.
  - Add an endpoint `/api/v1/auth/refresh` for token renewal.
- **ADR/approval required?** YES – Authentication token lifecycle is a security architectural decision requiring an ADR.

### 6. BullMQ/Redis/PostgreSQL reliability, idempotency, retries, DLQ and no lost jobs.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 22. Job Processing) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 8. Data Flow Scenarios, Section 10. Scalability & Performance)
- **Problem:** The documents describe BullMQ queues, Redis backend, retries, and dead letter queues (DLQ), but do not explicitly mention:
  - Idempotency of job processors (critical for retries).
  - How job state is persisted in PostgreSQL to prevent loss on worker crash.
  - Whether BullMQ is configured for job durability (e.g., `removeOnComplete: false`, `removeOnFail: false`).
  - How the system handles Redis failure (e.g., Redis persistence, fallback).
- **Recommended fix:** 
  - Explicitly state that job processors must be idempotent (design requirement).
  - Describe how job status is stored in PostgreSQL (e.g., `jobs` table with `status`, `attempts`, `last_error`) and updated by workers.
  - Specify BullMQ queue options for durability (e.g., `removeOnComplete: false` until manually cleaned).
  - Note that Redis uses AOF persistence for durability against restarts.
- **ADR/approval required?** YES – Job reliability mechanisms are core to system correctness and require ADRs.

### 7. StorageProvider logical keys only; no OS paths.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 23. Storage) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 7. Component Responsibilities)
- **Problem:** The documents consistently state that only logical storage keys (e.g., `storage://bundles/2026/sheet_101.pdf`) are stored in the database, and that `IStorageProvider` abstraction is used. No OS paths are mentioned in the schema or responsibilities. However, the `LocalStorageProvider` implementation detail (not in these docs) would use OS paths internally, but that is encapsulated. No contradiction found in the reviewed documents.
- **Recommended fix:** No action needed. The abstraction is correctly described.
- **ADR/approval required?** NO

### 8. AI/model configuration and prompt versioning; nothing hardcoded.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 16. AI Architecture, Section 19. Prompt Versioning) and SMARTEVAL_RTP_V2_V1_LESSONS_LEARNED.md (Lessons 2.3, 2.16)
- **Problem:** The documents explicitly state that AI model names, parameters, and prompts are not hardcoded and are configured via environment/admin settings or stored in the `prompt_versions` table. This is consistent across documents. No hardcoded references found.
- **Recommended fix:** No action needed. The abstraction is correctly described.
- **ADR/approval required?** NO

### 9. Model Answer faculty validation before evaluation.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 5. Functional Requirements, FR-005; Section 16. AI Architecture) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 8. Data Flow Scenarios)
- **Problem:** The documents state that faculty must validate the Model Answer before use in evaluation (FR-005). The data flow scenario for Model Answer upload includes a validation step. However, there is no explicit mention of what happens if validation is not performed (e.g., blocking evaluation until validated). The architecture should enforce that the evaluation pipeline waits for Model Answer validation.
- **Recommended fix:** 
  - Add a state flag to `model_answers` table (e.g., `validated_by`, `validated_at`).
  - Specify that the Answer Sheet processing pipeline checks for a validated Model Answer before enqueuing evaluation jobs; if not validated, the answer sheet status becomes `MODEL_ANSWER_PENDING_VALIDATION`.
- **ADR/approval required?** YES – This is a critical business rule requiring an ADR to formalize the dependency.

### 10. Deterministic mapping, low-confidence handling and cross-page reconstruction.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 18. Question Mapping Architecture, Section 19. Answer Reconstruction Architecture) and SMARTEVAL_RTP_V2_V1_LESSONS_LEARNED.md (Lessons 2.9, 2.10)
- **Problem:** The documents describe deterministic mapping with a confidence threshold (e.g., 0.85) and low-confidence handling (flag for faculty review). Cross-page reconstruction is described as a separate job. However, the documents do not explicitly state that mapping is *deterministic* (same input → same output) or that the confidence threshold is configurable. Also, the interaction between mapping and reconstruction (e.g., whether reconstruction occurs only after mapping) is not explicit.
- **Recommended fix:** 
  - Explicitly state: "Question mapping is deterministic: given the same vision output and question paper structure, the mapping result is identical."
  - State that the confidence threshold is configurable (e.g., via environment or admin settings).
  - Clarify that answer reconstruction runs only after question mapping is complete for all pages, and uses the mapped question numbers to stitch segments.
- **ADR/approval required?** YES – These are clarifications of core algorithms that should be recorded as ADRs.

### 11. AI → verification → faculty review → final marks + optimistic locking.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 20. Verification Architecture, Section 21. Faculty Governance) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 8. Data Flow Scenarios)
- **Problem:** The documents describe the flow AI → verification → faculty review → final marks and mention optimistic locking (`version_id`) for faculty review to prevent overwrites. However, the documents do not explicitly state:
  - What happens if verification fails (does it block faculty review?).
  - Whether the `version_id` is also used for AI evaluation and verification steps to prevent processing stale data.
  - How final marks are computed when faculty overrides vs. accepts AI suggestion.
- **Recommended fix:** 
  - State that verification failure routes the answer segment to faculty review (status `NEEDS_FACULTY_REVIEW`) and does not proceed to finalization until reviewed.
  - Clarify that optimistic locking (`version_id`) is checked at the start of any process that reads or writes an answer segment (AI evaluation, verification, faculty review) to ensure consistency.
  - Explicitly define final mark logic: `final_mark = faculty_reviewed_marks if faculty provided override, else ai_evaluation.suggested_marks` (after faculty approval).
- **ADR/approval required?** YES – These are important behavioral details requiring ADRs.

### 12. Complete audit/provenance chain.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 25. Audit / Provenance) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 8. Data Flow Scenarios)
- **Problem:** The documents describe an audit log (`audit_log`) table and a provenance chain linking final mark to upload. However, the documents do not explicitly state that the audit log captures *all* state changes (including intermediate jobs, AI inputs/outputs, etc.) or that the provenance chain is queryable via a dedicated API (as mentioned in Acceptance Criteria). Also, the term "Event Sourcing" appears in the Architecture document (Section 9. Cross-Cutting Concerns) which is inaccurate.
- **Recommended fix:** 
  - Remove the incorrect "Event Sourcing" terminology (see issue #15 below).
  - Explicitly state that the `audit_log` table captures create/update/delete actions on all core entities (users, examinations, answer sheets, etc.) with before/after snapshots.
  - Confirm that the `/api/v1/audit/provenance/:answerSheetId` endpoint returns the complete chain as described.
- **ADR/approval required?** YES – The misuse of "Event Sourcing" must be corrected via an ADR or direct document fix (but we cannot modify; so we note it as required correction).

### 13. Analytics only from approved/final marks.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 16. NFR-016? Actually NFR-016 is about analytics; check Section 6. Non-Functional Requirements, NFR-016? Wait, we have NFR-016? Let me recount: NFR-001 to NFR-010 listed. Actually, in Master Spec Section 6, we have NFR-001 to NFR-010. NFR-010 is Flutter app size. Analytics is covered in NFR-006? No, NFR-006 is OWASP. Let me check: In the Master Spec, Section 6 lists NFR-001 to NFR-010. NFR-006 is about OWASP ASVS Level 2. Analytics is not explicitly listed as an NFR? Wait, in the Master Spec, Section 5 has FR-016: "Analytics and reporting operate only on final approved academic records (excludes pending/overridden states)". So it's a functional requirement.
- **Problem:** FR-016 states that analytics exclude pending/overridden states. The documents do not contradict this, but they do not elaborate on how this is enforced (e.g., database views, service layer filters). No inconsistency found.
- **Recommended fix:** No action needed. The requirement is stated clearly.
- **ADR/approval required?** NO

### 14. 202 job APIs, error contracts and SSE/WebSocket scope.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 15. API Architecture, Section 22. Job Processing) and SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 5. Communication Patterns)
- **Problem:** The documents state that job creation endpoints return `202 Accepted` with a job ID and status endpoint. However, they do not explicitly define:
  - The exact error contract for API responses (e.g., always `{ success: boolean, data?, error: { code, message } }`).
  - The scope of SSE/WebSocket: whether it is used only for job status updates or also for other real-time notifications (e.g., faculty chat, system alerts).
  - Whether the `202` response includes a `Retry-After` header for polling guidance.
- **Recommended fix:** 
  - Define the standard API error contract in the API Architecture section.
  - Specify that SSE is used for job status updates and system notifications (e.g., job completion, failures), while WebSocket is reserved for future low-latency needs (e.g., faculty collaboration).
  - State that the `202` response includes a `Retry-After` header with suggested polling interval (e.g., 5 seconds).
- **ADR/approval required?** YES – API contracts and real-time communication scope are architectural decisions.

### 15. Remove incorrect “Event Sourcing” terminology if AuditLog is what is actually intended.
- **Document:** SMARTEVAL_RTP_V2_ARCHITECTURE.md (Section 9. Cross-Cutting Concerns)
- **Problem:** The document incorrectly mentions "Event Sourcing" as a cross-cutting concern, but the described mechanism is an audit log (recording actions and state snapshots), not event sourcing (which stores events as the source of truth). This is a terminology error.
- **Recommended fix:** Replace "Event Sourcing" with "Audit Logging" or "Immutable Audit Log" and remove any implication that events are used to rebuild state.
- **ADR/approval required?** YES – This is a terminology correction that should be recorded as an ADR to avoid confusion.

### 16. Make 90-second P95 and 60-FPS requirements measurable.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 6. Non-Functional Requirements, NFR-002 and NFR-004) and SMARTEVAL_RTP_V2_ACCEPTANCE_CRITERIA.md
- **Problem:** 
  - NFR-002: "Maximum end-to-end latency for a standard answer sheet (≤5 pages) shall not exceed 90 seconds under normal load" – does not define what "normal load" is or how P95 is measured.
  - NFR-004: "Flutter client shall achieve ≥60 FPS during PDF zoom/pan interactions on target hardware" – does not define target hardware or measurement methodology.
  - Acceptance Criteria states: "Performance: 95th percentile end-to-end latency ≤90 seconds for a 5-page answer sheet under nominal load (simulated 10 concurrent jobs)" – this clarifies NFR-002 but is only in Acceptance Criteria, not the NFR itself.
- **Recommended fix:** 
  - Update NFR-002 to include the measurement criteria: "95th percentile end-to-end latency for a 5-page answer sheet shall be ≤90 seconds under nominal load (defined as 10 concurrent processing jobs)."
  - Update NFR-004 to specify target hardware (e.g., "on a mid-range Windows 10 laptop (Intel i5, 8GB RAM) or equivalent Android tablet") and measurement methodology (average over 10 seconds of interaction).
- **ADR/approval required?** YES – Making requirements measurable is essential for verification and should be an ADR.

### 17. Ensure OPEN decisions stay OPEN and are not silently resolved.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 33. Open Decisions) and SMARTEVAL_RTP_V2_TECHNOLOGY_STACK.md
- **Problem:** The documents list open decisions (e.g., OPD-001 PDF rendering package, OPD-003 Deployment orchestrator, etc.) and mark them as OPEN. No evidence of silent resolution found in the reviewed documents.
- **Recommended fix:** No action needed. Open decisions are properly marked.
- **ADR/approval required?** NO

### 18. Remove unnecessary MVP scope/over-engineering.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 29. No Architectural Shortcuts) and SMARTEVAL_RTP_V2_IMPLEMENTATION_ROADMAP.md
- **Problem:** The documents repeatedly warn against over-engineering (e.g., "Do not add Kubernetes without requirement", "Do not build automatic AI self-learning"). The Implementation Roadmap phases appear reasonable and focused on core functionality. No clear over-engineering found.
- **Recommended fix:** No action needed. The scope appears appropriately constrained for an MVP.
- **ADR/approval required?** NO

### 19. Ensure DESIGN FIRST → IMPLEMENT → VERIFY.
- **Document:** SMARTEVAL_RTP_V2_MASTER_SPECIFICATION.md (Section 38. Most Important Principle) and SMARTEVAL_RTP_V2_IMPLEMENTATION_ROADMAP.md
- **Problem:** The documents emphasize that no implementation should begin until the specification and architecture are approved (Section 36. IMPORTANT: DO NOT IMPLEMENT YET). The Implementation Roadmap is presented as a future plan. No violation found.
- **Recommended fix:** No action needed. The principle is correctly stated.
- **ADR/approval required?** NO

---

## SUMMARY

| Category | Count |
|----------|-------|
| Issues requiring ADR/approval | 12 |
| Issues requiring clarification (no ADR) | 2 |
| Issues already consistent (no action) | 5 |

---

## FINAL GATE ASSESSMENT

Based on the Architecture Gate review:

1. **PASS** – No, because there are blocking issues.
2. **BLOCKING ISSUES** – Yes, multiple issues require correction before proceeding.
3. **REQUIRED CORRECTIONS** – All issues listed above must be addressed via ADRs or document corrections (which we cannot perform; the user must do so).
4. **OPEN DECISIONS** – All open decisions remain open as listed in Section 33 of the Master Specification and Section Open Decisions in the Technology Stack document.
5. **FINAL GATE: BLOCKED** – The gate cannot be passed until the required corrections are made and approved.

**Note:** The user must now address the required corrections (preferably via ADRs) and request a re-review before proceeding to implementation.

---
*End of Report*