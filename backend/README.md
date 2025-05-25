# Realtime Agent Interaction Backend (Phase 3)

## Overview

This backend service provides a headless API for powering sophisticated, realtime agent interactions. Built with Python and FastAPI, it offers a robust and extensible foundation for LLM-driven conversational agents.

**Phase 3 Enhancements Focus On:**
-   **Comprehensive Security:** Transition to Supabase Auth (JWT-based) for user authentication, Role-Based Access Control (RBAC) for tools, secure credential management for tools, basic input/output guardrails, and full audit trails.
-   **Scalability & Performance:** Full asynchronous processing review, caching strategies, containerization with Docker, and conceptual guides for Kubernetes deployment and load testing.
-   **Advanced Agent Behaviors:** LLM-driven error recovery and basic structured planning capabilities.
-   **Robust A2A Communication:** Enhanced A2A client with retries and strategic documentation for dynamic discovery and server capabilities.
-   **Full Observability:** Distributed tracing with OpenTelemetry, alongside existing structured logging and basic metrics.
-   **Governance & HA/DR:** Formalized strategies for tool/A2A governance and high availability/disaster recovery.

**Core Features Retained and Enhanced:**
-   Dynamic Tool Usage (MCP Tools) with a central registry.
-   Agent-to-Agent (A2A) communication framework.
-   Multi-step orchestration enabling complex interactions.
-   Supabase PostgreSQL for persistent data storage (conversation history, audit logs).

The primary interface remains a Server-Sent Events (SSE) endpoint compliant with the Agent-Guided User Interface (AG-UI) protocol.

## Setup and Running the Service

