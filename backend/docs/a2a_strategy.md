# Agent-to-Agent (A2A) Communication Strategy

This document outlines the strategy for Agent-to-Agent (A2A) communication, covering both how this backend service acts as an A2A client (delegating tasks to other agents) and how it might conceptually expose its own capabilities as an A2A server.

## 1. A2A Client: Delegating Tasks to Other Agents

The backend's `A2ACommunicationService` (`backend/services/a2a_communication_service.py`) enables it to act as an A2A client, delegating specific tasks to other specialized agents.

### a. Current Implementation (Mocked Discovery)

-   **`A2ACommunicationService`:** Sends `A2ATaskRequest` messages to other agents via HTTP.
-   **Message Structures (`backend/models/a2a_messages.py`):** `A2ATaskRequest` and `A2ATaskResponse` define the communication protocol.
-   **Agent Discovery:** Currently uses a hardcoded dictionary `MOCK_AGENT_CARDS` within the service to find other agents' endpoint URLs and basic descriptions. This is suitable for development and testing with known mock agents.
-   **Error Handling & Retries:** The service implements `tenacity` for retrying requests on transient network errors or specific server-side HTTP error codes (502, 503, 504) from the target agent.

### b. Conceptual Dynamic Agent Discovery (Future Enhancement)

For a more scalable and flexible A2A ecosystem, dynamic agent discovery is essential. This would replace the hardcoded `MOCK_AGENT_CARDS`.

-   **A2A Agent Registry Service:**
    *   **Concept:** A dedicated, centralized service (external to this specific backend instance) would act as an A2A Agent Registry.
    *   **Functionality:**
        *   **Registration:** Agents (including instances of this backend, if it were to offer A2A services) would publish their "Agent Card" to this registry.
        *   **Discovery:** Agents needing to delegate tasks would query the registry to find suitable agents based on `agent_id`, capabilities, `task_name`, or other metadata.
-   **Agent Card Details:** An "Agent Card" published to the registry would contain comprehensive information about an agent, such as:
    *   `agent_id`: Unique identifier for the agent instance.
    *   `name`: Human-readable name.
    *   `description`: Detailed description of the agent's purpose and capabilities.
    *   `endpoint_url`: The secure HTTP endpoint for receiving A2A task requests.
    *   `supported_tasks`: A list of `task_name`s the agent can perform.
    *   `input_schemas_per_task`: JSON schemas detailing the expected inputs for each supported task.
    *   `output_schemas_per_task`: JSON schemas detailing the expected outputs for each supported task.
    *   `authentication_details`: Information on how to authenticate with the agent (e.g., required tokens, mTLS expectations).
    *   `version`, `status`, `owner`, etc.
-   **Client Action (`A2ACommunicationService` Update):**
    *   Instead of using `MOCK_AGENT_CARDS`, `get_agent_details(agent_id)` would query the A2A Agent Registry.
    *   The service might also include methods like `find_agents_for_task(task_name_or_capability: str)` to discover suitable agents.
-   **Security:** Communication with the Agent Registry itself would need to be secured (e.g., mTLS or token-based auth).

This dynamic discovery mechanism would allow for a more decoupled and evolving multi-agent system where agents can be added, removed, or updated without requiring manual changes in every consuming agent.

## 2. A2A Server: Exposing Backend Capabilities to Other Agents (Conceptual)

This section outlines how the current backend service could conceptually expose its own functionalities to be consumed by other trusted agents via A2A communication.

### a. Purpose

Exposing A2A server capabilities would allow other agents within a trusted ecosystem to leverage this backend's specialized skills or access its managed data/tools. For example:
-   If this backend develops a unique capability (e.g., complex financial analysis via a suite of MCP tools).
-   To allow a "supervisor" agent to delegate sub-tasks to this backend.
-   To integrate this backend into a larger chain or ensemble of collaborating agents.

### b. Key Components for A2A Server Functionality

1.  **A2A Task Endpoint:**
    *   A new FastAPI router (e.g., mounted at `/a2a/tasks`) would be created.
    *   This router would have an endpoint (e.g., `POST /`) designed to receive `A2ATaskRequest` messages from other authenticated agents.

