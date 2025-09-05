from pydantic import BaseModel
from typing import Dict

class MCPToolCallRequest(BaseModel):
    tool_name: str
    inputs: Dict

class MCPToolCallResponse(BaseModel):
    tool_name: str
    output: Dict
    status: str # e.g., "SUCCESS", "ERROR"
