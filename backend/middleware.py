import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseCallNext
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

# --- In-memory Metrics Storage (Very Basic) ---
# For demonstration. In production, use Prometheus, StatsD, etc.
metrics_store: Dict[str, float] = {
    "total_requests": 0,
    "total_errors": 0,
    # Example: REQUESTS_TOTAL.labels(path, method, status_code).inc()
    # We'll use a tuple (path, method, status_code) as a key for specific counts.
}

def get_metric_key(path: str, method: str, status_code: int) -> str:
    """Helper to create a consistent key for request counts."""
    return f"requests_count_{method}_{path}_{status_code}"

class BasicMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseCallNext) -> Response:
        start_time = time.perf_counter()
        
        # Default status code in case of an unhandled exception before response is formed.
        status_code = HTTP_500_INTERNAL_SERVER_ERROR 
        
        try:
            response = await call_next(request)
            status_code = response.status_code # Get status code from actual response
        except Exception as e:
            # If an exception occurs in the application, it might not have a response object yet.
            # We re-raise to let FastAPI's exception handling deal with it and form a proper HTTP response.
            logger.error(f"Unhandled exception during request processing: {request.method} {request.url.path}", 
                         exc_info=True, extra={"path": request.url.path, "method": request.method})
            metrics_store["total_errors"] += 1
            # The exception will be handled by FastAPI's error handlers, which will set the status_code.
            # Unfortunately, getting that final status_code here directly is tricky without more complex error handling.
            # For this basic middleware, we'll log the error and increment total_errors.
            # The finally block will log with the default 500 or whatever status_code was set if response was formed.
            raise e # Re-raise the exception
        finally:
            # This block executes even if an error occurred and was re-raised.
            # If `response` object exists (i.e., call_next returned or an exception handler created it),
            # `status_code` will be updated. Otherwise, it remains the default set before `try`.
            # For more accurate status_code on unhandled exceptions, a separate exception handler
            # integrated with metrics would be better.
            
            processing_time_ms = (time.perf_counter() - start_time) * 1000
            
            # Increment total requests
            metrics_store["total_requests"] += 1
            
            # Increment specific request counter
            # For SSE, path might be dynamic if session IDs are part of it.
            # Consider normalizing paths for metrics if they contain many unique IDs.
            # For now, using the raw path.
            path = request.url.path
            method = request.method
            
            # If status_code was not updated by a successful response (e.g. unhandled exception path)
            # this metric might be less accurate for the error count by status.
            # FastAPI's default exception handler should set a 500.
            specific_metric_key = get_metric_key(path, method, status_code)
            metrics_store[specific_metric_key] = metrics_store.get(specific_metric_key, 0) + 1

            if 400 <= status_code < 600: # Count 4xx and 5xx as errors for this metric
                metrics_store["total_errors"] += 1 # May double count if already incremented in except block for unhandled.

            log_extras = {
                "metric_type": "endpoint_request",
                "path": path,
                "method": method,
                "status_code": status_code,
                "latency_ms": round(processing_time_ms, 2) # Round to 2 decimal places
            }
            logger.info(f"Request processed: {method} {path} - Status: {status_code} - Latency: {log_extras['latency_ms']:.2f}ms", extra=log_extras)

        return response

# --- Metrics Endpoint Logic (Optional) ---
def get_current_metrics() -> Dict[str, float]:
    """Returns a copy of the current in-memory metrics."""
    # Filter out only keys that represent specific request counts for detailed view
    detailed_counts = {k: v for k, v in metrics_store.items() if k.startswith("requests_count_")}
    return {
        "total_requests": metrics_store.get("total_requests", 0),
        "total_errors": metrics_store.get("total_errors", 0),
        "detailed_request_counts": detailed_counts
    }

if __name__ == "__main__":
    # This block is for conceptual testing if you run this file directly.
    # In a real app, the middleware is added to FastAPI.
    
    # Simulate some metrics
    metrics_store["total_requests"] = 100
    metrics_store["total_errors"] = 5
    metrics_store[get_metric_key("/ag-ui/events", "GET", 200)] = 80
    metrics_store[get_metric_key("/ag-ui/events", "GET", 401)] = 2
    metrics_store[get_metric_key("/", "GET", 200)] = 15
    
    print("Current Metrics (Example):")
    print(get_current_metrics())
```
