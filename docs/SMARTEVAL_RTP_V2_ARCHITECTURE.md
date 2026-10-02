# SmartEval RTP_v2 — System Architecture

**Document Status:** Authoritative Architectural Description  
**Version:** 1.0.0  
**Date:** September 12, 2026  
**System:** SmartEval RTP_v2  

---

## Table of Contents
1. [Overview](#1-overview)
2. [Architectural Goals](#2-architectural-goals)
3. [High-Level Diagram](#3-high-level-diagram)
4. [Layered Architecture](#4-layered-architecture)
5. [Communication Patterns](#5-communication-patterns)
6. [Deployment View](#6-deployment-view)
7. [Component Responsibilities](#7-component-responsibilities)
8. [Data Flow Scenarios](#8-data-flow-scenarios)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Scalability & Performance](#10-scalability--performance)
11. [Security Zones](#11-security-zones)
12. [Technology Mapping](#12-technology-mapping)
13. [Appendix: Glossary](#13-appendix-glossary)

---

## 1. Overview

SmartEval RTP_v2 is a modular monolith backend with a Flutter frontend, designed for secure, auditable, and scalable AI-assisted evaluation of handwritten university examinations. The architecture emphasizes:

- **Separation of concerns**: Strict layering prevents leakage of domain concerns into transport or UI.
- **Technology abstraction**: AI providers, storage systems, and notification channels are swappable via interfaces.
- **Statelessness**: Backend services are stateless; state resides in PostgreSQL, Redis, or object storage.
- **Observability**: Structured logging, request tracing, and metrics are embedded throughout.
- **Fault tolerance**: Job queues enable retries, circuit breakers, and graceful degradation.
- **Auditability**: Every state change is logged with full provenance.

---

## 2. Architectural Goals

| Goal | Description |
|------|-------------|
| **Maintainability** | Clear boundaries enable independent evolution of frontend, backend, AI, and storage. |
| **Testability** | Dependency injection and mocking strategies allow unit/service testing without external systems. |
| **Scalability** | Worker nodes can be scaled independently based on queue depth (e.g., more AI evaluators during peak). |
| **Replaceability** | Switching from Ollama to vLLM or local disk to S3 requires no application code changes. |
| **Traceability** | End-to-end provenance links final marks to source documents, models, prompts, and faculty actions. |
| **Security** | Defense-in-depth: authentication, authorization, input validation, encryption, and least privilege. |
| **Performance** | Asynchronous job processing prevents HTTP timeouts; caching and CDN where appropriate. |
| **Compliance** | Designed to meet OWASP ASVS Level 2 and institutional data protection policies. |

---

## 3. High-Level Diagram

```
+------------------+       HTTPS/WSS       +------------------+
|   Flutter Client | <------------------> |   API Gateway    |
| (Desktop/Web/Android) |          (Express) |   + RBAC       |
+------------------+       +----------------+   +----------------+
                                 |                     |
                                 |                     v
                                 |            +------------------+
                                 |            |  Controller Layer|
                                 |            | (DTO validation) |
                                 |            +--------+---------+
                                 |                      |
                                 |                      v
                                 |            +------------------+
                                 |            |  Service Layer   |
                                 |            | (Use Cases)      |
                                 |            +--------+---------+
                                 |                      |
                                 |                      v
                                 |            +------------------+
                                 |            | Repository Layer |
                                 |            | (Prisma Models)  |
                                 |            +--------+---------+
                                 |                      |
                                 |                      v
                                 |            +------------------+
                                 |            |  PostgreSQL      |
                                 |            | (System of Record)|
                                 |            +------------------+
                                 |                      ^
                                 |                      |
                                 |            +------------------+
                                 |            |   Redis/BullMQ   |
                                 |            | (Job Queue)      |
                                 |            +--------+---------+
                                 |                      |
                                 |                      v
                                 |            +------------------+
                                 |            |   AI Workers     |
                                 |            | (Ollama Abstraction)|
                                 |            +--------+---------+
                                 |                      |
                                 |                      v
                                 |            +------------------+
                                 |            | StorageProvider  |
                                 |            | (Local/S3/MinIO) |
                                 |            +------------------+
                                 |
                                 v
                        +------------------+
                        |  Other Services  |
                        | (Email, Storage  |
                        |  Maintenance, etc)|
                        +------------------+
```

*Note: The API Gateway includes authentication, rate limiting, CORS, and request ID propagation.*

---

## 4. Layered Architecture

Each layer has a single responsibility and depends only on the layer directly below it.

### 4.1 Presentation Layer (Flutter Client)
* **Responsibility:** UI rendering, user input, local state, navigation.
* **Dependencies:** None on backend internals; communicates solely via REST/WS over HTTPS.
* **Technology:** Flutter (Dart), Riverpod (state), GoRouter (routing), Dio (HTTP).

### 4.2 API Gateway Layer (Express)
* **Responsibility:** Entry point for all client requests.
* **Concerns:**
  * HTTPS termination (via reverse proxy or Node TLS)
  * JWT authentication & payload validation
  * Role-based access control (RBAC)
  * Request/response logging & correlation ID injection
  * Rate limiting & basic input sanitization
  * CORS policy enforcement
  * OpenAPI/Swagger documentation serving
* **Technology:** Node.js, Express, helmet, express-rate-limit, cors, zod (middleware), pino.

### 4.3 Controller Layer
* **Responsibility:** Thin mapping of HTTP DTOs to service method calls.
* **Rules:**
  * Contains **no** business logic.
  * Validates incoming data via Zod schemas (declared per route).
  * Maps service results to HTTP responses (status codes, envelopes).
  * Does not access repositories, Prisma, or AI directly.
* **Technology:** TypeScript classes or functions; Zod for validation.

### 4.4 Service Layer
* **Responsibility:** Orchestrates domain use cases, manages transactions.
* **Concerns:**
  * Implements business rules (e.g., "faculty may only review assigned bundles").
  * Coordinates multiple repositories (if needed) within a Prisma transaction.
  * Calls domain-specific providers (e.g., `IAIService`, `IStorageProvider`).
  * Throws domain exceptions (e.g., `UnauthorizedException`, `ValidationException`).
  * Does not know about HTTP; returns plain TypeScript objects or throws.
* **Technology:** TypeScript services; Prisma `$transaction`.

### 4.5 Repository Layer
* **Responsibility:** Data access abstraction over Prisma ORM.
* **Concerns:**
  * Provides typed methods for CRUD and custom queries.
  * Encapsulates Prisma model knowledge; services remain ORM-agnostic.
  * May include projection, pagination, and soft-delete filters.
  * Does not contain business logic; only data retrieval/persistence.
* **Technology:** Prisma Client, TypeScript interfaces/repositories.

### 4.6 Provider Abstraction Layer
* **Responsibility:** Encapsulate external systems behind interfaces.
* **Interfaces:**
  * `IAIService` – generateText, countTokens, embed (for Ollama/vLLM/etc.)
  * `IStorageProvider` – upload, download, delete, exists, getUrl
  * `IPromptManager` – load template, render variables, get version
  * `INotificationService` – send email, SMS, in-app
  * `IPlatformService` (Flutter-only) – file picker, printing, native dialogs
* **Technology:** TypeScript interfaces; implementation classes per provider.

### 4.7 Infrastructure Layer
* **Responsibility:** External systems that provide storage, compute, messaging.
* **Components:**
  * **PostgreSQL** – ACID system of record for all business data.
  * **Redis** – Fast key-value store for BullMQ queues, pub/sub, caching.
  * **BullMQ** – Reliable job queues with retry, backoff, priority, concurrency control.
  * **Object Storage** – Local disk (dev), AWS S3, or MinIO (on-prem) for documents/images.
  * **AI Runtime** – Ollama (initial); future vLLM or external approved provider.
  * **Reverse Proxy / Load Balancer** – NGINX/TRAEFIK for TLS termination, routing.
* **Technology:** As listed; accessed via provider abstractions.

---

## 5. Communication Patterns

| Pattern | Description | Where Used |
|---------|-------------|------------|
| **Request/Response (REST)** | Standard HTTP verbs, JSON bodies, status codes | Flutter ↔ API Gateway |
| **Server-Sent Events (SSE)** | One-way server → client stream for real-time updates | Job status notifications (optional) |
| **WebSocket (WSS)** | Full-duplex for low-latency alerts (future) | Faculty chat, system notifications |
| **Async Message Queue** | Producer (API) → BullMQ → Worker (Service) | Document processing, AI inference |
| **Immutable Audit Log** | State‑changing actions logged to `audit_log` with before/after snapshots | All state changes |
| **Dependency Injection** | Manual or TSyringe-style to inject providers | Services, repositories, controllers |
| **Health Checks** | Liveness/readiness endpoints | Orchestration (Docker/K8s) |

---

## 6. Deployment View

### 6.1 Development
* **Local Docker Compose:**
  * `postgres:15`
  * `redis:7-alpine`
  * `ollama:latest` (optional; can use host-installed)
  * `minio/minio:latest` (for S3-like storage)
  * Backend: `npm run dev` (ts-node-dev, watches TypeScript)
  * Frontend: `flutter run -d chrome` (web) or `flutter run -d windows`
* **Environment:** `.env.dev` with local credentials, debug logging enabled.

### 6.2 Staging / Production
* **Container Images:**
  * Multi-stage Docker builds for backend (`node:20-alpine`) and workers (same image, different command).
  * Base image includes Prisma, dependencies; non-root user.
* **Orchestration:**
  * Initial: Docker Compose on a single VM or managed VPS.
  * Future: Kubernetes (if >10 worker nodes, multi-zone HA, or auto-scaling required).
* **Service Definitions:**
  * `api`: Express server (port 3000)
  * `worker`: BullMQ worker processes (same image, `npm run worker:vision`, etc.)
  * `redis`: Redis with persistence (AOF)
  * *`postgres`*: PostgreSQL with pgBackRest or similar for backups
  * *`storage`*: MinIO (if on-prem) or direct cloud S3 (no container)
* **Networking:**
  * Internal Docker bridge network; exposed ports only for API (HTTPS via ingress).
  * TLS termination at ingress (NGINX/TRAEFIK or cloud load balancer).
* **Configuration:**
  * Environment-specific `.env` files (not committed) or secret manager (Vault/AWS Secrets Manager).
  * Feature flags via config or launch arguments.
* **Scaling:**
  * Horizontal scaling of `worker` containers based on queue depth (monitored via Redis `llen` or BullMQ metrics).
  * API replicas behind round-robin LB for concurrent request handling.
* **CI/CD:**
  * GitHub Actions: lint → test → build Docker images → push to registry → deploy to staging → smoke test → promote to prod on approval.
  * Database migrations run as part of container startup (`prisma migrate deploy`) with pre-check backup.
* **Rollback:**
  * Immutable image tags; redeploy previous tag on failure.
  * Database migration rollback via `prisma migrate reset` (dev) or custom script (prod) with backup.

---

## 7. Component Responsibilities

| Component | Responsibility | Key Interfaces |
|-----------|----------------|----------------|
| **Flutter Client** | UI/UX, local state, secure storage, API calls | `Dio`, `flutter_secure_storage`, `GoRouter` |
| **API Gateway** | Request intake, auth, validation, logging, rate limiting | Express middleware stack |
| **Auth Service** | JWT issuance, validation, password hashing, role checks | `bcrypt`, `jsonwebtoken` |
| **RBAC Middleware** | Enforces role and resource ownership | Custom Express middleware |
| **Controllers** | Route mapping, DTO validation, error handling | Zod schemas, service injection |
| **Examination Service** | Create/update exams, lifecycle, status checks | `IExaminationRepository` |
| **QuestionPaper Service** | Upload, extract structure, validate, store | `IQuestionPaperRepository`, `IStorageProvider`, `IAIService` (vision) |
| **ModelAnswer Service** | Upload, extract, require faculty validation, version | `IModelAnswerRepository`, `IStorageProvider`, `IAIService` |
| **AnswerSheet Service** | Upload, initiate pipeline, track status | `IAnswerSheetRepository`, `IStorageProvider`, `IBullMQProducer` |
| **DocumentProcessing Job** | PDF → images, store pages, create `document_pages` records | `pdf-poppler`/`mupdf`, `IStorageProvider` |
| **Vision Job** | Per-page VLM inference (layout, regions, text) | `IAIService` (Ollama/Qwen2.5-VL), `IVisionRepository` |
| **QuestionMapping Service** | Spatial+semiotic association to questions, confidence scoring | `IQuestionMappingRepository`, `IVisionRepository`, `IQuestionPaperRepository` |
| **AnswerReconstruction Job** | Stitch multi-page continuations, produce `answer_segments` | `IAnswerSegmentRepository`, `IQuestionMappingRepository` |
| **Evaluation Job** | Score via Qwen3, produce suggested marks & feedback | `IAIService` (Ollama/Qwen3), `IEvaluationRepository`, `IModelAnswerRepository` |
| **Verification Job** | Check AI output via Qwen2.5-Coder, enforce constraints | `IAIService` (Ollama/Qwen2.5-Coder), `IVerificationRepository` |
| **FacultyReview Service** | Retrieve review data, store faculty marks/remarks, optimistic lock | `IFacultyReviewRepository`, `IAnswerSegmentRepository` |
| **Finalize Service** | Determine final mark (AI vs faculty override), persist | `IFinalMarkRepository`, `IFacultyReviewRepository` |
| **Audit Service** | Write immutable audit logs, provenance queries | `IAuditRepository` |
| **Analytics Service** | Aggregated queries on approved data (read replica if needed) | Prisma raw queries, views |
| **StorageProvider** | Abstract upload/download/delete/url for objects | Local disk, AWS S3 SDK, MinIO client |
| **AIProvider (Ollama)** | Wrapper around Ollama HTTP API (`/api/generate`) | `axios`/`node-fetch` with timeout & retry |
| **PromptManager** | Load versioned templates from DB, render with variables | SQL queries, template engine (handlebars/lodash) |
| **NotificationService** | Send email (via SMTP/SendGrid), optional SMS/in-app | `nodemailer`, `twilio` (future) |
| **HealthChecker** | Liveness (process up), readiness (DB, Redis, storage reachable) | Custom endpoints |
| **MetricsCollector** | Expose Prometheus counters/histograms | `prom-client` |

---

## 8. Data Flow Scenarios

### 8.1 Answer Sheet Upload & Processing Initiation
1. Flutter client POSTs `/api/v1/answer-sheets` with multipart/form-data (file + metadata).
2. API Gateway validates JWT, role (FACULTY/ADMIN), file type/size via Zod.
3. Controller extracts file, calls `AnswerSheetService.upload`.
4. Service:
   * Stores file via `IStorageProvider.upload`, returns `storageKey`.
   * Creates `answer_sheets` row (`status: UPLOADED`).
   * Publishes job to BullMQ `document-processing` queue with payload `{answerSheetId, storageKey}`.
5. Controller returns `202 Accepted` with `{jobId, status: UPLOADED}`.
6. Flutter polls `/api/v1/jobs/:jobId` or listens to SSE for updates.

### 8.2 Vision Processing (per page)
1. Worker pulls job from `document-processing` queue.
2. Job payload: `{answerSheetId, storageKey}`.
3. Service:
   * Loads answer sheet record, retrieves storage object (PDF bytes).
   * Converts PDF to images (one per page) via `pdf-poppler`; stores each image via `IStorageProvider`.
   * For each page image, enqueues job to `vision` queue: `{answerSheetId, pageNumber, imageStorageKey}`.
4. Updates answer sheet status to `PROCESSING_VISION`.
5. Worker acknowledges job completion.

### 8.3 Question Mapping
1. Worker pulls job from `vision` queue.
2. Service:
   * Retrieves page image and corresponding vision result (if pre-cached) OR runs VLM prompt to get regions/text.
   * Loads related `question_papers` record to get extracted question structure (list of question numbers, sub-parts).
   * For each detected answer region:
        * Heuristic OCR (Tesseract fallback) to detect nearby numbers.
        * VLM prompt: *"Given the question list {Q1, Q2...} and this image region, which question number does it belong to? Return {question_number: string, confidence: number}."*
   * If confidence ≥ threshold (0.85), store `question_mappings` with status `MAPPED`.
   * Else store with status `UNMAPPED_NEEDS_FACULTY_REVIEW`; halt further AI for that segment.
3. Persists mapping records; updates answer sheet status accordingly.

### 8.4 Answer Reconstruction (Multi-page)
1. Worker pulls job from `answer-reconstruction` queue (triggered after mapping).
2. Service groups `answer_segments` by `question_number` and sorts by `page_number`.
3. Uses spatial overlap and semantic similarity (e.g., sentence continuation) to decide if segments belong to same logical answer.
4. Creates merged `answer_segments` records with `page_sequence` array; marks old segments as `SUPERSEDED`.
5. Updates answer sheet status to `READY_FOR_EVALUATION`.

### 8.5 AI Evaluation
1. Worker pulls job from `ai-evaluation` queue.
2. Service:
   * Loads `answer_segment`, its linked `question_mapping`, `question_papers` (for max marks, question text), and `model_answers` (validated).
   * Builds prompt from versioned template (`evaluation_v2.0.txt`) injecting variables.
   * Calls `IAIService.generateText` (Ollama/Qwen3 8B).
   * Parses response via Zod; validates `suggested_marks` ∈ [0, max_marks].
   * Persists to `ai_evaluations`; links to segment.
3. On success, enqueues job to `ai-verification` queue.
4. On failure (AI error, validation), marks job `FAILED` and answer sheet status `FAILED_AI_EVALUATION`.

### 8.6 AI Verification
1. Worker pulls job from `ai-verification` queue.
2. Service:
   * Loads AI evaluation, model answer, student answer.
   * Runs verification prompt (`verification_v2.0.txt`) via Qwen2.5-Coder.
   * Parses response; checks `passed` boolean.
   * If `passed == true`, persists to `ai_verifications` and marks segment `VERIFIED`.
   * If `passed == false`, persists failure and marks segment `NEEDS_FACULTY_REVIEW` (override mapping status).
3. On verification pass, enqueues notification for faculty review (or updates status to `READY_FOR_REVIEW`).
4. On failure, answer sheet status becomes `FAILED_VERIFICATION`.

### 8.7 Faculty Review & Approval
1. Flutter client fetches faculty dashboard; sees answer sheets with status `READY_FOR_REVIEW` or `NEEDS_FACULTY_REVIEW`.
2. On selecting a sheet:
   * Loads answer segment image + text, question text, max marks, model answer, AI evaluation, verification result, any prior faculty review.
   * Displays side-by-side or togglable view.
3. Faculty enters:
   * `reviewed_marks` (optional override)
   * `remarks` (free text)
   * Clicks **Approve** or **Request Revision**.
4. On **Approve**:
   * Service checks optimistic `version_id` on segment; if stale → `409 Conflict`.
   * If faculty supplied `reviewed_marks`, use that; else fall back to `ai_evaluations.suggested_marks`.
   * Persists `faculty_reviews` record (with `version_id`).
   * Persists `final_marks` record (AI suggested, faculty, final).
   * Updates answer sheet status to `APPROVED`.
   * Writes audit log entries for review and finalization.
   * Notifies via `INotificationService` (email) if configured.
5. On **Request Revision**:
   * Similar to approve but does not finalize; may send notification to student (out of scope) or just mark as `NEEDS_REVISION`.

### 8.8 Audit & Provenance Query
1. GET `/api/v1/audit/provenance/:answerSheetId`
2. Service:
   * Loads answer sheet record.
   * Performs recursive joins:
        * answer sheet → document_pages → vision_results
        * → question_mappings → answer_segments
        * → ai_evaluations → ai_verifications
        * → faculty_reviews → final_marks
   * For each step, fetches associated storage keys, model versions, prompt versions, timestamps, operator IDs.
   * Returns hierarchical JSON graph.
3. Flutter client renders timeline or graph for auditor.

---

## 9. Cross-Cutting Concerns

| Concern | Implementation |
|---------|----------------|
| **Logging** | Structured JSON via `pino` (backend) and `logger` (flutter). Includes `timestamp`, `level`, `msg`, `service`, `traceId`, `spanId`, `userId` (if authenticated). |
| **Tracing** | `X-Request-ID` header generated at API Gateway; passed to all downstream services; appears in logs. |
| **Metrics** | Prometheus endpoint (`/metrics`) exposing counters: `http_requests_total`, `job_processing_seconds`, `ai_inference_latency`, `storage_operation_latency`, `failed_jobs_total`, `gauges`: `active_sessions`, `queue_lengths`. |
| **Error Handling** | Centralized error middleware converts known domain exceptions to HTTP statuses (400, 401, 403, 404, 409, 500). Unexpected errors → 500 with error ID (UUID) for support lookup. |
| **Validation** | All incoming data validated via Zod at controller edge; outgoing responses optionally validated via Zod in testing/strict mode. |
| **Security** | `helmet`, `express-rate-limit`, `cors`, `bcrypt` (password), `jsonwebtoken` (RS256 prod, HS256 dev), input sanitization, SQL injection prevented by Prisma param queries. |
| **Configuration** | `.env` files (dev) or secret manager (prod); strongly typed via `zod` or `class-validator` at startup. |
| **Feature Flags** | Simple boolean flags in config; launch arguments or environment variables. |
| **Internationalization** | Not in MVP; UI strings in Dart `intl` package ready for future localisation. |
| **Accessibility** | Flutter adheres to accessibility guidelines (contrast, scalable fonts, semantics); TBD for WCAG 2.1 AA. |
| **Error Reporting** | Flutter errors caught and logged; optional Firebase Crashlytics integration in prod. |
| **Data Retention** | Jobs older than X days purged via `storage-maintenance` queue; raw uploads purged per policy (configurable). |
| **Backup Strategy** | PostgreSQL physical backups (WAL-E or pgBackRest); object storage versioning (S3 buckets with lifecycle); backups encrypted and stored offsite. |

---

## 10. Scalability & Performance

| Axis | Strategy |
|------|----------|
| **Vertical Scaling (API)** | Increase Node.js instance CPU/RAM; use clustering (`pm2`) if needed. |
| **Horizontal Scaling (Workers)** | Add more BullMQ worker containers; each worker binds to specific queues (vision, evaluation, etc.). |
| **Database Scaling** | PostgreSQL read replica for analytics queries; sharding not anticipated (single institution). |
| **Caching** | Redis cache for frequently accessed lookups (e.g., active faculties, recent examinations); TTL-based. |
| **CDN** | Static assets served via CDN (Flutter web build); object storage may use CloudFront (S3) or CDN (MinIO). |
| **Load Testing** | Simulate peak load: 100 concurrent answer sheet uploads; monitor job queue latency, API response times, worker utilization. |
| **Resource Isolation** | AI workers limited to specific GPU/CPU via Docker resource constraints; prevents noisy neighbor. |
| **Auto-scaling Triggers** | Queue depth (`bullmq:waiting`) > threshold → scale out workers; API request latency > threshold → scale out API replicas. |

---

## 11. Security Zones

| Zone | Description | Trust Level |
|------|-------------|-------------|
| **Internet** | External users (faculty on untrusted networks) | Low |
| **DMZ** | TLS-terminating ingress (NGINX/TRAEFIK), WAF | Medium |
| **Backend Net** | Docker bridge network for API, Redis, Postgres, workers | High (internal only) |
| **Storage Net** | Separate VPC or subnet for MinIO/S3 (if on-prem) | High |
| **Admin Net** | Restricted SSH/jump host for maintenance, backups | High (ops only) |
| **AI Net** | Isolated subnet for Ollama/vLLM hosts (if GPU servers) | Medium (if untrusted model sources) |

Firewall rules restrict traffic between zones (e.g., Internet → only TCP 443 to DMZ; DMZ → TCP 3000 to API only).

---

## 12. Technology Mapping

See `SMARTEVAL_RTP_V2_TECHNOLOGY_STACK.md` for detailed justification and version numbers.

---

## 13. Appendix: Glossary

| Term | Definition |
|------|------------|
| **ACID** | Atomicity, Consistency, Isolation, Durability – database transaction properties. |
| **BullMQ** | Node.js library for reliable Redis-backed job queues. |
| **DTO** | Data Transfer Object – plain object used to serialize data across layers/service boundaries. |
| **E2E** | End-to-End – test validating a complete user workflow. |
| **GB** | Gigabyte. |
| **JWT** | JSON Web Token – stateless authentication token. |
| **ORM** | Object-Relational Mapping – Prisma in this case. |
| **RBAC** | Role-Based Access Control – permissions assigned to roles, roles assigned to users. |
| **SSE** | Server-Sent Events – server pushes updates to client over HTTP. |
| **TLS** | Transport Layer Security – encrypts HTTP (HTTPS). |
| **ULID** | Universally Unique Lexicographically Sortable Identifier – used for job IDs optionally. |
| **VM** | Virtual Machine. |
| **WAF** | Web Application Firewall. |
| **WAL** | Write-Ahead Log – PostgreSQL backup method. |

--- 

*End of Architecture Document*