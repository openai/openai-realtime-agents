from __future__ import annotations

import logging
import os
import sys
from typing import List, Optional

# Add the project root (vision2value/) to the Python path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from backend.app_agents.router import router as agents_router

# Load .env
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

app = FastAPI(title="oartagents FastAPI backend")


# Add validation error handler to debug 422 errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error on {request.method} {request.url}: {exc}")
    logger.error(f"Request body validation errors: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


# CORS setup for development with HTTP-only cookies
def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "")
    if not raw:
        return default
    return [x.strip() for x in raw.split(",") if x.strip()]


DEFAULT_DEV_ORIGINS = [
    "http://localhost:8080",  # Vite dev alt
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://localhost:5173",  # Common Vite dev
]

allowed_origins = _parse_csv_env("ALLOWED_ORIGINS", DEFAULT_DEV_ORIGINS)
allowed_methods = _parse_csv_env(
    "ALLOWED_METHODS", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)
allowed_headers = _parse_csv_env("ALLOWED_HEADERS", ["*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=allowed_methods,
    allow_headers=allowed_headers,
)

app.include_router(agents_router)


class SessionResponse(BaseModel):
    client_secret: dict


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/session", response_model=SessionResponse)
async def get_session():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    url = f"{OPENAI_BASE_URL}/realtime/sessions"
    payload = {"model": "gpt-4o-realtime-preview-2025-06-03"}

    try:
        timeout = httpx.Timeout(10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        res.raise_for_status()
        return res.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class ResponsesBody(BaseModel):
    # Use a permissive body to proxy to OpenAI Responses API
    model: Optional[str] = None
    input: Optional[object] = None
    text: Optional[object] = None
    messages: Optional[object] = None
    parallel_tool_calls: Optional[bool] = None

    # Allow any additional fields
    def model_dump(self, *args, **kwargs):
        d = super().model_dump(*args, **kwargs)
        return d


@app.post("/api/responses")
async def responses_proxy(body: dict):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    url = f"{OPENAI_BASE_URL}/responses"

    try:
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        res.raise_for_status()
        return res.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
