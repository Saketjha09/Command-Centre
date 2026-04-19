# ARCHITECTURE.md: Freelance Command Center (V2 Enterprise)

## 1. System Overview
A modular monolith Go application and React SPA designed to replace ClickUp and WhatsApp. Manages 10-100+ freelancers, internal team availability, automated payroll tallies, and task workflows via WebSockets and asynchronous queues.

## 2. Tech Stack
* **Backend:** Go 1.22+ (`net/http` multiplexer).
* **Frontend:** React 18, Vite, Tailwind CSS (Design via Stitch MCP).
* **Database:** PostgreSQL (using `pgxpool`).
* **Real-Time:** `gorilla/websocket`.
* **Background Jobs:** Go channels/goroutines (Phase 1 Redis alternative).

## 3. Database Schema & Data Integrity
Applying data mining principles, the database is split into strict schemas to support future analytics and maintain sub-50ms query times. All timestamps are `UTC`. All IDs are `UUIDv4`.

* **Schemas:** `auth`, `ops`, `finance`, `audit`.
* **Enums:** Use Postgres ENUMs for roles (`superadmin`, `admin`, `freelancer`) and statuses (`assigned`, `done`, `busy_task`, etc.).
* **Transactions & Locks:** `ops.tasks` assignments MUST use `SELECT ... FOR UPDATE` to lock rows and prevent double-booking.
* **Constraints:** `ops.availability` MUST enforce `UNIQUE(user_id, date, slot)`.
* **Audit Logs:** Every change to a task or availability slot must write an immutable row to `audit.logs` containing `event_type`, `old_value`, `new_value`, and `actor_id`.

## 4. API & Real-Time Specifications
* **REST API:** Handles CRUD operations. JWTs are strictly `httpOnly`, `Secure`, `SameSite=Strict`.
* **WebSockets:** Used ONLY for broadcasting state changes (e.g., `TASK_MOVED`, `AVAILABILITY_UPDATED`). 
* **Resilience:** Sockets must implement a 20-second ping/pong heartbeat. Frontend must implement exponential backoff reconnection and refetch missed data on reconnect.

## 5. Automation Flows & External Integrations
* **Async Queues:** External API calls (Slack, Google Sheets, OpenAI) MUST NOT block the main HTTP thread. They must be pushed to a background worker queue.
* **Idempotency:** Slack bot webhooks must verify `bot_id` to prevent infinite reply loops. Failed API calls must flag the database record (e.g., `notification_failed: true`) rather than crashing the system.
* **Immutable Payroll:** Month-end tallies are calculated, approved via Slack interactive buttons, and then snapshotted immutably before being pushed to Google Sheets.