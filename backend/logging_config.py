import logging
import sys
import os
from python_json_logger import jsonlogger

def setup_logging():
    """
    Configures structured JSON logging for the application.
    Outputs logs to stdout with a default level of INFO, configurable
    via the LOG_LEVEL environment variable.
    """
    log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Get the root logger
    logger = logging.getLogger()
    
    # Remove any existing handlers to avoid duplicate logs if this function is called multiple times
    # or if other libraries (like Uvicorn) have already set up handlers.
    # This is important especially if Uvicorn's default logging is also active.
    if logger.hasHandlers():
        logger.handlers.clear()
        
    # Add a stream handler to output to stdout
    log_handler = logging.StreamHandler(sys.stdout)
    
    # Define the format for the JSON logs
    # Standard fields: timestamp, levelname, message
    # Additional fields: module, funcName, lineno for context
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(message)s %(module)s %(funcName)s %(lineno)d",
        rename_fields={"asctime": "timestamp", "levelname": "level"} # Optional: rename fields
    )
    
    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)
    logger.setLevel(log_level)

    # Test log message
    # logging.getLogger(__name__).info("Structured JSON logging configured.", extra={"log_level_set": log_level_str})

if __name__ == '__main__':
    # Example of how to use it:
    setup_logging()
    
    # Get a logger for a specific module
    logger_example = logging.getLogger("example_module")
    
    logger_example.info("This is an info message from example_module.")
    logger_example.warning("This is a warning message.", extra={"custom_field": "custom_value"})
    try:
        1 / 0
    except ZeroDivisionError:
        logger_example.error("A division by zero error occurred.", exc_info=True) # exc_info=True adds exception info
    
    logging.info("This is a root logger info message.") # Using the root logger directly
    # Output should be JSON formatted lines to stdout.
    # Example:
    # {"timestamp": "2023-10-27T10:00:00.123Z", "level": "INFO", "message": "This is an info message from example_module.", "module": "logging_config", "funcName": "<module>", "lineno": 40}
    # {"timestamp": "2023-10-27T10:00:00.124Z", "level": "WARNING", "message": "This is a warning message.", "module": "logging_config", "funcName": "<module>", "lineno": 41, "custom_field": "custom_value"}
    # {"timestamp": "2023-10-27T10:00:00.125Z", "level": "ERROR", "message": "A division by zero error occurred.", "module": "logging_config", "funcName": "<module>", "lineno": 44, "exc_info": "Traceback (most recent call last):\n  File \"...\", line 42, in <module>\n    1 / 0\nZeroDivisionError: division by zero"}
