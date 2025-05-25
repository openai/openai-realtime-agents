import os
import logging
from fastapi import FastAPI
from backend.routers import ag_ui_router
from backend.database import init_db
from backend.logging_config import setup_logging
from backend.middleware import BasicMetricsMiddleware, get_current_metrics # Import middleware and metrics getter

# --- Logging Configuration ---
setup_logging()
logger = logging.getLogger(__name__)

# --- Database Configuration ---
DATABASE_URL = os.environ.get("SUPABASE_DATABASE_URL", "postgresql://postgres:your-supabase-password@aws-region.pooler.supabase.com:6543/postgres")

# Initialize FastAPI application
app = FastAPI(
    title="Realtime Agent Interaction Backend (Supabase)",
    description="A headless API for powering realtime LLM-driven agent interactions using AG-UI over SSE, with Supabase for database.",
    version="0.2.0" 
)

# --- Add Middleware ---
# The metrics middleware should be among the first, to capture as much of the request processing time as possible.
app.add_middleware(BasicMetricsMiddleware)

# --- Include Routers ---
app.include_router(ag_ui_router.router)

# --- Root Endpoint ---
@app.get("/")
async def root():
    logger.info("Root endpoint '/' was called.", extra={"endpoint": "/"})
    return {"message": "Welcome to the Realtime Agent Interaction Backend (Supabase). Visit /docs for API documentation."}

# --- Metrics Debug Endpoint (Optional) ---
@app.get("/metrics-debug")
async def metrics_debug_endpoint():
    """
    Provides a simple JSON response of the current in-memory metrics.
    Note: These metrics reset on application restart.
    """
    logger.info("/metrics-debug endpoint called.", extra={"endpoint": "/metrics-debug"})
    return get_current_metrics()

# --- Startup Event Handler ---
@app.on_event("startup")
async def startup_event():
    logger.info("Application startup sequence initiated...")
    try:
        db_url_log = DATABASE_URL
        if "@" in db_url_log and "://" in db_url_log:
            protocol_part = db_url_log.split("://")[0] + "://"
            # credentials_part = db_url_log.split("://")[1].split("@")[0] # Not used
            rest_of_url = db_url_log.split("@")[1] if "@" in db_url_log.split("://")[1] else ""
            masked_credentials = "[REDACTED_CREDENTIALS]"
            db_url_log = f"{protocol_part}{masked_credentials}@{rest_of_url}"
        
        logger.info(f"Attempting to initialize database with URL: {db_url_log}", extra={"db_url_masked": db_url_log})
        init_db() 
        logger.info("Database initialization successful.")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}", exc_info=True)
    logger.info("Application startup sequence completed.")

# --- Shutdown Event Handler ---
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown sequence initiated...")
    # Example: Close HTTP client if mcp_tool_service uses one and needs explicit closing
    # from backend.services.mcp_tool_service import mcp_tool_service
    # await mcp_tool_service.close_http_client()
    logger.info("Application shutdown sequence completed.")

# To run this application:
# 1. Ensure environment variables are set (see .env.example):
#    SUPABASE_DATABASE_URL, OPENAI_API_KEY, LOG_LEVEL (optional)
# 2. Run: uvicorn main:app --reload