### Prerequisites
-   Python 3.9+
-   A Supabase account with a PostgreSQL database and Supabase Auth configured for your users.
-   A deployed Supabase Edge Function (`auth-gateway`) for JWT validation and user detail forwarding (see [Authentication](#authentication)).
-   Docker and Docker Compose (for local development using containers).

### 1. Clone the Repository (if applicable)
```bash
# If this backend is part of a larger monorepo, navigate to the `backend` directory.
# git clone <repository_url>
# cd <repository_name>/backend
```

### 2. Install Dependencies
Create a virtual environment (recommended) and install the required Python packages:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables
The service requires several environment variables. Create a `.env` file in the `backend/` directory by copying `backend/.env.example`.

**Key Environment Variables (see `backend/.env.example` for a full list and details):**
-   `SUPABASE_DATABASE_URL`: Connection string for your Supabase PostgreSQL database.
-   `OPENAI_API_KEY`: Your API key for OpenAI services.
-   `LOG_LEVEL` (optional): Logging level (e.g., `DEBUG`, `INFO`). Defaults to `INFO`.
-   `OTEL_EXPORTER_OTLP_ENDPOINT` (optional): URL for the OpenTelemetry collector.
-   `OTEL_SERVICE_NAME` (optional): Service name for OpenTelemetry traces.
-   Tool-specific credentials (e.g., `MOCK_WEATHER_TOOL_API_KEY`).

### 4. Initialize the Database Schema
The application automatically creates necessary tables (e.g., `conversation_turns`, `audit_events`) on startup via `init_db()` in `main.py`.
Manual initialization: `python database.py`.

### 5. Run the Service (Locally with Docker Compose - Recommended for Development)
The `docker-compose.yml` file in the repository root is configured to build and run the backend service and the mock A2A server.
Ensure your `backend/.env.local` file is correctly populated (copy from `backend/.env.local.example`).
```bash
docker-compose up --build
```
The backend will be available at `http://localhost:8000` (this is the URL your `auth-gateway` Edge Function should target). The mock A2A server will be at `http://localhost:8001`.

### 6. Run the Service (Locally with Uvicorn - Alternative)
Ensure all environment variables are set in your shell or a `.env` file.
```bash
# From the backend/ directory
uvicorn main:app --reload --port 8000
```
Client requests should always be routed through the Supabase Edge Function.

## Authentication
This backend relies on an upstream Supabase Edge Function (`auth-gateway`) for user authentication:
1.  Clients authenticate with Supabase Auth to get a JWT.
2.  Clients send this JWT in the `Authorization: Bearer <token>` header to the Edge Function.
3.  The Edge Function validates the JWT and, if valid, forwards the request to this FastAPI backend, adding headers like `X-Supabase-User-ID`, `X-Supabase-User-Email`, and `X-Supabase-User-Role`.
4.  This backend's `/ag-ui/events` endpoint is protected by the `get_supabase_user` dependency, which extracts user details from these trusted headers.

Refer to `backend/docs/supabase_edge_functions.md` for details on setting up the `auth-gateway` Edge Function.

## API Endpoints

### AG-UI SSE Endpoint: `/ag-ui/events` (via Edge Function)
- **Method:** `GET`
- **URL:** (Accessed via the Supabase Edge Function, e.g., `https://<project_ref>.supabase.co/functions/v1/auth-gateway/ag-ui/events`)
- **Query Parameters (Optional):**
    - `user_message` (str): User's message. Defaults to "What is the weather like in London?".
- **Headers (sent to Edge Function by client):**
    - `Authorization: Bearer <SUPABASE_JWT>` (str, **required**).
- **Headers (expected by FastAPI from Edge Function):**
    - `X-Supabase-User-ID` (str, **required**).
    - `X-Supabase-User-Email` (str, optional).
    - `X-Supabase-User-Role` (str, optional).
- **Headers (session management, client to AG-UI):**
    - `X-Session-ID` (str, optional): Echoed back by the backend. `X-Supabase-User-ID` is the primary session key.

#### Streamed AG-UI Events
Events are streamed in `text/event-stream` format. Each event is a JSON object prefixed with `data: `.
**Event Structure (`AGUIMessage`):**
```json
{ "event_type": "EVENT_TYPE_NAME", "data": {}, "message": "Optional message" }
```
**Key Event Types (see `backend/models/ag_ui_messages.py`):**
-   `AGENT_RESPONSE`, `TOOL_CALL_START`, `TOOL_OUTPUT`, `A2A_DELEGATION_START`, `A2A_DELEGATION_RESULT`, `GUARDRAIL_VIOLATION`, `ERROR`.

## Core Features & Functionality

### Orchestration Service (`backend/services/orchestration_service.py`)
-   **Multi-Step Processing:** Manages complex interactions involving multiple tool calls or A2A delegations within a single user turn (`MAX_ITERATIONS_PER_TURN`).
-   **Dynamic Capability Prompting:** Constructs detailed system prompts for the LLM, including descriptions of available MCP tools and A2A agents, and how to use them (requesting `action` or a `plan`).
-   **LLM-Driven Error Recovery:** If a tool/A2A call fails, the error context is provided back to the LLM, which can then decide on a recovery action (e.g., retry, different tool, inform user).
-   **Basic Planning Support:** The LLM can return a `plan` (a list of sequential actions). The orchestrator executes these steps, feeding results back to the LLM.
-   **Guardrails:** Basic keyword checks (`DISALLOWED_KEYWORDS`) on LLM responses to prevent undesirable outputs. If a violation occurs, a `GUARDRAIL_VIOLATION` event is streamed.

### MCP Tool Management (`backend/services/mcp_tool_service.py`)
-   **Dynamic Tool System:** Tools are defined via `MCPToolDefinition` (`backend/models/tool_definition.py`), including name, description, JSON schemas for I/O, handler type (`python_function` or `http_endpoint`), `required_credentials`, and `required_role`.
-   **Tool Registry:** `MCPToolRegistry` manages tool definitions, with LRU caching for `get_tool`.
-   **Secure Credential Injection:** `MCPToolService` loads credentials specified in a tool's `required_credentials` list from environment variables and injects them into the tool's inputs.
-   **Role-Based Access Control (RBAC):** `MCPToolService` checks if the `current_user.role` (from `SupabaseUser`) meets the `required_role` specified in the tool's definition. Access is denied if requirements are not met (admins typically bypass specific role checks unless the tool is admin-only).
-   **Available Tools (Examples):** `get_weather_tool` (requires `MOCK_WEATHER_TOOL_API_KEY`), `calculator_tool`, `add_note_tool`, `get_note_tool`, `admin_debug_tool` (requires "admin" role).
-   **Adding New Tools:** Documented in `backend/docs/governance_strategy.md`.

### Agent-to-Agent (A2A) Communication (`backend/services/a2a_communication_service.py`)
-   **A2A Client:** Can delegate tasks to other agents using `A2ATaskRequest`/`Response` models.
-   **Resilience:** Implements retries with `tenacity` for A2A calls.
-   **Mock Discovery:** Currently uses `MOCK_AGENT_CARDS`. Dynamic discovery and A2A server capabilities are conceptual (see `backend/docs/a2a_strategy.md`).
-   **Mock A2A Server:** Provided in `mock_a2a_server/` for testing.

### Security
-   **Authentication:** Handled by an upstream Supabase Edge Function (`auth-gateway`) validating Supabase JWTs. The backend trusts headers like `X-Supabase-User-ID`.
-   **Authorization (RBAC):** MCP tools can define a `required_role`.
-   **Credential Management:** Tool-specific credentials (e.g., API keys for external services used by tools) are loaded from environment variables by `MCPToolService`.
-   **Guardrails:** Basic keyword filtering on LLM outputs.
-   **mTLS Strategy:** Conceptualized for future inter-service communication (see `backend/docs/mtls_strategy.md`).

### Observability
-   **Structured JSON Logging:** Uses `python-json-logger`. Configured in `backend/logging_config.py` and applied throughout. `LOG_LEVEL` is configurable.
-   **Basic Metrics:** `BasicMetricsMiddleware` (`backend/middleware.py`) collects in-memory request/error rates and latencies. Viewable at `/metrics-debug`.
-   **Distributed Tracing:** OpenTelemetry SDK integrated.
    -   FastAPI, HTTPX clients (for MCP/A2A) are auto-instrumented.
    -   LLM calls are manually instrumented with spans.
    -   Traces exported via OTLP (endpoint configurable by `OTEL_EXPORTER_OTLP_ENDPOINT`).
-   **Monitoring Strategy:** Documented in `backend/docs/monitoring_dashboard_alerting_strategy.md`.

### Audit Trails
-   **`AuditEvent` Model (`backend/models/audit_log.py`):** Logs key events (user auth, SSE requests, tool calls, A2A delegations, errors, guardrail violations) to the database.
-   **`AuditLoggingService` (`backend/services/audit_logging_service.py`):** Utility to create audit log entries.
-   Integrated into `security.py`, `ag_ui_router.py`, `orchestration_service.py`, and `mcp_tool_service.py`.

## Deployment

### Docker & Docker Compose
-   The backend and mock A2A server can be built and run using Docker.
-   `backend/Dockerfile` and `mock_a2a_server/Dockerfile` are provided.
-   A `docker-compose.yml` in the root orchestrates local development, using `backend/.env.local` for backend configuration.
-   Instructions: `docker-compose up --build`.

### Kubernetes (Conceptual)
-   A conceptual guide for K8s deployment is available in `backend/docs/kubernetes_deployment_guide.md`.
-   It includes examples for `Deployment`, `Service`, `ConfigMap`, `Secret`, HPA, and discusses liveness/readiness probes (implemented as `/health` and `/readiness` endpoints in `main.py`).

## Project Structure
(Refer to `backend/docs/phase3_summary.md` for a detailed, up-to-date structure, or the file tree itself.)
Key Phase 3 additions include:
- `backend/telemetry_config.py`
- `backend/middleware.py` (for metrics)
- `backend/models/audit_log.py`
- `backend/services/audit_logging_service.py`
- `backend/tools/admin_debug_tool.py`
- New/updated tests in `backend/tests/`
- New documentation in `backend/docs/` (K8s, Load Testing, HA/DR, Governance, A2A Strategy, mTLS Strategy)

## Further Documentation
Comprehensive strategies and conceptual designs are available in the `backend/docs/` directory:
-   `phase1_summary.md` & `phase2_summary.md` (Historical context)
-   `phase3_summary.md` (Overview of these latest enhancements)
-   `supabase_edge_functions.md` (Auth gateway details)
-   `a2a_strategy.md` (A2A client discovery and server concepts)
-   `governance_strategy.md` (Tool and A2A interaction governance)
-   `ha_dr_strategy.md` (High Availability and Disaster Recovery)
-   `kubernetes_deployment_guide.md` (K8s deployment concepts)
-   `load_testing_strategy.md` (Performance testing strategy)
-   `mtls_strategy.md` (mTLS for future inter-service security)

---
*This README provides a starting point. Further details on specific tool implementations, advanced configuration, or deployment strategies should be added as the project evolves.*
```
