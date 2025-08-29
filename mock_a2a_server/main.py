from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import uuid

# --- Pydantic Models for A2A Communication (copied for mock server simplicity) ---
# In a real scenario, these might be shared or imported if the mock server is part of the same project.

class A2ATaskRequest(BaseModel):
    target_agent_id: str = Field(..., description="The unique identifier of the agent intended to handle this task.")
    task_name: str = Field(..., description="A specific name for the task, e.g., 'translate_text', 'summarize_document'.")
    inputs: Dict[str, Any] = Field(default_factory=dict, description="A dictionary containing the inputs required for the task.")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="A unique identifier for this task request.")

class A2ATaskResponse(BaseModel):
    request_id: str = Field(..., description="The unique identifier of the original task request this response corresponds to.")
    status: str = Field(..., description="The status of the task processing. Examples: 'SUCCESS', 'ERROR', 'IN_PROGRESS', 'PENDING'.")
    outputs: Optional[Dict[str, Any]] = Field(None, description="A dictionary containing the outputs of the task if successful.")
    error_message: Optional[str] = Field(None, description="An error message if the task processing failed.")

# --- Mock Server Setup ---
app = FastAPI(
    title="Mock A2A Agent Server",
    description="A simple mock server to simulate an external agent handling A2A tasks.",
    version="0.1.0"
)

@app.post("/a2a/receive_task", response_model=A2ATaskResponse)
async def receive_a2a_task(request: A2ATaskRequest):
    """
    Mock endpoint to receive A2A tasks.
    Simulates processing based on task_name.
    """
    print(f"Mock A2A Server: Received task '{request.task_name}' for agent '{request.target_agent_id}' (Request ID: {request.request_id}).")
    print(f"Inputs: {request.inputs}")

    if request.target_agent_id == "mock_translator_agent_001":
        if request.task_name == "translate_to_spanish":
            text_to_translate = request.inputs.get("text_to_translate")
            if text_to_translate is None:
                print("Error: 'text_to_translate' not found in inputs for translate_to_spanish.")
                return A2ATaskResponse(
                    request_id=request.request_id,
                    status="ERROR",
                    error_message="'text_to_translate' input is missing."
                )
            
            # Simulate translation
            translated = f"{text_to_translate} en Español"
            print(f"Mock translation: '{translated}'")
            return A2ATaskResponse(
                request_id=request.request_id,
                status="SUCCESS",
                outputs={"translated_text": translated, "original_text": text_to_translate}
            )
        elif request.task_name == "cause_error_if_you_can":
             print("Simulating an intentional error for 'cause_error_if_you_can'.")
             return A2ATaskResponse(
                request_id=request.request_id,
                status="ERROR",
                error_message="This is a simulated processing error from the mock agent."
            )


    elif request.target_agent_id == "mock_summarizer_agent_002":
        if request.task_name == "summarize_text":
            text_to_summarize = request.inputs.get("text_to_summarize")
            if text_to_summarize is None:
                print("Error: 'text_to_summarize' not found in inputs for summarize_text.")
                return A2ATaskResponse(
                    request_id=request.request_id,
                    status="ERROR",
                    error_message="'text_to_summarize' input is missing."
                )
            
            # Simulate summarization
            summary = f"Summary of '{text_to_summarize[:30]}...'"
            print(f"Mock summary: '{summary}'")
            return A2ATaskResponse(
                request_id=request.request_id,
                status="SUCCESS",
                outputs={"summary_text": summary, "original_length": len(text_to_summarize)}
            )

    # Default response if task or agent not specifically handled
    print(f"Warning: Task '{request.task_name}' for agent '{request.target_agent_id}' not specifically handled by mock server.")
    return A2ATaskResponse(
        request_id=request.request_id,
        status="ERROR",
        error_message=f"Task '{request.task_name}' not supported by mock agent '{request.target_agent_id}' or agent unknown."
    )

@app.get("/")
async def root():
    return {"message": "Mock A2A Agent Server is running. Use the /a2a/receive_task endpoint (POST) for A2A communication."}

# To run this mock server:
# 1. Make sure 'fastapi' and 'uvicorn' are installed in its environment.
# 2. Navigate to the `mock_a2a_server` directory.
# 3. Run: uvicorn main:app --port 8001 --reload
# The main backend's A2ACommunicationService expects this server at http://localhost:8001
```
