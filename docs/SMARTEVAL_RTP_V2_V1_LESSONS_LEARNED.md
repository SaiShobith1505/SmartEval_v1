# SmartEval RTP_v2 — V1 Lessons Learned & Capability Evaluation Matrix

**Document Status:** Authoritative Architectural Analysis  
**Date:** September 12, 2026  
**System Version:** SmartEval RTP_v2  

---

## 1. Executive Summary

The transition from SmartEval **RTP_v1** to **RTP_v2** is driven by empirical evidence gathered from the V1 proof-of-concept deployment. While V1 validated the institutional value of AI-assisted evaluation for handwritten university answer sheets, it also exposed systemic architectural weaknesses, hidden hardcoding, tight coupling, and brittle state management.

This document presents:
1. A forensic analysis of 18 critical V1 failure modes, detailing the root cause, V2 architectural prevention, implementation requirements, and acceptance criteria.
2. A capability evaluation matrix categorizing V1 features into **KEEP**, **IMPROVE**, **REDESIGN**, or **REMOVE**.

---

## 2. Forensic Analysis of V1 Failures & V2 Architectural Solutions

### 2.1 Architecture Drift & Lack of Boundaries
* **V1 Problem:** Business logic, file path manipulation, and AI prompt formatting leaked into Express controllers and React components.
* **Root Cause:** Absence of strict domain boundary enforcement and lack of clean layered architecture.
* **V2 Architectural Prevention:** Adopt a **Modular Monolith** architecture with strict layer isolation: `Controller -> Service -> Repository -> Data Access`. The Flutter client communicates solely via REST API; domain modules are isolated.
* **V2 Implementation Requirement:** Controller methods must contain zero domain/business logic. Services orchestrate domain rules; repositories handle DB interactions.
* **V2 Test / Acceptance Criterion:** Unit tests verify controllers only map DTOs and return HTTP statuses. Dependency boundary checks enforce no direct DB or AI calls from controllers/clients.

### 2.2 Hardcoded File Paths & Directory Coupling
* **V1 Problem:** Absolute local file paths (e.g., `C:/uploads/temp/...`) were hardcoded in services and stored directly in database records.
* **Root Cause:** Direct filesystem interaction without an abstraction layer.
* **V2 Architectural Prevention:** Implement a **StorageProvider** pattern (`LocalStorageProvider`, `S3StorageProvider`, `MinIOStorageProvider`) exposing URI keys (e.g., `storage://bundles/2026/sheet_101.pdf`).
* **V2 Implementation Requirement:** All file read/write operations must pass through `IStorageProvider`. Database stores relative storage keys, never OS-specific paths.
* **V2 Test / Acceptance Criterion:** Switching storage provider implementations via configuration allows seamless execution without altering application code or DB records.

### 2.3 Hardcoded AI Model Configurations & Names
* **V1 Problem:** Model names like `"qwen2.5-vl:latest"` were hardcoded across multiple service files, preventing model rotation or parameter tuning.
* **Root Cause:** Lack of centralized AI provider configuration and registry.
* **V2 Architectural Prevention:** Introduce an **AI Provider Abstraction** layer (`IAIService`, `IAIProvider`) driven by environment/config declarations.
* **V2 Implementation Requirement:** Models, parameters (temperature, top_p, max_tokens), and endpoints are injected via configuration bindings.
* **V2 Test / Acceptance Criterion:** Model switches are performed exclusively via `.env` or configuration updates without touching typescript/dart source code.

### 2.4 Mock / Synthetic Production Fallbacks
* **V1 Problem:** When AI inference or vision extraction failed, V1 silently generated synthetic model answers or mock scores to prevent UI crashes.
* **Root Cause:** Prioritizing immediate demo success over institutional academic integrity.
* **V2 Architectural Prevention:** **Strict Zero-Synthetic Rule**. If a key paper or model answer is missing, the workflow state transitions explicitly to `NOT_READY` or `FACULTY_REVIEW_REQUIRED`.
* **V2 Implementation Requirement:** Throw explicit domain errors (`ModelAnswerMissingException`, `UnmappedQuestionException`) and log processing failures. Synthetic fallbacks in production are strictly forbidden.
* **V2 Test / Acceptance Criterion:** E2E test asserts that uploading an answer sheet without a valid key paper halts processing with status `NOT_READY` and flags it for faculty review.

