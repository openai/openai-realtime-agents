# Backend Service for Realtime Agent Interactions (Supabase Edition - Phase 2)

## Overview

This backend service provides a headless API for powering realtime agent interactions. It is built using Python and FastAPI, offering a robust foundation for LLM-driven conversational agents. Key features include:

-   **Dynamic Tool Usage:** Agents can dynamically use a variety of tools (MCP Tools) like calculators and note-taking, with tool definitions managed by a central registry.
-   **Agent-to-Agent (A2A) Communication:** Foundations for agents to delegate tasks to other specialized agents.
-   **Enhanced Orchestration:** The service can manage multi-step interactions involving several tool calls or A2A delegations within a single user turn.
-   **Supabase Integration:** Uses Supabase PostgreSQL for persistent storage of conversation history.
-   **Secure Access:** Authentication is handled by an upstream Supabase Edge Function, which validates client API keys. The backend then trusts a specific header set by this Edge Function.
-   **Observability:** Includes structured JSON logging and basic request metrics.

The primary interface for agent communication is a Server-Sent Events (SSE) endpoint compliant with the Agent-Guided User Interface (AG-UI) protocol.

## Setup and Running the Service

### Prerequisites
-   Python 3.9+
-   A Supabase account with a PostgreSQL database.
-   A deployed Supabase Edge Function for API key authentication (see [Supabase Edge Function Authentication](#supabase-edge-function-authentication)).

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
The service requires several environment variables. Create a `.env` file in the `backend/` directory by copying `backend/.env.example` (if it exists from a previous setup) or by creating a new one. Fill in the values based on `backend/.env.example`.

**Key Environment Variables:**
-   `SUPABASE_DATABASE_URL`: The connection string for your Supabase PostgreSQL database.
    -   Find this in your Supabase project dashboard: **Project Settings -> Database -> Connection string (URI tab)**.
    -   Format: `postgresql://postgres:[YOUR-PASSWORD]@[AWS-REGION].pooler.supabase.com:6543/postgres`
-   `OPENAI_API_KEY`: Your API key for OpenAI services.
-   `LOG_LEVEL` (optional): Sets the logging level (e.g., `DEBUG`, `INFO`, `WARNING`). Defaults to `INFO`.

**Note on API Key (`EXPECTED_API_KEY`):** This variable is NO LONGER used directly by the FastAPI backend for client authentication. Client API key validation is now handled by the Supabase Edge Function. The Edge Function itself will require an environment variable (e.g., `EXPECTED_API_KEY_SECRET`) to store the actual API key it validates against.

### 4. Initialize the Database Schema
The application is configured to initialize the database schema (i.e., create necessary tables like `conversation_turns`) automatically on startup if they don't already exist. This is handled by the `init_db()` function called in `main.py`'s startup event.

Alternatively, you can run the database initialization script manually if you prefer to set up tables before the first run, or if you've made changes to models and want to re-initialize (in a development environment; for production, use migrations):
```bash
python database.py
```
You can also use the Supabase SQL Editor in your project dashboard to manually create or inspect tables. The required table structure is defined by the SQLAlchemy models in `backend/models/conversation_history.py`.

### 5. Supabase Edge Function Authentication
This backend relies on an upstream Supabase Edge Function to handle initial client API key authentication.
-   Clients should send their API key (e.g., in an `X-API-KEY` header) to the Edge Function's public URL.
-   The Edge Function validates this key against a secret it holds (e.g., `EXPECTED_API_KEY_SECRET`).
-   If valid, the Edge Function forwards the request to this FastAPI backend, removing the original `X-API-KEY` and adding a new header: `X-Auth-Validation-Status: success`.
-   The FastAPI backend, via its `verify_forwarded_auth_status` dependency (in `backend/security.py`), checks for this trusted header.

For detailed instructions on setting up the Edge Function, refer to `backend/docs/supabase_edge_functions.md`.

### 6. Run the Service
Once the Edge Function is deployed and configured to route to this backend, use Uvicorn to run the FastAPI application:
```bash
uvicorn main:app --reload
```
- `--reload`: Enables auto-reloading for development. Omit for production.
- The service will typically be available at `http://127.0.0.1:8000` (this is the URL your Edge Function should target as its origin). Client requests will go to the Edge Function's URL.

## API Endpoints

The primary endpoint for agent interaction is the AG-UI SSE endpoint, which should be accessed via the Supabase Edge Function URL.

### AG-UI SSE Endpoint: `/ag-ui/events` (via Edge Function)

This endpoint streams agent events to the client using Server-Sent Events.

- **Method:** `GET`
- **URL:** (Accessed via the Supabase Edge Function URL, e.g., `https://<your-supabase-ref>.supabase.co/functions/v1/api-key-authenticator/ag-ui/events`)
- **Query Parameters (Optional):**
    - `user_message` (str): The message from the user to the agent. If not provided, a default message (e.g., "What is the weather like in London?") will be used.
- **Headers (sent to the Edge Function):**
    - `X-API-KEY` (str, **required**): The client's API key for authentication. Validated by the Edge Function.
- **Headers (expected by this FastAPI backend from the Edge Function):**
    - `X-Auth-Validation-Status` (str, **required**): Must be `"success"`. Set by the Edge Function.
- **Headers (related to session management):**
    - `X-Session-ID` (str, optional): A client-provided session ID. If provided, the service will attempt to use it. If not provided, or if a new session starts, the service may generate a new session ID and return it in the response headers of the first event stream connection.

#### Streamed AG-UI Events

Events are streamed in the `text/event-stream` format. Each event is a JSON object prefixed with `data: `.

**Event Structure (`AGUIMessage` Pydantic Model):**
```json
{
  "event_type": "EVENT_TYPE_NAME",
  "data": { /* payload specific to the event_type */ },
  "message": "Optional message string, often for AGENT_RESPONSE or ERROR"
}
```

**Key Event Types:**
(Refer to `backend/models/ag_ui_messages.py` for the full list of `event_type` literals)

1.  **`AGENT_RESPONSE`**: A textual response from the agent to the user.
    *   `message`: The agent's textual response.
2.  **`TOOL_CALL_START`**: Agent is about to call an MCP tool.
    *   `data`: Contains `tool_name` and `inputs`.
3.  **`TOOL_OUTPUT`**: Result from an MCP tool execution.
    *   `data`: Contains `tool_name`, `output`, and `status`.
4.  **`A2A_DELEGATION_START`**: Agent is delegating a task to another agent.
    *   `data`: Contains `target_agent_id`, `task_name`, and `inputs`.
5.  **`A2A_DELEGATION_RESULT`**: Result from an A2A task delegation.
    *   `data`: Contains `target_agent_id`, `task_name`, `status`, and `outputs` or `error_message`.
6.  **`ERROR`**: An error occurred during processing.
    *   `message`: Description of the error.

**Example Event Stream Snippet (Tool Call):**
```
data: {"event_type": "TOOL_CALL_START", "data": {"tool_name": "calculator_tool", "inputs": {"expression": "2+2"}}, "message": null}

data: {"event_type": "TOOL_OUTPUT", "data": {"tool_name": "calculator_tool", "output": {"result": 4.0}, "status": "SUCCESS"}, "message": null}

data: {"event_type": "AGENT_RESPONSE", "data": {}, "message": "The result of 2+2 is 4."}
```

## Core Features & Functionality

### Orchestration Service
The `OrchestrationService` (`backend/services/orchestration_service.py`) is central to processing user messages. It now supports multi-step interactions within a single user turn. This means the agent can:
1.  Receive a user message.
2.  Call an MCP tool (e.g., `calculator_tool`).
3.  Receive the tool's output.
4.  Optionally, call another MCP tool or delegate a task to another agent (A2A) based on the previous result.
5.  Continue this cycle for a few steps (`MAX_ITERATIONS_PER_TURN`).
6.  Finally, formulate and send a consolidated response to the user.
This allows for more complex problem-solving and task execution by the agent.

### MCP Tool Management
The Multi-Capability Protocol (MCP) Tool Management system allows for dynamic registration and invocation of tools.
-   **Tool Definitions (`backend/models/tool_definition.py`):** Tools are defined using the `MCPToolDefinition` Pydantic model, which specifies the tool's name, description, input/output schemas (JSON Schema), handler type (`python_function` or `http_endpoint`), and handler identifier.
-   **Tool Registry (`backend/services/mcp_tool_service.py`):** The `MCPToolRegistry` holds definitions of all available tools. The `MCPToolService` uses this registry to dynamically invoke tools.
-   **Available Tools:**
    *   `get_weather_tool`: Fetches mock weather information. (Handler: `backend.tools.mock_weather_tool:get_weather`)
    *   `calculator_tool`: Evaluates simple arithmetic expressions. (Handler: `backend.tools.calculator_tool:calculate`)
    *   `add_note_tool`: Adds a note to in-memory storage. (Handler: `backend.tools.notes_tool:add_note`)
    *   `get_note_tool`: Retrieves a note by ID from in-memory storage. (Handler: `backend.tools.notes_tool:get_note`)
-   **Adding New Tools:**
    1.  Create your tool logic as a Python function (typically in a new file within `backend/tools/`) or an HTTP endpoint.
    2.  Define its `MCPToolDefinition` (e.g., `YOUR_TOOL_DEFINITION = MCPToolDefinition(...)`).
    3.  Register this definition by adding it to the `_register_initial_tools` method in `MCPToolService` (`self.tool_registry.register_tool(YOUR_TOOL_DEFINITION)`).
    The OrchestrationService will then automatically make this tool available to the LLM.

### Agent-to-Agent (A2A) Communication
The backend now includes foundational support for A2A communication, enabling agents to delegate tasks to one another.
-   **A2A Communication Service (`backend/services/a2a_communication_service.py`):** This service is responsible for sending task requests to other agents. It currently uses a mock "Agent Card" discovery mechanism (`MOCK_AGENT_CARDS`) to find other agents' endpoint URLs.
-   **A2A Message Models (`backend/models/a2a_messages.py`):** `A2ATaskRequest` and `A2ATaskResponse` Pydantic models define the structure for A2A messages.
-   **Mock A2A Server (`mock_a2a_server/`):** A simple FastAPI server is provided to simulate external agents that can receive and respond to A2A tasks. This is useful for testing the A2A communication flow. Refer to `mock_a2a_server/README.md` for instructions on running it.
The LLM, guided by the OrchestrationService, can decide to delegate a task by outputting an `{"action": "a2a_delegate", ...}` JSON object.

### Observability
Basic observability features have been implemented:
-   **Structured JSON Logging:**
    *   The application uses `python-json-logger` for structured logging. Configuration is in `backend/logging_config.py`.
    *   Logs are output to `stdout` in JSON format, including timestamp, level, message, module, function name, line number, and any extra fields passed.
    *   The `LOG_LEVEL` environment variable can be used to control log verbosity (e.g., `DEBUG`, `INFO`, `WARNING`).
-   **Basic Metrics Collection:**
    *   `BasicMetricsMiddleware` (`backend/middleware.py`) collects and logs basic request metrics:
        *   Request processing time (latency).
        *   Total request count.
        *   Total error count (status codes >= 400).
        *   Counts for specific `method_path_statuscode` combinations.
    *   These metrics are currently stored in-memory and reset on application restart.
    *   A debug endpoint `/metrics-debug` is available to view the current in-memory metrics.

## Project Structure

```
backend/
├── .env.example        # Example environment variables
├── .env.test.example   # Example environment variables for tests
├── agent_personas/     # Agent persona configurations
│   ├── simple_example.py
│   └── voice_agent_metaprompt.txt
├── database.py         # Database engine setup, session management, init_db
├── docs/               # Documentation files
│   ├── phase1_summary.md
│   └── supabase_edge_functions.md
├── logging_config.py   # Centralized logging setup
├── main.py             # FastAPI application entry point
├── middleware.py       # Custom FastAPI middleware (e.g., for metrics)
├── models/             # Pydantic and SQLAlchemy models
│   ├── a2a_messages.py
│   ├── ag_ui_messages.py
│   ├── conversation_history.py
│   ├── mcp_messages.py
│   └── tool_definition.py
├── pytest.ini          # Pytest configuration
├── README.md           # This file
├── requirements.txt    # Python dependencies
├── routers/            # FastAPI routers
│   └── ag_ui_router.py
├── security.py         # Authentication logic (now expects header from Edge Function)
├── services/           # Business logic and service integrations
│   ├── a2a_communication_service.py
│   ├── mcp_tool_service.py
│   └── orchestration_service.py
├── tests/              # Unit and integration tests
│   ├── integration/
│   │   ├── test_a2a_flow.py
│   │   └── test_conversation_flow.py
│   └── unit/
│       ├── test_a2a_communication_service.py
│       ├── test_ag_ui_router.py
│       ├── test_calculator_tool.py
│       ├── test_logging_config.py
│       ├── test_mcp_tool_service.py
│       ├── test_middleware.py
│       ├── test_notes_tool.py
│       └── test_orchestration_service.py
└── tools/              # Tool implementations
    ├── calculator_tool.py
    ├── mock_weather_tool.py
    └── notes_tool.py
```
(Note: The `mock_a2a_server/` directory is separate and contains its own README.)

---
*This README provides a starting point. Further details on specific tool implementations, advanced configuration, or deployment strategies should be added as the project evolves.*
```
