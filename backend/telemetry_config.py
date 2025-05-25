import os
import logging
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource

logger = logging.getLogger(__name__)

def init_telemetry():
    """
    Initializes the OpenTelemetry SDK for distributed tracing.

    Reads configuration from environment variables:
    - OTEL_EXPORTER_OTLP_ENDPOINT: The OTLP endpoint for exporting traces.
      Defaults to "http://localhost:4318/v1/traces".
    - OTEL_SERVICE_NAME: The name of this service, used in traces.
      Defaults to "ai_assistant_backend".
    """
    otel_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
    otel_service_name = os.environ.get("OTEL_SERVICE_NAME", "ai_assistant_backend")

    try:
        # Create a Resource to identify this service in traces
        resource = Resource(attributes={
            SERVICE_NAME: otel_service_name
            # Add other resource attributes here if needed, e.g., service.version
        })

        # Set up a TracerProvider with the specified resource
        provider = TracerProvider(resource=resource)
        
        # Set up an OTLP exporter
        # The OTLPSpanExporter sends spans to an OTLP collector (e.g., Jaeger, Grafana Tempo, OpenTelemetry Collector)
        # Ensure the endpoint is correct for your collector setup.
        # For HTTP exporter, use OTLPSpanExporter. For gRPC, use OTLPGrpcSpanExporter.
        otlp_exporter = OTLPSpanExporter(endpoint=otel_endpoint)
        
        # Use BatchSpanProcessor for better performance in production.
        # It collects spans in batches before sending them to the exporter.
        processor = BatchSpanProcessor(otlp_exporter)
        
        provider.add_span_processor(processor)
        
        # Set the global TracerProvider
        trace.set_tracer_provider(provider)
        
        logger.info(f"OpenTelemetry initialized successfully. Exporting traces to: {otel_endpoint}", 
                     extra={"otel_endpoint": otel_endpoint, "otel_service_name": otel_service_name})

        # Example of getting a tracer (not strictly needed here, but shows how apps will get it)
        # tracer = trace.get_tracer(__name__)
        # with tracer.start_as_current_span("telemetry_init_test_span") as span:
        #     span.set_attribute("init.status", "success")
        #     logger.info("Test span created during telemetry initialization.")

    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}", exc_info=True)
        # Depending on the application's requirements, you might want to
        # raise the exception or allow the app to continue without tracing.

if __name__ == '__main__':
    # This block demonstrates direct execution for quick testing of the setup.
    # Ensure you have an OTLP collector running at the default or configured endpoint.
    
    # For local testing, you might need to set environment variables:
    # os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4318/v1/traces"
    # os.environ["OTEL_SERVICE_NAME"] = "my_test_service"

    # Configure basic logging to see output from this script
    logging.basicConfig(level=logging.DEBUG)
    
    print("Attempting to initialize OpenTelemetry for direct test...")
    init_telemetry()
    
    # Example: Create a tracer and a span to test if exporter works
    tracer = trace.get_tracer("my_test_tracer")
    if isinstance(trace.get_tracer_provider(), TracerProvider): # Check if provider was set
        print("TracerProvider is correctly set globally.")
        with tracer.start_as_current_span("my_manual_test_span") as test_span:
            test_span.set_attribute("test.attribute", "hello_otel")
            print(f"Test span '{test_span.context.span_id}' created. Check your OTLP collector.")
            # In a real app, spans might not be sent immediately due to BatchSpanProcessor.
            # For testing, you might need to force flush the provider if it supports it,
            # or wait for the batch interval.
            # Example (conceptual, might need access to the provider and processor):
            # trace_provider = trace.get_tracer_provider()
            # if hasattr(trace_provider, 'force_flush'):
            #     trace_provider.force_flush()
            #     print("TracerProvider flushed.")
    else:
        print("TracerProvider was not set. OpenTelemetry initialization might have failed.")
    print("Direct test complete. If no errors, check your OTLP collector for 'my_manual_test_span'.")

```
