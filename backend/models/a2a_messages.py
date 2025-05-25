import uuid
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class A2ATaskRequest(BaseModel):
    """
    Represents a task request sent from one agent to another.
    """
    target_agent_id: str = Field(..., description="The unique identifier of the agent intended to handle this task.")
    task_name: str = Field(..., description="A specific name for the task, e.g., 'translate_text', 'summarize_document'.")
    inputs: Dict[str, Any] = Field(default_factory=dict, description="A dictionary containing the inputs required for the task. Structure depends on the task_name.")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="A unique identifier for this task request.")

class A2ATaskResponse(BaseModel):
    """
    Represents the response from an agent after processing a task request.
    """
    request_id: str = Field(..., description="The unique identifier of the original task request this response corresponds to.")
    status: str = Field(..., description="The status of the task processing. Examples: 'SUCCESS', 'ERROR', 'IN_PROGRESS', 'PENDING'.")
    outputs: Optional[Dict[str, Any]] = Field(None, description="A dictionary containing the outputs of the task if successful. Structure depends on the task_name.")
    error_message: Optional[str] = Field(None, description="An error message if the task processing failed.")

if __name__ == '__main__':
    # Example Usage
    print("--- A2ATaskRequest Example ---")
    task_req_data = {
        "target_agent_id": "translator_agent_001",
        "task_name": "translate_text",
        "inputs": {
            "text": "Hello, world!",
            "target_language": "es"
        }
    }
    task_request = A2ATaskRequest(**task_req_data)
    print(task_request.json(indent=2))
    # Example with default request_id
    task_request_default_id = A2ATaskRequest(
        target_agent_id="summarizer_agent_002",
        task_name="summarize_text",
        inputs={"document_url": "http://example.com/article.txt"}
    )
    print(f"\nRequest with default ID: {task_request_default_id.request_id}")
    print(task_request_default_id.json(indent=2))


    print("\n--- A2ATaskResponse Examples ---")
    # Success example
    success_response_data = {
        "request_id": task_request.request_id,
        "status": "SUCCESS",
        "outputs": {
            "translated_text": "Hola, mundo!"
        }
    }
    success_response = A2ATaskResponse(**success_response_data)
    print(success_response.json(indent=2))

    # Error example
    error_response_data = {
        "request_id": task_request_default_id.request_id,
        "status": "ERROR",
        "error_message": "Failed to download document from URL."
    }
    error_response = A2ATaskResponse(**error_response_data)
    print(error_response.json(indent=2))

    # In-progress example
    inprogress_response_data = {
        "request_id": "some_long_running_task_id",
        "status": "IN_PROGRESS",
    }
    inprogress_response = A2ATaskResponse(**inprogress_response_data)
    print(inprogress_response.json(indent=2))
