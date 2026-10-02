# SmartEval RTP_v2 — Technology Stack

**Document Status:** Reference  
**Version:** 1.0.0  
**Date:** September 12, 2026  

This document summarizes the technology choices made for SmartEval RTP_v2, with justification and status.

| Layer | Technology | Status | Reason / Justification |
|-------|------------|--------|------------------------|
| **Client** | Flutter | Approved | Cross‑platform, performant desktop/tablet/web, single language (Dart). |
| **Language** | Dart | Approved | Flutter native, sound null‑saturation, strong tooling. |
| **State Management** | Riverpod | Proposed | Scalable, testable, compile‑safe providers, good for complex UI state. |
| **Navigation** | GoRouter | Proposed | Declarative routing, URL‑based navigation, route guards, deep linking. |
| **HTTP Client** | Dio | Proposed | Feature‑rich (interceptors, logging, timeout, cancellation), supports Flutter secure storage integration. |
| **Secure Storage** | flutter_secure_storage | Proposed | Encrypted storage for refresh tokens (where platform supports); access tokens kept in memory. |
| **Data Modeling** | freezed + json_serializable | Proposed | Immutable data classes, seamless JSON serialization/deserialization, works with Riverpod. |
| **Charts** | fl_chart | Proposed | Rich, customizable charts (line, bar, pie, scatter) suitable for analytics dashboards. |
| **PDF Rendering** | **TBD** (pdfrx / flutter_pdfview / syncfusion_flutter_pdfviewer / pdfx) | OPEN DECISION | Evaluate for zoom/pan/annotation performance, annotation layer, Windows/Android support, licensing. (See OPD‑001) |
| **Backend Runtime** | Node.js | Approved | Mature ecosystem, LTS, TypeScript first‑class support, vast library support. |
| **API Framework** | Express | Approved | Minimal, unopinionated, extensive middleware, easy to extend. |
| **Backend Language** | TypeScript | Approved | Static typing, refactor safety, IDE support, aligns with frontend language for shared types (if needed). |
| **Request Validation** | Zod | Proposed | Schema validation with static inference, parsing, excellent error messages, works with Express middleware. |
| **Response Validation** | Zod | Proposed | Contract enforcement, ensures API responses conform to schema (used in testing). |
| **Database** | PostgreSQL | Approved | ACID‑compliant, robust, widely supported, rich extensions, strong community. |
| **ORM** | Prisma | Approved | Type‑safe, auto‑generated client, powerful migration system, developer ergonomics. |
| **Job Queue** | BullMQ | Approved | Reliable, Redis‑backed, supports retries, backoff, priority, concurrency control, delayed jobs. |
| **Queue Infrastructure** | Redis | Approved | Fast in‑memory store, pub/sub, atomic operations, persistence via AOF. |
| **AI Runtime (Initial)** | Ollama | Initial | Local inference, no API cost, easy setup for MVP, supports GPU acceleration. |
| **Vision Model** | Qwen2.5‑VL 7B | Initial | Strong document/layout understanding, multilingual, capable of region detection and OCR‑free extraction. |
| **Evaluation Model** | Qwen3 8B | Initial | Reasoning, rubric adherence, scoring, strong instruction following. |
| **Verification Model** | Qwen2.5‑Coder 14B | Initial | Code/logic validation, constraint checking, capable of verifying evaluation output. |
| **AI Abstraction** | IAIService (interface) | Approved | Allows swapping providers (Ollama, vLLM, external) without changing business logic. |
| **Storage Abstraction** | IStorageProvider (interface) | Approved | Enables swap between local disk, AWS S3, and MinIO (on‑prem S3‑compatible) without code or DB changes. |
| **Providers Implemented** | LocalStorageProvider, S3StorageProvider, MinIOStorageProvider | Approved | Cover dev, cloud, and on‑prem scenarios. |
| **Prompt Management** | Centralized versioned templates (stored in `prompt_versions` table) | Proposed | Auditability, reproducibility, easy promotion via migrations, version tracking. |
| **Logging** | pino (backend) / logger (flutter) | Proposed | Structured, JSON logs, high performance, supports custom metadata (trace/span IDs). |
| **Observability** | Health/Readiness endpoints, request IDs, Prometheus metrics endpoint (`/metrics`) | Proposed | Liveness, readiness, tracing, latency/job metrics, alert‑ready. |
| **Testing Framework** | Jest (backend) / flutter_test (flutter) | Required | Unit/widget testing, mocking, code coverage. |
| **E2E Testing** | Supertest (backend) + integration_test (flutter) | Required | Critical path validation: login → upload → review → approval → persistence → audit. |
| **CI/CD** | GitHub Actions (TBD) | Planned | Automated lint, test, build, push, deploy to staging/prod. |
| **Containerization** | Docker | Planned | Consistent environments, multi‑stage builds, non‑root users. |
| **Desktop Installer** | Inno Setup / MSIX (Windows) | Target | Standard Windows deployment, supports per‑machine/per‑user, upgrade/uninstall. |
| **Environment Segregation** | Separate `.env` files (dev/staging/prod) or secret manager | Planned | Keeps secrets out of VCS, enables different configs per environment. |
| **Secrets Management** | HashiCorp Vault or AWS Secrets Manager (prod) | Planned | Secure storage for DB credentials, JWT keys, provider credentials, cloud storage keys. |