### 2.5 Frontend / Backend DTO Mismatches
* **V1 Problem:** Backend API changes frequently broke React components due to untyped, manually synchronized JSON objects.
* **Root Cause:** Absence of a single source of truth for API contracts.
* **V2 Architectural Prevention:** Contract-driven development using **Zod schemas** on the backend and strongly-typed **Freezed / JSON Serializers** on the Flutter frontend, validated against API OpenAPI/Swagger specs.
* **V2 Implementation Requirement:** Shared REST contract definition `/api/v1` validated by Zod middleware on request and response shapes.
* **V2 Test / Acceptance Criterion:** Automated integration test suite validates all API response payloads against Zod contracts; client generator catches breaking schema changes.

### 2.6 Route Inconsistencies & Weak Backend Authorization
* **V1 Problem:** API endpoints lacked uniform REST naming conventions (e.g., `/get_data` mixed with `/api/v1/user`), and authorization checks relied solely on client route guards.
* **Root Cause:** Ad-hoc route creation without API governance and missing backend authorization middleware.
* **V2 Architectural Prevention:** Standardized RESTful versioned routes `/api/v1/...` protected by centralized JWT authentication and Role-Based Access Control (RBAC) middleware (`requireRole(['ADMIN', 'FACULTY'])`).
* **V2 Implementation Requirement:** Every backend endpoint validates JWT signature, token expiration, and permission scopes before hitting the service layer.
* **V2 Test / Acceptance Criterion:** Security test verifies that unauthenticated or unauthorized requests to any `/api/v1/*` route return `401 Unauthorized` or `403 Forbidden`.

### 2.7 Long-Running AI Timeout Problems & Opaque Processing
* **V1 Problem:** Vision extraction and AI evaluation were executed synchronously in HTTP request handles, causing HTTP 504 gateway timeouts.
* **Root Cause:** Performing long-running background tasks inside synchronous web request/response cycles.
* **V2 Architectural Prevention:** Asynchronous, event-driven task processing using **BullMQ** queues backed by **Redis**, with state persistence in **PostgreSQL**.
* **V2 Implementation Requirement:** API endpoints submit job tasks to BullMQ queues, returning HTTP 202 (`Accepted`) with a `jobId`. Clients poll or stream job status via WebSocket/SSE.
* **V2 Test / Acceptance Criterion:** Simulating a 120-second AI inference job returns an immediate 202 response, processes reliably in the worker, and updates the DB job state to `COMPLETED`.

### 2.8 Incomplete Question Context During Vision Extraction
* **V1 Problem:** Answer sheet pages were OCR'd/extracted in isolation without passing the Question Paper schema, resulting in misidentified question numbers.
* **Root Cause:** Decoupled pipeline stages where vision extraction lacked domain context.
* **V2 Architectural Prevention:** Context-aware vision extraction. The Question Paper structure (question numbers, sub-parts, max marks) is injected into the VLM prompt during Answer Sheet processing.
* **V2 Implementation Requirement:** Vision prompt templates dynamically compile the active Question Paper manifest before invoking `Qwen2.5-VL 7B`.
* **V2 Test / Acceptance Criterion:** Extraction accuracy tests confirm zero ambiguous question identifiers when Question Paper context is present during VLM inference.

### 2.9 Unsafe Question Mapping & Silent Guesses
* **V1 Problem:** Unclear or unnumbered student answers were silently assigned to the most likely question, leading to incorrect mark allocations.
* **Root Cause:** Soft fallback logic in question mapping.
* **V2 Architectural Prevention:** **Deterministic Safety Mapping Boundary**. If confidence falls below the strict threshold (e.g., 85%), mapping flags the segment as `UNMAPPED_NEEDS_FACULTY_REVIEW`.
* **V2 Implementation Requirement:** AI evaluation is halted for unmapped segments. The system enforces manual mapping during Faculty Review.
* **V2 Test / Acceptance Criterion:** Test case with illegible question headers verifies that the segment is routed to `FACULTY_REVIEW` with an `UNMAPPED` status tag.

### 2.10 Cross-Page Answer Reconstruction Breakage
* **V1 Problem:** Student answers spanning across page boundaries (e.g., Page 2 to Page 3) were fragmented into separate answers or dropped mid-sentence.
* **Root Cause:** Stateless single-page processing without multi-page continuation stitching logic.
* **V2 Architectural Prevention:** **Answer Reconstruction Engine**. Multi-page bounding box analysis and semantic continuation detection stitch contiguous answer segments before evaluation.
* **V2 Implementation Requirement:** The Document Processing domain includes an `AnswerReconstructor` component that merges multi-page fragments based on question ID and page sequence metadata.
* **V2 Test / Acceptance Criterion:** A multi-page answer sheet evaluation test confirms that a 3-page answer to Question 4b is merged into a single coherent text & spatial payload prior to evaluation.