2.  **Authentication & Authorization:**
    *   **Authentication:** Robust authentication is critical. Options include:
        *   **mTLS:** If the communicating agents are within a trusted network (e.g., internal Kubernetes cluster or VPC), mTLS would be ideal. Both the calling agent (client) and this backend (server) would present certificates signed by a shared private CA. The backend would verify the client certificate to authenticate the calling agent.
        *   **OAuth 2.0 Client Credentials Flow:** External trusted agents could be issued client credentials (client ID & secret) to obtain an access token from a central OAuth server. This token would then be presented as a Bearer token to the A2A endpoint.
        *   **Signed Requests (e.g., JWTs with shared secrets/keys):** The calling agent could sign its request (or a specific part of it, like a JWT) using a pre-shared secret or a private key, which this backend would then verify.
    *   **Authorization:** Once authenticated, the backend needs to authorize the request:
        *   The authenticated agent's ID or role (extracted from its certificate in mTLS, or token in OAuth) would be used.
        *   A permission system would determine if the calling agent is authorized to execute the specific `task_name` and access any requested resources. This could be role-based or capability-based.

3.  **Task Dispatching:**
    *   Upon receiving a validated `A2ATaskRequest`, the A2A server endpoint would need to dispatch the task internally.
    *   This could involve:
        *   Mapping the `task_name` from the request to an internal service method or a specific LLM prompt chain.
        *   Potentially invoking the `OrchestrationService` or `MCPToolService` directly, but with stricter controls and context appropriate for an A2A interaction (e.g., ensuring the external agent cannot make this backend call arbitrary external tools without permission).
        *   The `inputs` from the `A2ATaskRequest` would be passed to the internal handler.

4.  **Response Handling:**
    *   After processing the task, the A2A server endpoint would construct and return an `A2ATaskResponse` message, indicating the `status` ("SUCCESS", "ERROR", etc.), `outputs`, or `error_message`.

### c. Example "Agent Card" for this Backend

If this backend were to publish its capabilities as an A2A server, its Agent Card might look something like this (example assumes it exposes its existing tools as A2A tasks):

```json
{
  "agent_id": "realtime_interactive_agent_backend_v1",
  "name": "General Purpose Interactive Agent Backend",
  "description": "Provides capabilities for general conversation, weather information, calculations, and note-taking. Can also coordinate with other agents.",
  "endpoint_url": "https://<this-backend-public-url>/a2a/tasks", // Secure A2A endpoint
  "authentication_methods_supported": ["mTLS_with_private_ca_X", "OAuth_ClientCredentials_v2"],
  "supported_tasks": [
    {
      "task_name": "get_weather_information",
      "description": "Retrieves weather for a location.",
      "input_schema": { /* JSON schema for location, unit */ } 
    },
    {
      "task_name": "perform_calculation",
      "description": "Evaluates an arithmetic expression.",
      "input_schema": { /* JSON schema for expression */ }
    },
    {
      "task_name": "delegate_advanced_query", 
      "description": "Handles complex user queries by potentially using internal tools or delegating further.",
      "input_schema": { /* JSON schema for user_query_string */ }
    } 
    // Potentially other tasks mapping to its core capabilities
  ]
}
```

### d. Security Considerations for A2A Server Endpoints

-   **Increased Attack Surface:** Exposing A2A server endpoints increases the system's attack surface.
-   **Robust Authentication/Authorization:** Strong authentication (like mTLS for internal, OAuth for external trusted parties) and fine-grained authorization for each task/resource are paramount.
-   **Input Validation:** Rigorous validation of all inputs from `A2ATaskRequest` messages is essential to prevent injection attacks or other vulnerabilities.
-   **Rate Limiting & Throttling:** Protect A2A endpoints from abuse or denial-of-service attacks.
-   **Audit Logging:** Detailed audit logs for all A2A requests received, processed, and responses sent.
-   **Error Handling:** Graceful error handling and standardized error responses.

Implementing A2A server capabilities requires careful design with a strong emphasis on security to ensure that only trusted agents can access designated functionalities.
```
