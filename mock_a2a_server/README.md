# Mock A2A Agent Server

This is a very simple FastAPI application designed to act as a mock external agent for testing Agent-to-Agent (A2A) communication. It exposes a single endpoint that simulates receiving and processing tasks from another agent.

## Purpose

The main backend's `A2ACommunicationService` can send task requests to this mock server to test the A2A communication flow without needing a real, complex external agent.

This mock server helps verify:
- That the `A2ACommunicationService` can correctly send `A2ATaskRequest` payloads.
- That it can receive and parse `A2ATaskResponse` payloads.
- Basic error handling and response status processing.

## Setup and Running

### 1. Prerequisites
- Python 3.8+
- `pip` for installing dependencies.

### 2. Installation
Navigate to the `mock_a2a_server/` directory. It's recommended to use a virtual environment.

```bash
# Navigate to this directory
# cd /path/to/your_project/mock_a2a_server

# Create a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Running the Server
Use Uvicorn to run the FastAPI application:

```bash
uvicorn main:app --port 8001 --reload
```

- `--port 8001`: This mock server is configured to run on port `8001` by default. The main backend's `A2ACommunicationService` (in its mock agent card definitions) expects to find this mock server at `http://localhost:8001`.
- `--reload`: Enables auto-reloading for development. You can omit this if you don't expect to make changes while it's running.

The server will be available at `http://127.0.0.1:8001`.

## Endpoints

### `/a2a/receive_task`

- **Method:** `POST`
- **Request Body:** Expects an `A2ATaskRequest` JSON object.
  ```json
  {
    "target_agent_id": "string",
    "task_name": "string",
    "inputs": {},
    "request_id": "string"
  }
  ```
- **Response Body:** Returns an `A2ATaskResponse` JSON object.
  ```json
  {
    "request_id": "string",
    "status": "string", // e.g., "SUCCESS", "ERROR"
    "outputs": {},     // (optional)
    "error_message": "string" // (optional)
  }
  ```

### Mocked Task Logic

The mock server has simple hardcoded logic based on `target_agent_id` and `task_name` in `main.py`:

-   **Agent `mock_translator_agent_001`:**
    -   Task `translate_to_spanish`: Simulates translating the `text_to_translate` input to Spanish.
    -   Task `cause_error_if_you_can`: Simulates an intentional processing error.
-   **Agent `mock_summarizer_agent_002`:**
    -   Task `summarize_text`: Simulates summarizing the `text_to_summarize` input.

If a task or agent ID is not recognized, it returns a generic error response.

## Pydantic Models

The Pydantic models (`A2ATaskRequest`, `A2ATaskResponse`) used in this mock server are defined directly in `main.py` for simplicity. They mirror the structure expected by the main backend's `A2ACommunicationService`.
```