### 2.11 Faculty Assignment Authorization Edge Cases
* **V1 Problem:** Faculty members could access and evaluate answer sheets outside their assigned course or bundle by directly changing URL parameters.
* **Root Cause:** Missing tenant/bundle-level authorization checks in API handlers.
* **V2 Architectural Prevention:** Scoped authorization checks (`BundleAssignmentGuard`) enforcing that `facultyId` matches the assigned evaluation bundle.
* **V2 Implementation Requirement:** Database queries for reviews filter explicitly by `assignedFacultyId` and current active session user ID.
* **V2 Test / Acceptance Criterion:** Accessing `/api/v1/bundles/:id/evaluate` with a non-assigned faculty JWT returns `403 Forbidden`.

### 2.12 Duplicate Faculty Review & Concurrent Overwrites
* **V1 Problem:** Two faculty members could simultaneously open and submit reviews for the same student sheet, causing race conditions and overwritten marks.
* **Root Cause:** Lack of optimistic locking or evaluation session claims.
* **V2 Architectural Prevention:** **Evaluation Claim & Optimistic Locking**. Opening a sheet claims an evaluation lock (`lockedBy`, `lockedAt`, `versionId`).
* **V2 Implementation Requirement:** Submitting a review requires matching the active `versionId`. Simultaneous submissions reject stale versions with `409 Conflict`.
* **V2 Test / Acceptance Criterion:** Concurrent review submission test verifies that the second submission receives a `409 Conflict` error and forces a refresh.

### 2.13 Weak E2E Tests & Hardcoded Fixture IDs
* **V1 Problem:** Tests relied on hardcoded database UUIDs from local seed files, causing test suite failures on fresh databases.
* **Root Cause:** Lack of automated test database dynamic fixture factories.
* **V2 Architectural Prevention:** Dynamic test environment setup using Prisma test factories and transaction cleanups per test runner lifecycle.
* **V2 Implementation Requirement:** E2E test scripts dynamically generate test users, examinations, question papers, and answer sheets during execution.
* **V2 Test / Acceptance Criterion:** E2E test suite runs completely green on a completely blank PostgreSQL database container.

### 2.14 Weak Analytics & Validation
* **V1 Problem:** Analytics dashboards calculated average marks and pass percentages on raw, unverified AI scores, leading to misleading institutional reports.
* **Root Cause:** Aggregate metrics queries failed to filter out pending or overridden evaluation states.
* **V2 Architectural Prevention:** Analytics queries execute strictly against **Final Approved Academic Records** (where `status = APPROVED` and `finalMarks` are committed).
* **V2 Implementation Requirement:** Separate database views / query filters for AI Preliminary Analytics vs. Official Institutional Analytics.
* **V2 Test / Acceptance Criterion:** Unapproved AI evaluation scores are verifiably excluded from official grade distribution reports.

### 2.15 Electron Coupling in Web/Mobile Contexts
* **V1 Problem:** Frontend components called Electron IPC APIs directly (`window.electron.send`), preventing web or tablet deployment.
* **Root Cause:** Mixing desktop wrapper APIs directly into core UI view components.
* **V2 Architectural Prevention:** Client abstraction via Flutter platform channels and clean platform service interfaces (`IPlatformService`).
* **V2 Implementation Requirement:** Flutter app uses standard HTTP REST and web-compatible storage primitives. Desktop-specific features (e.g., local native window controls) are encapsulated behind platform abstractions.
* **V2 Test / Acceptance Criterion:** Flutter app compiles and runs cleanly across Windows Desktop and Android/Web targets without code modification.

### 2.16 AI Prompt Sprawl & Lack of Versioning
* **V1 Problem:** AI prompts were inline string literals scattered across backend service files without version control or prompt history.
* **Root Cause:** Ad-hoc prompt engineering without centralized governance.
* **V2 Architectural Prevention:** **PromptManager & Centralized Prompt Repository**. Prompts are stored as versioned templates (`evaluation_v1.2.txt`, `vision_mapping_v2.0.txt`) with variables.
* **V2 Implementation Requirement:** Prompts are loaded by key and version. Prompt version metadata is recorded in every evaluation audit record.
* **V2 Test / Acceptance Criterion:** Changing a prompt version in configuration updates the evaluation audit log to reflect the exact prompt ID and version used.

