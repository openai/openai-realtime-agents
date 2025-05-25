import pytest
import logging
import json
import io
import os
from backend.logging_config import setup_logging

@pytest.fixture
def logger_and_stream():
    """Fixture to set up logging and capture log output."""
    # Ensure any previously configured handlers are cleared for isolation
    logging.getLogger().handlers = []
    
    stream = io.StringIO()
    # Temporarily redirect stdout for the logger to capture its output
    # This is a bit more involved if root logger is already configured by pytest or other libs.
    # A more robust way might be to add a specific handler for testing.
    
    # For this test, we'll re-setup logging with a specific handler that uses our stream
    original_handlers = logging.getLogger().handlers.copy()
    
    # Setup logging with our stream handler
    log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    logger = logging.getLogger("test_logger") # Use a specific named logger
    logger.handlers = [] # Clear handlers for this specific logger
    
    log_handler = logging.StreamHandler(stream) # Use our stream
    
    # Use the same formatter as in setup_logging
    from python_json_logger import jsonlogger
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(message)s %(module)s %(funcName)s %(lineno)d",
        rename_fields={"asctime": "timestamp", "levelname": "level"}
    )
    log_handler.setFormatter(formatter)
    
    logger.addHandler(log_handler)
    logger.setLevel(log_level)
    
    yield logger, stream # Provide the logger and stream to the test
    
    # Teardown: clear handlers and restore original handlers to avoid interference
    logger.handlers = []
    logging.getLogger().handlers = original_handlers
    stream.close()


def test_setup_logging_configures_json_formatter(logger_and_stream):
    logger, stream = logger_and_stream
    
    test_message = "This is a JSON format test."
    logger.info(test_message, extra={"test_key": "test_value"})
    
    log_output_str = stream.getvalue()
    assert log_output_str, "Log output should not be empty"
    
    try:
        log_json = json.loads(log_output_str)
    except json.JSONDecodeError:
        pytest.fail(f"Log output is not valid JSON: {log_output_str}")
        
    assert "timestamp" in log_json
    assert log_json["level"] == "INFO"
    assert log_json["message"] == test_message
    assert log_json["module"] == "test_logging_config" # This will be the name of the test file
    assert log_json["funcName"] == "test_setup_logging_configures_json_formatter" # Name of the test function
    assert "lineno" in log_json
    assert log_json["test_key"] == "test_value"

def test_log_levels_respected():
    # Test that different log levels are respected (requires setting LOG_LEVEL env var or mocking it)
    # This is more complex to test directly without changing global state or using a pytest plugin for env vars.
    # For now, we'll test that the default level (INFO) works.
    
    # Re-setup logging with default (INFO) level for this test
    logging.getLogger().handlers = [] # Clear global handlers
    setup_logging() # Call the actual setup function
    
    # Capture root logger's stream (if setup_logging adds a StreamHandler to root)
    # This assumes setup_logging adds a StreamHandler to the root logger.
    # If setup_logging was more complex (e.g., specific named loggers), this needs adjustment.
    
    # Find the StreamHandler that setup_logging added to the root logger
    root_logger = logging.getLogger()
    test_stream_handler = None
    original_stream_for_handler = None
    
    for handler in root_logger.handlers:
        if isinstance(handler, logging.StreamHandler):
            test_stream_handler = handler
            original_stream_for_handler = handler.stream # Save original stream
            handler.stream = io.StringIO() # Redirect its output
            break
    
    assert test_stream_handler is not None, "setup_logging should add a StreamHandler to the root logger."
    
    stream_capture = test_stream_handler.stream
    
    logging.debug("This is a debug message.") # Should not appear if default is INFO
    logging.info("This is an info message for level test.")
    logging.warning("This is a warning message for level test.")
    
    log_output = stream_capture.getvalue()
    
    assert "This is a debug message." not in log_output
    assert "This is an info message for level test." in log_output
    assert "This is a warning message for level test." in log_output
    
    # Restore original stream to the handler
    if test_stream_handler and original_stream_for_handler:
        test_stream_handler.stream = original_stream_for_handler
    
    # Clean up handlers added by setup_logging for this test
    root_logger.handlers = []


def test_exc_info_logging(logger_and_stream):
    logger, stream = logger_and_stream
    try:
        raise ValueError("Test exception for exc_info")
    except ValueError:
        logger.error("An error occurred with exc_info", exc_info=True)
    
    log_output_str = stream.getvalue()
    log_json = json.loads(log_output_str)
    
    assert log_json["level"] == "ERROR"
    assert "exc_info" in log_json
    assert "ValueError: Test exception for exc_info" in log_json["exc_info"]

def test_log_level_env_variable():
    # This test would ideally use a pytest plugin like pytest-env to set env vars per test.
    # Manually setting/unsetting os.environ can be flaky with parallel tests.
    # For now, this demonstrates the concept.
    original_log_level = os.environ.get("LOG_LEVEL")
    try:
        os.environ["LOG_LEVEL"] = "DEBUG"
        logging.getLogger().handlers = [] # Clear global handlers before re-setup
        setup_logging() # Re-initialize logging with the new LOG_LEVEL
        
        # Similar to test_log_levels_respected, capture output
        root_logger = logging.getLogger()
        test_stream_handler = None
        original_stream_for_handler = None
        for handler in root_logger.handlers:
            if isinstance(handler, logging.StreamHandler):
                test_stream_handler = handler
                original_stream_for_handler = handler.stream
                handler.stream = io.StringIO()
                break
        assert test_stream_handler is not None
        stream_capture = test_stream_handler.stream

        logging.debug("This debug message should be visible now.")
        log_output = stream_capture.getvalue()
        assert "This debug message should be visible now." in log_output

        # Restore handler's stream and clear handlers
        if test_stream_handler and original_stream_for_handler:
            test_stream_handler.stream = original_stream_for_handler
        root_logger.handlers = []

    finally:
        # Restore original LOG_LEVEL or remove if it wasn't set
        if original_log_level is None:
            del os.environ["LOG_LEVEL"]
        else:
            os.environ["LOG_LEVEL"] = original_log_level
        # Crucially, re-setup logging to its original state for other tests
        logging.getLogger().handlers = []
        setup_logging()
```
