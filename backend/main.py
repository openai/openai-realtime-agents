import os
import logging
from fastapi import FastAPI, Depends, HTTPException 
from sqlalchemy.orm import Session 
from backend.database import get_db, engine 
from sqlalchemy import text 

from backend.routers import ag_ui_router
from backend.database import init_db
from backend.logging_config import setup_logging
from backend.middleware import BasicMetricsMiddleware, get_current_metrics 
from backend.telemetry_config import init_telemetry # Import OpenTelemetry setup
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor # Import FastAPI instrumentor

# --- Logging Configuration ---
setup_logging()
logger = logging.getLogger(__name__)

# --- Telemetry Configuration ---
# Call init_telemetry() early to configure OpenTelemetry for the application.
# This should be done before any instrumented libraries are imported or used extensively.
init_telemetry() 

# --- Database Configuration ---
DATABASE_URL = os.environ.get("SUPABASE_DATABASE_URL", "postgresql://postgres:your-supabase-password@aws-region.pooler.supabase.com:6543/postgres")

# Initialize FastAPI application
app = FastAPI(
    title="Realtime Agent Interaction Backend (Supabase)",
    description="A headless API for powering realtime LLM-driven agent interactions using AG-UI over SSE, with Supabase for database.",
    version="0.3.0" # Version updated for Observability enhancements
)

# --- Add Middleware ---
app.add_middleware(BasicMetricsMiddleware)

# --- Instrument FastAPI app with OpenTelemetry ---
# This will automatically trace requests handled by FastAPI.
# Ensure this is done after app initialization and preferably before adding routes if possible,
# though often done here.
FastAPIInstrumentor.instrument_app(app)

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
    logger.info("/metrics-debug endpoint called.", extra={"endpoint": "/metrics-debug"})
    return get_current_metrics()

# --- Health and Readiness Endpoints ---
@app.get("/health", status_code=200)
async def health_check():
    logger.debug("Health check endpoint '/health' called.")
    return {"status": "ok"}

@app.get("/readiness", status_code=200)
async def readiness_check(db: Session = Depends(get_db)):
    logger.debug("Readiness check endpoint '/readiness' called.")
    try:
        db.execute(text("SELECT 1")).fetchone()
        logger.debug("Readiness check: Database connection successful.")
        return {"status": "ready", "dependencies": {"database": "ok"}}
    except Exception as e:
        logger.error(f"Readiness check failed: Database connection error. Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=503, 
            detail={"status": "not_ready", "dependencies": {"database": "error", "error_message": str(e)}}
        )

# --- Startup Event Handler ---
@app.on_event("startup")
async def startup_event():
    logger.info("Application startup sequence initiated...")
    try:
        db_url_log = DATABASE_URL
        if "@" in db_url_log and "://" in db_url_log:
            protocol_part = db_url_log.split("://")[0] + "://"
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
    try:
        from backend.services.mcp_tool_service import mcp_tool_service
        await mcp_tool_service.close_http_client()
        from backend.services.a2a_communication_service import a2a_communication_service
        await a2a_communication_service.close_http_client()
        logger.info("HTTP clients for MCP and A2A services closed.")
    except Exception as e:
        logger.error(f"Error during shutdown while closing HTTP clients: {e}", exc_info=True)
    
    # (Optional) If a global TracerProvider was explicitly set up and needs shutdown:
    # from opentelemetry import trace
    # tracer_provider = trace.get_tracer_provider()
    # if hasattr(tracer_provider, 'shutdown'):
    #    tracer_provider.shutdown()
    #    logger.info("OpenTelemetry TracerProvider shut down.")
        
    logger.info("Application shutdown sequence completed.")