### 2.17 Lack of Provenance & Lineage Tracking
* **V1 Problem:** Impossible to trace how a final score of 7/10 was derived (which page, which bounding box, which prompt, which AI model, or which faculty change).
* **Root Cause:** Storing only the final mark without preserving intermediate execution step artifacts.
* **V2 Architectural Prevention:** Complete **Audit & Provenance Chain** linking `FinalMark -> ReviewRecord -> VerificationRecord -> AIEvaluationRecord -> SegmentRecord -> PageRecord -> DocumentRecord`.
* **V2 Implementation Requirement:** Audit database tables capture exact inputs, model outputs, timestamps, operator IDs, and token usage for every pipeline phase.
* **V2 Test / Acceptance Criterion:** API endpoint `/api/v1/audit/provenance/:answerSheetId` returns the complete verifiable lineage tree from raw upload to final mark.

### 2.18 Single Point of Failure in Storage & AI Dependencies
* **V1 Problem:** Network failure or Ollama crash froze the web backend process.
* **Root Cause:** Synchronous inline API calls without circuit breakers or retry policies.
* **V2 Architectural Prevention:** Worker isolation, BullMQ retry mechanisms with exponential backoff, and circuit breaker protection (`OllamaHealthCheck`).
* **V2 Implementation Requirement:** Worker processes catch provider outages, update job status to `RETRYING` or `FAILED_AI_UNAVAILABLE`, and notify administrators via observability metrics.
* **V2 Test / Acceptance Criterion:** Killing the Ollama service mid-job causes BullMQ to retry 3 times with backoff, then transition the job gracefully to `FAILED` without crashing the Express server.

---

## 3. V1 Capability Evaluation & Action Matrix

The following table evaluates all major capabilities demonstrated in V1 and defines their disposition in V2:

| Capability | V1 Status | V2 Disposition | Architectural Justification & Action Required |
| :--- | :--- | :--- | :--- |
| **Handwritten Answer Sheet Upload & PDF Parsing** | Functional | **KEEP** | Core capability. Preserve PDF page extraction pipeline; upgrade to async BullMQ queue processing. |
| **VLM-First Document Understanding (Qwen2.5-VL)** | Functional | **IMPROVE** | Replace raw OCR focus with VLM-first document layout understanding. Inject question paper structure into VLM context. |
| **Cross-Page Answer Continuation & Merging** | Partial | **REDESIGN** | Redesign spatial and semantic answer reconstruction engine to reliably handle answers spanning multiple physical pages. |
| **Dynamic Question Paper Structure Extraction** | Functional | **KEEP** | Retain question paper parsing (questions, sub-questions, max marks). Formalize JSON schema validation via Zod. |
| **Handwritten Key Paper / Model Answer Extraction** | Basic | **IMPROVE** | Enhance extraction quality and structure. Require explicit faculty validation of model answers prior to evaluation. |
| **Model Answer Synthetic Fallback** | Flawed | **REMOVE** | **Strict Removal**. Synthetic model answer generation is prohibited. Missing key papers force state to `NOT_READY`. |
| **Evaluation Scoring against Key Paper (Qwen3)** | Functional | **IMPROVE** | Standardize evaluation prompt templates; enforce strict JSON response parsing and schema validation. |
| **Maximum Mark & Constraint Enforcement** | Partial | **IMPROVE** | Move mark constraint validation into a dedicated backend verification rule engine before saving AI scores. |
| **AI Verification Layer (Qwen2.5-Coder)** | Conceptual | **REDESIGN** | Re-architect as an independent secondary AI worker task verifying score bounds, rubric adherence, and reasoning logic. |
| **Faculty Assignment & Bundle Routing** | Functional | **KEEP** | Preserve bundle routing; enforce strict RBAC authorization and bundle assignment guards. |
| **Faculty Review & Mark Override UI** | Basic | **REDESIGN** | Redesign from scratch in **Flutter Desktop** as the primary **Faculty Evaluation Workspace**, featuring PDF zoom/pan, annotations, and side-by-side evidence views. |
| **Duplicate Review Protection** | Missing | **REDESIGN** | Implement optimistic locking (`versionId`) and evaluation session claims on evaluation sheets. |
| **Audit & Provenance Tracking** | Basic | **REDESIGN** | Build comprehensive relational audit logging capturing raw document regions, model metadata, prompt versions, and faculty edits. |
| **Training Example Curation / Dataset Generation** | Basic | **KEEP** | Retain capability to flag high-confidence faculty-approved evaluations as fine-tuning dataset candidates. |
| **React + Electron Client Architecture** | Functional | **REMOVE** | Replace completely with **Flutter (Dart)** for superior cross-platform desktop/tablet performance and unified client codebase. |
