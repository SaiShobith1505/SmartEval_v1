# SmartEval RTP_v2 — Master Specification

**Document Status:** Authoritative Specification  
**Version:** 1.0.0  
**Date:** September 12, 2026  
**System:** SmartEval RTP_v2  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Problem Definition](#3-problem-definition)
4. [Scope](#4-scope)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [V1 Lessons Learned](#7-v1-lessons-learned)
8. [Retained V1 Capabilities](#8-retained-v1-capabilities)
9. [V2 Technology Stack](#9-v2-technology-stack)
10. [System Architecture](#10-system-architecture)
11. [Flutter Architecture](#11-flutter-architecture)
12. [Backend Architecture](#12-backend-architecture)
13. [Domain Architecture](#13-domain-architecture)
14. [Database Architecture](#14-database-architecture)
15. [API Architecture](#15-api-architecture)
16. [AI Architecture](#16-ai-architecture)
17. [Document Processing Architecture](#17-document-processing-architecture)
18. [Question Mapping Architecture](#18-question-mapping-architecture)
19. [Evaluation Architecture](#19-evaluation-architecture)
20. [Verification Architecture](#20-verification-architecture)
21. [Faculty Governance](#21-faculty-governance)
22. [Job Processing](#22-job-processing)
23. [Storage](#23-storage)
24. [Security](#24-security)
25. [Audit / Provenance](#25-audit--provenance)
26. [Observability](#26-observability)
27. [Testing](#27-testing)
28. [Deployment](#28-deployment)
29. [Migration / Data Considerations](#29-migration--data-considerations)
30. [Traceability](#30-traceability)
31. [Acceptance Criteria](#31-acceptance-criteria)
32. [Risks](#32-risks)
33. [Open Decisions](#33-open-decisions)
34. [Future Extensions](#34-future-extensions)

---

## 1. Executive Summary

SmartEval RTP_v2 is a re-engineered institutional platform for AI-assisted evaluation of handwritten university examinations. Built from a clean slate, it incorporates lessons from RTP_v1 to deliver a secure, traceable, faculty-governed system that supports cross-platform clients (Flutter desktop/mobile/tablet) and a modular backend architecture.

The system enforces the principle: **AI proposes, AI verifies, Faculty decides.**

---

## 2. Product Vision

To provide universities with a trustworthy, auditable, and scalable examination evaluation workflow that reduces faculty grading fatigue while preserving academic integrity through transparent AI assistance and final human authority.

---

## 3. Problem Definition

Current manual evaluation of handwritten answer sheets is labor-intensive, error-prone, and lacks consistent audit trails. Existing AI-assisted tools often operate as black boxes, generate synthetic fallbacks, or bypass faculty oversight. SmartEval addresses:

- High cognitive load on faculty during peak examination periods
- Inconsistent marking due to fatigue or subjective interpretation
- Lack of provenance linking final marks to source evidence
- Inflexible, tightly-coupled monoliths that hinder technology evolution
- Platform limitations restricting deployment to specific devices

---

## 4. Scope

**In Scope:**
- End-to-end workflow: upload → document processing → question mapping → answer reconstruction → AI evaluation → verification → faculty review → final decision → persistence → audit
- Role-based access control (Admin, Faculty); Student entities are represented in the system (e.g., answer_sheets.student_id) but do not have a login role.
- Cross-platform Flutter client (Windows desktop primary; Android/tablet/web where justified)
- Modular Node.js/TypeScript backend with PostgreSQL, Prisma, BullMQ/Redis
- Abstraction layers for AI providers (initial: Ollama) and storage (local/S3/MinIO)
- Comprehensive audit and provenance tracking
- Automated job processing with retries, failure handling, and observability

**Out of Scope:**
- Real-time collaborative marking (multiple faculty simultaneous editing of same sheet)
- Automatic question paper generation from syllabus
- Integrated plagiarism detection against external repositories
- Student-facing result portals (faculty-only review workflow)
- Built-in video conferencing or discussion tools

---

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Secure user authentication via JWT with role-based access (Admin, Faculty) | High |
| FR-002 | Faculty can upload Question Paper, Model Answer (Key Paper), and Student Answer Sheets (PDF/images) | High |
| FR-003 | System extracts document structure (pages, regions) using vision-first AI (Qwen2.5-VL) | High |
| FR-004 | Question Paper structure (questions, sub-parts, max marks) is automatically extracted and validated | High |
| FR-005 | Model Answer is extracted and stored; faculty must validate before use in evaluation | High |
| FR-006 | Answer Sheet processing maps each student response to a specific question using vision and layout analysis | High |
| FR-007 | If confidence in question mapping falls below threshold, answer is flagged for faculty review (no silent guessing) | High |
| FR-008 | Multi-page answer continuation is reconstructed before evaluation (spatial & semantic stitching) | High |
| FR-009 | AI evaluation model (Qwen3 8B) scores answers against the validated Model Answer, producing suggested marks and structured feedback | High |
| FR-010 | Independent verification AI (Qwen2.5-Coder 14B) validates evaluation output for constraint adherence (max marks, rubric logic) | High |
| FR-011 | Faculty review workspace displays original answer, AI evaluation, verification result, and allows override marks & remarks | High |
| FR-012 | Faculty approval finalizes the academic decision; system preserves AI suggested, faculty override, and final marks | High |
| FR-013 | Complete audit trail links final mark → faculty review → verification → AI evaluation → segmentation → mapping → document → upload | High |
| FR-014 | System supports durable asynchronous job processing via BullMQ/Redis with retries, backoff, and failure alerts | High |
| FR-015 | Storage abstraction allows swapping between local disk, S3, and MinIO without code or DB changes | Medium |
| FR-016 | Analytics and reporting operate only on final approved academic records (excludes pending/overridden states) | Medium |
| FR-017 | Structured logging, request tracing, and health/readiness endpoints provided for observability | Medium |
| FR-018 | API is versioned (`/api/v1`) and contract-validated via Zod (backend) and Freezed (Flutter) | Medium |
| FR-019 | Prompts are versioned, stored centrally, and recorded in audit logs for reproducibility | Medium |
| FR-020 | System provides endpoints to export provenance chain for external audit | Low |

---

## 6. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-001 | System shall recover gracefully from AI provider downtime (retry with exponential backoff, circuit breaker) | High |
| NFR-002 | 95th percentile end-to-end latency for a standard answer sheet (≤5 pages) shall be ≤90 seconds under nominal load, where nominal load is defined as 10 concurrent answer-sheet processing jobs. | High |
| NFR-003 | Backend shall support horizontal scaling of worker nodes for AI processing | High |
| NFR-004 | Flutter client shall achieve ≥60 FPS during PDF zoom/pan interactions on target hardware, defined as a mid‑range Windows 10/11 laptop (Intel i5‑1235U, 8 GB RAM, integrated graphics) or equivalent Android tablet (e.g., Samsung Galaxy Tab S8). FPS measured as the average over a 10‑second interaction session using Flutter’s performance overlay. | High |
| NFR-005 | All data at rest (PostgreSQL, object storage) shall be encrypted using industry-standard algorithms | High |
| NFR-006 | System shall satisfy OWASP ASVS Level 2 controls for authentication, authorization, and input validation | High |
| NFR-007 | Codebase shall maintain ≥80% unit test coverage for backend services and ≥70% widget test coverage for Flutter | Medium |
| NFR-008 | Database migrations shall be backward-compatible and support rollback | Medium |
| NFR-009 | System shall provide configurable data retention policies (e.g., purge raw uploads after 1 year) | Low |
| NFR-010 | Flutter app size shall not exceed 150 MB (Windows) / 100 MB (Android) after release build | Low |

---

## 7. V1 Lessons Learned

See `SMARTEVAL_RTP_V2_V1_LESSONS_LEARNED.md` for detailed failure modes, root causes, V2 preventions, and acceptance criteria.

Key themes addressed:
- Elimination of hardcoded paths, model names, and synthetic fallbacks
- Enforcement of strict layering (controller/service/repository)
- Asynchronous job processing to avoid HTTP timeouts
- Deterministic question mapping with faculty review fallback
- Full provenance and audit trail
- Technology abstraction layers (AI, storage)
- Contract-driven development (Zod/Freezed)
- Role-based access enforced at backend
- Deterministic faculty evaluation locking to avoid race conditions

---

## 8. Retained V1 Capabilities

The following V1 capabilities are **KEPT** in V2, possibly enhanced:
- Handwritten answer sheet upload & PDF/page extraction
- Dynamic Question Paper structure extraction
- Handwritten Key Paper / Model Answer extraction (with mandatory faculty validation)
- Faculty assignment and bundle routing
- Training example curation for dataset generation
- Core document understanding pipeline (VLM-first)

---

## 9. V2 Technology Stack

| Layer | Technology | Status | Reason |
|-------|------------|--------|--------|
| Client | Flutter | Proposed/Approved | Cross-platform, performant desktop/tablet/web |
| Language | Dart | Proposed/Approved | Flutter native |
| State Management | Riverpod | Proposed | Scalable, testable state |
| Navigation | GoRouter | Proposed | Declarative routing & guards |
| HTTP Client | Dio | Proposed | Interceptors, caching, secure storage |
| Secure Storage | flutter_secure_storage | Proposed | Encrypted token storage (where supported) |
| Data Modeling | freezed + json_serializable | Proposed | Immutable, serializable DTOs |
| Charts | fl_chart | Proposed | Rich, customizable analytics |
| PDF Rendering | **TBD** (pdfrx / flutter_pdfview / syncfusion) | OPEN DECISION | Evaluate for zoom/pan/annotation performance |
| Backend Runtime | Node.js | Approved | Mature ecosystem, TypeScript support |
| API Framework | Express | Approved | Minimal, unopinionated, middleware support |
| Backend Language | TypeScript | Approved | Static typing, refactor safety |
| Request Validation | Zod | Proposed | Schema validation, parsing, error formatting |
| Response Validation | Zod | Proposed | Contract enforcement |
| Database | PostgreSQL | Approved | ACID, robust, widely supported |
| ORM | Prisma | Approved | Type-safe, migration system, developer ergonomics |
| Job Queue | BullMQ | Approved | Reliable, Redis-backed, retry/prioritization |
| Queue Infrastructure | Redis | Approved | Fast, pub/sub, atomic operations |
| AI Runtime (Initial) | Ollama | Initial | Local inference, no API cost, easy setup |
| Vision Model | Qwen2.5-VL 7B | Initial | Strong document/layout understanding |
| Evaluation Model | Qwen3 8B | Initial | Reasoning, rubric adherence, scoring |
| Verification Model | Qwen2.5-Coder 14B | Initial | Code/logic validation, constraint checking |
| AI Abstraction | StorageProvider | Approved | Swap between local/S3/MinIO |
| Storage Abstraction | StorageProvider | Approved | Swap between local/S3/MinIO |
| Prompt Management | Centralized Versioned Templates | Proposed | Auditability, reproducibility |
| Logging | pino (backend) / logger (flutter) | Proposed | Structured, correlatable |
| Observability | Health/Readiness endpoints, request IDs | Proposed | Liveness, tracing |
| Testing Framework | Jest (backend) / flutter_test (flutter) | Required | Unit, widget, integration |
| E2E Testing | Supertest + integration_test | Required | Critical path validation |
| CI/CD | GitHub Actions (TBD) | Planned | Automated build, test, deploy |
| Containerization | Docker | Planned | Consistent environments |
| Desktop Installer | Inno Setup / MSIX (Windows) | Target | Standard Windows deployment |

---

## 10. System Architecture

SmartEval RTP_v2 follows a **Layered Modular Monolith** architecture:

```
[Flutter Client]
        ↓ (REST /api/v1 over HTTPS)
[API Gateway (Express)]
        ↓
[Authentication & RBAC Middleware]
        ↓
[Controller Layer] (DTO validation, orchestration)
        ↓
[Service Layer] (domain use cases, transactions)
        ↓
[Repository Layer] (Prisma models, custom queries)
        ↓
[PostgreSQL] (System of Record)
        ↓ ↑
[Redis / BullMQ] (Job Queue, Worker Processing)
        ↓
[AI Workers] (Vision, Evaluation, Verification via Ollama Abstraction)
        ↓
[StorageProvider] (Local / S3 / MinIO)
```

* **Layer Isolation:** No layer skips another; controllers never access repositories directly; services never call AI or storage without abstractions.
* **Stateless Services:** Horizontal scaling enabled via shared DB and external state (Redis, storage).
* **Event-Driven Jobs:** Long-running tasks (document processing, AI inference) submitted to BullMQ; API returns `202 Accepted` with job ID.
* **Flutter Client:** Communicates exclusively via REST API; no direct DB, Prisma, Redis, or AI access.

---

## 11. Flutter Architecture

The Flutter application follows a **feature-first** structure:

```
lib/
  core/             → singletons, DI, error handling, platform abstractions
  config/           → environment, themes, constants
  routing/          → GoRouter configuration, route guards
  networking/       → Dio client, interceptors, API endpoints, Zod/Freezed mappers
  authentication/   → login, token storage, auth state
  storage/          → abstract storage service (backed by flutter_secure_storage + http)
  theme/            → ThemeData, dark/light, customizations
  shared/           → reusable widgets, utils, constants
  features/
    auth/           → login, logout, password reset
    dashboard/      → overview widgets for admin/faculty
    examinations/   → CRUD, upload, status, bundles
    question_papers/→ view, extract, validate
    model_answers/  → view, extract, faculty approval
    answer_sheets/  → upload, view, processing status
    faculty/        → faculty CRUD, assignment
    evaluation/     → job submission, progress, results
    review/         → Faculty Evaluation Workspace (core)
    analytics/      → charts, reports, exports
    settings/       → system, AI, storage, appearance
```

* **State Management:** Riverpod providers scoped by feature (e.g., `examinationProvider`, `facultyProvider`).
* **Navigation:** Protected routes via `GoRouter` redirects based on auth & role.
* **Theme:** Dynamic dark/light with custom brand colors; supports Windows desktop adaptations.
* **Platform Abstractions:** `IPlatformService` for file picking, printing, and native dialogs (implemented per OS via method channel).
* **Testing:** Unit tests for providers/widgets; widget tests for UI integration; integration tests for critical flows (login → upload → review → approval).

---

## 12. Backend Architecture

Backend organized as a **modular monolith** with domain folders:

```
src/
  controllers/      → Express route handlers (thin, DTO mapping)
  services/         → domain use cases, transaction boundaries
  repositories/     → Prisma model wrappers, custom queries
  middleware/       → auth, rbac, validation, error handling
  utils/            → logging, helpers, constants
  config/           → env, db, ai, storage, queue
  jobs/             → BullMQ job definitions, processors
  providers/        → abstractions: IAIService, IStorageProvider, IPromptManager
  domains/          → optional: grouped domain logic if service grows large
```

* **Controllers:** Validate incoming DTOs via Zod; map to service calls; return appropriate HTTP status.
* **Services:** Encapsulate business logic; transactional where needed (Prisma `$transaction`).
* **Repositories:** Thin wrapper around Prisma; keep services free of ORM details.
* **Jobs:** Define BullMQ processors (e.g., `ProcessDocumentJob`, `RunEvaluationJob`); isolated workers.
* **Providers:** Interfaces allow swapping implementations (e.g., mock AI in tests, S3 storage in prod).

---

## 13. Domain Architecture

Core business domains (aligned with folders/services):

| Domain | Responsibility |
|--------|----------------|
| **Auth & Authorization** | Users, roles, permissions, JWT issuance/validation |
| **Examination** | Exam creation, scheduling, lifecycle, status |
| **Question Paper** | Upload, parsing, structure extraction, validation |
| **Model Answer** | Upload, extraction, faculty validation, versioning |
| **Answer Sheet** | Upload, storage, processing pipeline initiation |
| **Document Processing** | Page extraction, image prep, queuing for vision |
| **Vision** | AI-based layout understanding, region detection, OCR fallback |
| **Question Mapping** | Spatial + semantic association of answer regions to questions |
| **Answer Reconstruction** | Multi-page stitching, continuity detection |
| **AI Evaluation** | Scoring via Qwen3, feedback generation, mark suggestion |
| **Verification** | Constraint checking via Qwen2.5-Coder, rubric logic |
| **Faculty Review** | Review workflow, override, remarks, approval |
| **Audit & Provenance** | Immutable logs linking every stage, metadata capture |
| **Storage** | Abstraction for local/cloud object storage |
| **Job Processing** | Queue definitions, worker orchestration, retries |
| **Analytics** | Aggregated reporting on final approved records |
| **AI Provider** | Configuration, model selection, prompt templating |
| **Prompt Management** | Versioned template storage, variable injection |

---

## 14. Database Architecture

PostgreSQL schema designed for **auditability** and **normalization**. Key tables (simplified):

- `users` (id, email, role, password_hash, created_at)
- `faculty` (id, user_id, department, title)
- `examinations` (id, name, term, course_code, status)
- `question_papers` (id, examination_id, storage_key, extracted_json, validated_by, validated_at)
- `model_answers` (id, question_paper_id, storage_key, extracted_json, validated_by, validated_at)
- `answer_sheets` (id, student_id, examination_id, storage_key, uploaded_at, status)
- `document_pages` (id, answer_sheet_id, page_number, storage_key, width, height)
- `vision_results` (id, document_page_id, raw_vlm_output, processed_regions, created_at)
- `question_mappings` (id, vision_result_id, question_number, confidence, bounding_box, status)
- `answer_segments` (id, question_mapping_id, text_content, bbox, page_sequence)
- **Note:** multi-page segments link via `page_sequence` array.
- `ai_evaluations` (id, answer_segment_id, model_used, prompt_version, suggested_marks, feedback_json, token_usage, created_at)
- `ai_verifications` (id, ai_evaluation_id, verification_result, passed_constraints, feedback, created_at)
- `faculty_reviews` (id, answer_segment_id, faculty_id, reviewed_marks, remarks, approved_at, version_id)
- `final_marks` (id, answer_segment_id, faculty_review_id, ai_suggested_marks, faculty_marks, final_marks, decided_by, decided_at)
- `audit_log` (id, entity_type, entity_id, action, performed_by, before_json, after_json, timestamp)
- `storage_keys` (id, bucket, object_path, mime_type, size, uploaded_at, sha256)
- `jobs` (id, queue_name, payload, status, attempts, last_error, created_at, updated_at)
- `prompt_versions` (id, name, version, template, variables, active, created_at)

* All tables include `created_at` / `updated_at` (where appropriate).
* Immutable audit: `audit_log` stores pre/post JSON for changes to critical entities.
* Storage keys reference actual files in StorageProvider (local/S3/MinIO).
* Enumerated statuses: `UPLOADED`, `PROCESSING`, `FAILED`, `READY_FOR_REVIEW`, `REVIEWED`, `APPROVED`, `NOT_READY`.

---

## 15. API Architecture

RESTful, versioned at `/api/v1`. Uses standard HTTP verbs and status codes.

* **Authentication:** `POST /api/v1/auth/login` returns JWT; `Authorization: Bearer <token>` header required on protected routes.
* **RBAC:** Middleware checks role claims (`ADMIN`, `FACULTY`).
* **Validation:** All request bodies validated via Zod schemas before reaching controller.
* **Responses:** Enveloped format `{ success: boolean, data?: any, error?: { code, message } }`; errors follow RFC 7807 problem details where appropriate.
* **Versioning:** URL-based; future `/api/v2` if breaking change needed.
* **Documentation:** OpenAPI 3.0 spec auto-generated from Zod + JSDoc; served at `/api/docs`.
* **Endpoints by Domain:**
  - `/api/v1/auth`
  - `/api/v1/users`
  - `/api/v1/faculty`
  - `/api/v1/examinations`
  - `/api/v1/question-papers`
  - `/api/v1/model-answers`
  - `/api/v1/answer-sheets`
  - `/api/v1/document-processing`
  - `/api/v1/vision`
  - `/api/v1/question-mapping`
  - `/api/v1/answer-reconstruction`
  - `/api/v1/ai-evaluation`
  - `/api/v1/ai-verification`
  - `/api/v1/faculty-review`
  - `/api/v1/analytics`
  - `/api/v1/settings`
  - `/api/v1/storage`
  - `/api/v1/jobs`
  - `/api/v1/prompt-versions`

* **Async Pattern:** Creation endpoints (e.g., upload answer sheet) return `202 Accepted` with `{ jobId, statusEndpoint: `/api/v1/jobs/:jobId` }`; client polls or subscribes to WebSocket/SSE for updates.

---

## 16. AI Architecture

AI access is abstracted via `IAIService` with implementations per provider (initial: `OllamaAIService`). Features:

* **Prompt Templating:** Load versioned template from `prompt_versions` table; inject variables (question text, max marks, context).
* **Model Selection:** Configured per task (vision, evaluation, verification) via environment or admin settings.
* **Parameter Passing:** temperature, top_p, max_tokens passed as config; not hardcoded.
* **Error Handling:** Translates provider errors into domain exceptions (`AIProviderUnavailableException`, `AIResponseParseException`).
* **Logging:** Logs model, prompt version, token usage, latency for each call.
* **Fallbacks:** No synthetic fallbacks; on failure, job status set to `FAILED_AI_UNAVAILABLE` with retry.

**Workflow:**
1. Job processor loads prompt and variables.
2. Calls `IAIService.generateText({ model, prompt, parameters })`.
3. Validates response against expected schema (Zod on backend).
4. Returns structured output to next phase.

---

## 17. Document Processing Architecture

Stages:
1. **Upload:** Client sends multipart/file to `/api/v1/answer-sheets`; backend stores via `IStorageProvider`, creates `answer_sheets` record, enqueues `ProcessDocumentJob`.
2. **Page Extraction:** Worker converts PDF to images (per page) using `pdf-poppler` or `mupdf`; stores each page image; creates `document_pages`.
3. **Preprocessing:** Optional deskew, enhancement (OpenCV via shell call if needed).
4. **Vision Job:** Enqueues `RunVisionJob` per page; calls VLM with prompt: *"Identify question numbers, regions, and layout on this exam page. Return JSON."*
5. **Output:** Stores VLM JSON, creates `vision_results`.
6. **Result Flow:** Vision results feed into question mapping.

* **Storage:** Page images kept in storage bucket; referenced by `storage_key`.
* **Failure:** If vision fails, job moves to `FAILED_VISION`; retry logic applies.

---

## 18. Question Mapping Architecture

Goal: Associate each answer region (text + bounding box) to a specific question number from the Question Paper.

Steps:
1. Load Question Paper extracted JSON (questions with expected numbers, subparts, optional regex patterns for numbers).
2. For each `vision_result`, run heuristic + VLM pass:
   * **Heuristic:** Use OCR/Tesseract fallback to detect numbers near bounding boxes.
   * **VLM Refining:** Prompt: *"Given this image region and the question list {Q1, Q2, ...}, which question number does this region most likely belong to? Return { question_number: string, confidence: number }."*
3. Confidence threshold (e.g., 0.85) determines outcome:
   * ≥ threshold → create `question_mappings` record with status `MAPPED`.
   * < threshold → create record with status `UNMAPPED_NEEDS_FACULTY_REVIEW`; halts further AI evaluation for that segment.
4. **Spatial Validation:** Ensure bounding box lies within expected question area on page (if defined by instructor-provided zones).

* **Immutable Record:** Mapping status stored; if later faculty manually maps, new record created with `MAPPED_BY_FACULTY`.

---

## 19. Evaluation Architecture

Uses Qwen3 8B to score answer segment against Model Answer.

Input to model:
* Prompt template: `evaluation_v2.0.txt`
* Variables:
  - `question_text` (from Question Paper)
  - `max_marks` (from Question Paper)
  - `model_answer_text` (extracted and validated)
  - `student_answer_text` (from answer segment)
  - `rubric_notes` (optional, from instructor)

Output schema (Zod enforced):
```json
{
  "suggested_marks": number,
  "feedback": {
    "strengths": string[],
    "weaknesses": string[],
    "improvement_suggestions": string[]
  },
  "reasoning": string
}
```

* **Validation:** `suggested_marks` must be between 0 and `max_marks` (inclusive). If outside, verification will fail and route to faculty review.
* **Token Usage:** Logged for audit and cost monitoring.
* **Deterministic:** Same prompt + input yields same output (subject to model temperature). Temperature set low (0.2) for consistency.

---

## 20. Verification Architecture

Independent verification using Qwen2.5-Coder 14B checks AI output for logical consistency and constraint adherence.

Checks:
1. `suggested_marks` is numeric and 0 ≤ marks ≤ `max_marks`.
2. Feedback corresponds to strengths/weaknesses implied by reasoning.
3. No hallucinated criteria outside the rubric.
4. Reasoning does not contradict the model answer (basic entailment check via prompt).

Prompt template: `verification_v2.0.txt`
Input: `{ model_answer, student_answer, ai_evaluation }`
Output schema:
```json
{
  "passed": boolean,
  "failed_constraints": string[],
  "feedback": string
}
```

* If `passed == false`, job fails and answer segment routed to `FACULTY_REVIEW`.
* Passed verification allows progression to faculty review as normal (still requires faculty approval).

---

## 21. Faculty Governance

Faculty remain the final academic authority. System enforces:

* **AI Suggestion:** `ai_evaluations.suggested_marks` (non-binding).
* **Faculty Override:** `faculty_reviews.reviewed_marks` entered by faculty during review.
* **Final Decision:** `final_marks.final_marks` equals `reviewed_marks` if faculty overrides; otherwise falls back to `ai_evaluations.suggested_marks` after faculty approves (no override).
* **Remarks:** Free-text field for faculty justification.
* **Review Workflow:** Faculty sees:
  * Original answer segment (image + text)
  * Question text and max marks
  * Model answer
  * AI evaluation + verification result
  * Their own prior review (if any)
* **Actions:** Approve, Request Revision (return to student? out of scope), Override Marks, Add Remarks.
* **Duplicate Prevention:** Optimistic lock on `answer_segments` via `version_id`; faculty must provide current `version_id` to submit review; mismatch → `409 Conflict`.

---

## 22. Job Processing

Uses BullMQ with Redis backend. Each job type is a separate queue for independent scaling.

Key queues:
* `document-processing` (PDF → pages)
* `vision` (per page VLM)
* `question-mapping` (spatial+semiotic association)
* `answer-reconstruction` (multi-page stitching)
* `ai-evaluation` (Qwen3 scoring)
* `ai-verification` (Qwen2.5-Coder checking)
* `faculty-review` (notifications, reminder emails)
* `storage-maintenance` (cleanup, virus scan)
* `analytics-aggregation` (nightly rollups)

Job payload includes:
* IDs of related entities (answer sheet, page, segment)
* Correlation ID for tracing
* Retry count, max attempts

Worker features:
* Graceful shutdown (current job finishes before exit)
* Detailed error logging (stack trace, job payload)
* Dead letter queue for repeatedly failing jobs (>3 attempts)
* Metrics: job latency, throughput, failure rate (exported via Prometheus if needed)

---

## 23. Storage

Abstraction via `IStorageProvider` with methods:
* `upload(file): Promise<StorageKey>`
* `download(key): Promise<Buffer>`
* `exists(key): Promise<boolean>`
* `delete(key): Promise<void>`
* `getUrl(key, expiresIn): Promise<string>` (presigned URL if cloud)

Providers:
* `LocalStorageProvider` (development, simplicity)
* `S3StorageProvider` (production AWS)
* `MinIOStorageProvider` (on-prem S3-compatible)

Configuration:
* Environment variable `STORAGE_PROVIDER=local|s3|minio`
* Bucket/region/credentials via `.env` or secrets manager
* All database records store `storage_key` (logical path), never OS paths.

---

## 24. Security

* **Authentication:** 
    * Access token: short‑lived (15 min), kept in memory only, sent via `Authorization: Bearer <token>` header.
    * Refresh token: long‑lived (7 days), stored securely via `flutter_secure_storage` (encrypted when platform provides).
    * Endpoint `POST /api/v1/auth/refresh` exchanges a valid refresh token for a new access token (rotation on use).
    * JWT signed with RS256; private key stored in vault or secret manager (dev: HS256 for convenience).
* **Authorization:** Role-based middleware; resource ownership checks (e.g., faculty can only review bundles assigned to them).
* **Input Validation:** Zod schema validation on all incoming data (query, params, body).
* **Output Encoding:** Auto escaping in templates where applicable; JSON endpoints set `Content-Type: application/json`.
* **CORS:** Restrict to approved origins (intranet domains) via middleware.
* **Rate Limiting:** Express middleware to prevent brute force (login) and API abuse.
* **File Upload:** Whitelist extensions (`.pdf`, `.png`, `.jpg`, `.tiff`); max size 25 MB; virus scan via ClamAV in storage-maintenance job.
* **Secrets:** Database URLs, API keys, JWT keys loaded from environment or secret manager (never in code).
* **Logging:** Avoid logging PII or tokens; mask JWT in logs.
* **Headers:** `Helmet` middleware for secure HTTP headers (XSS, CSP, HSTS).
* **Dependencies:** `npm audit` and `dart pub outdated` checked in CI.
* **Pen Testing:** Annual third-party assessment scheduled post-MVP.

---

## 25. Audit / Provenance

Every state-changing action logged to `audit_log` table with:
* `entity_type` (e.g., `answer_sheet`, `final_mark`)
* `entity_id` (FK)
* `action` (`CREATED`, `UPDATED`, `DELETED`, `APPROVED`, `FAILED`)
* `performed_by` (user_id or `system`)
* `before_json` (snapshot pre-change, nullable)
* `after_json` (snapshot post-change, nullable)
* `timestamp`

Additional domain-specific audit tables:
* `vision_results` stores raw VLM output and parsing metadata.
* `ai_evaluations` stores prompt version, model used, token counts.
* `ai_verifications` stores verification output.
* `faculty_reviews` stores reviewed marks, remarks, and `version_id` for optimistic locking.

End-to-end traceability example:
* Final mark `100` → links to faculty review → links to AI evaluation → links to answer segment → links to vision result → links to document page → links to answer sheet storage key → links to original upload event.

API: `GET /api/v1/audit/provenance/:answerSheetId` returns chronological graph.

---

## 26. Observability

* **Structured Logging:** JSON logs with `timestamp`, `level`, `message`, `service`, `traceId`, `spanId`, `userId` (if authenticated).
* **Tracing:** `X-Request-ID` header propagated through backend services; appears in logs.
* **Metrics:** Prometheus endpoint (`/metrics`) exposing:
  * `http_requests_total`
  * `job_processing_seconds`
  * `ai_inference_latency`
  * `storage_operation_latency`
  * `failed_jobs_total`
  * `active_sessions`
* **Health Endpoints:**
  * `GET /health/liveness` → `200` if process alive
  * `GET /health/readiness` → `200` if DB, Redis, storage reachable
* **Alerting:** Thresholds on job failure rate, AI latency, storage errors (to be configured in monitoring system like Prometheus + Alertmanager).
* **Flutter:** Logging via `logger` package; crash reporting via Firebase Crashlytics (optional).

---

## 27. Testing

### Backend
* **Unit Tests:** Jest + ts-jest; mock repositories and external services (AI, storage).
* **Service Tests:** Test use cases with in-memory SQLite (via Prisma) or real PostgreSQL in Docker.
* **API Tests:** Supertest against express app; validate status, schema, error responses.
* **Contract Tests:** Ensure OpenAPI spec matches Zod schemas (optional CI step).
* **Test Coverage Target:** ≥80% for services, ≥70% for controllers.

### Flutter
* **Unit Tests:** `flutter_test` for pure Dart logic (providers, converters, utils).
* **Widget Tests:** Test individual widgets in isolation (buttons, forms, cards).
* **Integration Tests:** `integration_test` for critical flows:
  * Login → Upload Answer Sheet → View Status → Faculty Review → Approve → Verify Persistence
  * Role-based access denial attempts
* **Test Coverage Target:** ≥70% for widgets and providers.

### System / E2E
* **End-to-End Workflow Tests:** Scripted using combination of backend API calls and Flutter driver:
  1. Upload Question Paper → extract → validate
  2. Upload Model Answer → extract → faculty validate
  3. Upload Answer Sheet → triggers pipeline
  4. Wait for job completion (polling)
  5. Faculty review page loads correct data
  6. Faculty overrides marks, adds remark, approves
  7. Verify final mark persisted and audit log complete
  8. Verify no synthetic fallbacks used (check prompt/version in audit)
* **Run Frequency:** Nightly on staging; on every PR to preview environment.

### Test Data
* Factories generate random but realistic data (names, UUIDs, timestamps).
* No hardcoded IDs; tests retrieve created entities via response.
* Database cleaned via transaction rollback or TRUNCATE between tests.

---

## 28. Deployment

### Development
* Local Docker compose: `postgres`, `redis`, `ollama` (optional), `minio` (for S3-like storage)
* Backend runs via `npm run dev` (ts-node-dev)
* Frontend runs via `flutter run -d chrome` (web) or `flutter run -d windows`

### Staging / Production
* **Container Images:** Multi-stage Docker builds for backend and worker.
* **Orchestration:** Docker Compose or Kubernetes (if scale demands); initially single VM with Docker Compose.
* **Environment Segregation:** Separate `.env` files for `dev`, `staging`, `prod`.
* **Secrets Management:** HashiCorp Vault or AWS Secrets Manager (prod); `.env` ignored in VCS.
* **CI/CD Pipeline:**
  * On PR: lint, unit tests, build Docker images, push to registry
  * On merge to `main`: deploy to `staging`, run smoke tests, promote to `prod` on approval
* **Rollback:** Docker image tags immutable; rollback via redeploy previous tag.
* **Database Migrations:** Run as part of startup (`prisma migrate deploy`) with backup pre-check.
* **Rollback Strategy:** If migration fails, service does not start; alert.
* **SSL/TLS:** Terminate at ingress (NGINX/TRAEFIK) or cloud load balancer; internal traffic may be plain TLS or mTLS in high-security zones.

---

## 29. Migration / Data Considerations

* **From V1 to V2:** No direct data migration envisioned; V1 is reference only. If needed, ETL scripts will:
  * Map V1 entities to V2 schema (answer sheets, question papers, etc.)
  * Preserve original upload timestamps and storage keys (if accessible)
  * Not attempt to migrate AI scores or faculty reviews (treat as historical, not authoritative).
* **Storage Migration:** Switching providers (local → S3) done via `IStorageProvider` abstraction; existing keys continue to work; new uploads use new provider.
* **Schema Evolutions:** Prisma migrations manage additive changes; breaking changes require explicit migration scripts with data backfill.
* **Multi-tenancy:** Not in scope; single institutional deployment per instance. For multiple colleges, deploy separate instances.

---

## 30. Traceability

Requirements → Design → Implementation → Test → Evidence tracked via:
* **Requirement IDs** (FR-, NFR-) referenced in ADRs and specification sections.
* **ADR IDs** (ADR-001, etc.) linking decisions to requirements.
* **Implementation:** Source code comments include `[FR-001]` where relevant.
* **Tests:** Test case names include requirement ID (e.g., `should_return_401_when_missing_jwt_[FR-001]`).
* **Evidence:** Test reports, audit logs, and deployment artifacts reference requirement verification.

Traceability matrix maintained in `SMARTEVAL_RTP_V2_TRACEABILITY.md`.

---

## 31. Acceptance Criteria

SmartEval RTP_v2 is considered complete when:

1. **All Functional Requirements (FR-001 to FR-020)** are implemented and pass automated tests.
2. **All Non-Functional Requirements (NFR-001 to NFR-010)** are validated via performance, security, and load testing.
3. **End-to-End Workflow** (Question Paper → Model Answer → Answer Sheet → Evaluation → Faculty Review → Approval → Persistence → Audit) executes successfully on realistic data sets (minimum 50 answer sheets) with zero synthetic fallbacks.
4. **Audit & Provenance** chain is complete and verifiable for a sample of 10 random answer sheets.
5. **Security Assessment** passes OWASP ASVS Level 2 checklist (external or internal).
6. **Performance:** 95th percentile end-to-end latency ≤90 seconds for a 5-page answer sheet under nominal load (simulated 10 concurrent jobs).
7. **Flutter Client** builds and runs on Windows desktop and Android tablet (≥ API 24) with UI responsiveness ≥60 FPS during PDF interaction.
8. **Documentation:** All eight required docs (Master Spec, Architecture, Tech Stack, V1 Lessons, ADRs, Traceability, Roadmap, Acceptance Criteria) are reviewed and approved.
9. **No Production Code** has been written prior to specification approval (this condition satisfied by construction of this document).

---

## 32. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Vision model misreads handwriting leading to incorrect mapping | Medium | High | Faculty review override; confidence threshold; improve prompts; allow manual mapping in workspace |
| AI provider downtime halts processing | Low | Medium | BullMQ retry with exponential backoff; circuit breaker; alert on repeated failures |
| Faculty bypass review and trust AI suggestions | Low | High | System design enforces faculty review step; UI hides suggested marks until review opened |
| Storage costs balloon with unlimited retention | Medium | Medium | Implement lifecycle policies; storage quota alerts; periodic cleanup job |
| Flutter performance insufficient for large PDF zooms | Low | High | Evaluate multiple PDF packages; use downsampling for preview; cache rendered textures |
| Regulatory changes require data residency adjustments | Low | Medium | Storage abstraction allows switching to on-prem MinIO; DB can be hosted in-region |
| Team lacks Dart/Flutter experience | Medium | Low | Pair programming; internal workshops; use proven Riverpod patterns |
| V2 scope creep re-introduces V1 anti-patterns | Low | High | Enforce specification-first process; architecture review board; ADR for deviations |

---

## 33. Open Decisions

| ID | Decision | Status | Notes |
|----|----------|--------|-------|
| OPD-001 | PDF rendering package for Flutter (zoom/pan/annotate) | **OPEN** | Evaluating `pdfrx`, `flutter_pdfview`, `syncfusion_flutter_pdfviewer`, `pdfx`. Criteria: performance, annotation layer, Windows/Android support, license. |
| OPD-002 | State management alternative to Riverpod (e.g., Bloc) | **RESOLVED** | Riverpod chosen for testability and scalability. |
| OPD-003 | Deployment orchestrator (Docker Compose vs K8s) | **OPEN** | Start with Docker Compose; evaluate K8s if scaling > 10 worker nodes or multi-zone HA required. |
| OPD-004 | AI provider for production (Ollama vs vLLM vs external) | **OPEN** | Ollama for MVP; re-evaluate vLLM for better GPU utilization; external only if institution approves and signs BAA. |
| OPD-005 | Prompt storage: DB table vs file system + version control | **RESOLVED** | Storing in `prompt_versions` table for atomic backups, audit, and promotion via migrations. |
| OPD-006 | Notification channel: email vs in-app vs SMS | **OPEN** | Email for MVP; consider in-app notifications via WebSocket/SSE; SMS for critical alerts (requires Twilio). |
| OPD-007 | Multi-factor authentication | **OPEN** | Evaluate TOTP (Google Authenticator) for admin/faculty; assess usability vs security trade-off. |
| OPD-008 | Analytics engine: fl_chart vs custom canvas | **RESOLVED** | fl_chart sufficient for MVP; reevaluate if complex visualizations needed. |
| OPD-009 | AI verification strictness level (heuristic vs LLM-based) | **OPEN** | Starting with LLM-based verification (Qwen2.5-Coder); may augment with rule-based checks for performance. |
| OPD-010 | Backup strategy for PostgreSQL and storage | **OPEN** | Evaluate WAL-E for PostgreSQL, Restic/minio client for object storage; define RPO/RTO. |

---

## 34. Future Extensions

Post-MVP, consider:
* **Student Portal:** Limited view of own grades and feedback (read-only).
* **AI-Assisted Question Paper Generation:** From syllabus topics using LLMs.
* **Plagiarism Detection:** Integration with institutional repository (e.g., Turnitin via API).
* **Adaptive Timing:** Dynamic time limits per question based on historical data.
* **Multilingual Support:** Interface and prompt translation for non-English exams.
* **Accessibility:** WCAG 2.1 AA compliance (screen reader, contrast, keyboard nav).
* **Offline Sync:** Flutter Hive or SQLite for intermittent connectivity (tablet use in exam halls).
* **Blockchain Audit Log:** Immutable ledger for high-stakes certifications (research).
* **Scheduler:** Recurring jobs for analytics aggregation, backup, storage cleanup.
* **Exam Security:** Lockdown browser integration for computer-based test sections.
* **AI Tutoring:** Generate personalized practice questions from past performance (opt-in).

---

*End of Specification*