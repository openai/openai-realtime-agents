import os
from fastapi import Security, HTTPException, status, Request # Added Request
from fastapi.security.api_key import APIKeyHeader 
from dotenv import load_dotenv

# Load environment variables from a .env file if it exists.
# This is useful for local development.
load_dotenv() 

# Define the name of the HTTP header that the Supabase Edge Function will add
# after successfully authenticating the original X-API-KEY.
FORWARDED_AUTH_HEADER_NAME = "X-Forwarded-Auth-Status"
EXPECTED_AUTH_STATUS_VALUE = "success"

# This dependency will extract the X-Forwarded-Auth-Status header.
# We are not using APIKeyHeader directly for this as the semantic meaning is different.
# Instead, we'll read it directly from the Request object's headers.
async def get_forwarded_auth_status(request: Request):
    """
    FastAPI dependency function to validate the X-Forwarded-Auth-Status header
    set by the Supabase Edge Function.

    This function is injected into API route handlers that require authentication
    when the system is configured to use an Edge Function as the auth gateway.

    Args:
        request (Request): The incoming FastAPI request object.

    Raises:
        HTTPException (403 Forbidden): If the X-Forwarded-Auth-Status header is missing or invalid,
                                     indicating the request did not come through the authenticated path
                                     or authentication failed at the edge.
    Returns:
        str: The validated auth status (typically "success").
    """
    auth_status = request.headers.get(FORWARDED_AUTH_HEADER_NAME)

    if not auth_status:
        # Header is missing, meaning the request likely bypassed the Edge Function or it failed before setting it.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Missing authentication header '{FORWARDED_AUTH_HEADER_NAME}'. Requests must go through the auth gateway."
        )
    
    if auth_status == EXPECTED_AUTH_STATUS_VALUE:
        # Authentication status is valid.
        return auth_status
    else:
        # Header is present but has an unexpected value.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, # Or 401 if we consider this an auth failure passed through
            detail=f"Forbidden: Invalid authentication status in '{FORWARDED_AUTH_HEADER_NAME}'."
        )

# Note: The original EXPECTED_API_KEY logic is removed from here as that validation
# is now expected to be handled by the Supabase Edge Function.
# If the FastAPI backend still needs to know the original API key for some reason
# (e.g., for logging or associating with a user, though not for auth itself),
# the Edge Function could be designed to pass it in another secure header.
# For this subtask, we assume the backend only needs to know if auth succeeded at the edge.

if __name__ == '__main__':
    # This block is for demonstration or conceptual testing if needed.
    # Direct testing of `get_forwarded_auth_status` requires mocking a FastAPI Request object.
    print(f"FastAPI backend expects header '{FORWARDED_AUTH_HEADER_NAME}: {EXPECTED_AUTH_STATUS_VALUE}' for authenticated requests.")
    # Example (conceptual):
    # class MockHeader:
    #     def __init__(self, headers):
    #         self._headers = headers
    #     def get(self, key):
    #         return self._headers.get(key)

    # class MockRequest:
    #     def __init__(self, headers_dict):
    #         self.headers = MockHeader(headers_dict)

    # async def _test_auth_status():
    #     try:
    #         req_valid = MockRequest({FORWARDED_AUTH_HEADER_NAME: EXPECTED_AUTH_STATUS_VALUE})
    #         status_valid = await get_forwarded_auth_status(req_valid)
    #         print(f"Test with valid header passed, status: {status_valid}")
    #     except HTTPException as e:
    #         print(f"Test with valid header failed: {e.detail}")

    #     try:
    #         req_missing = MockRequest({})
    #         await get_forwarded_auth_status(req_missing)
    #         print("Test with missing header failed (no exception).")
    #     except HTTPException as e:
    #         print(f"Test with missing header passed: {e.detail}")

    #     try:
    #         req_invalid = MockRequest({FORWARDED_AUTH_HEADER_NAME: "failed"})
    #         await get_forwarded_auth_status(req_invalid)
    #         print("Test with invalid header value failed (no exception).")
    #     except HTTPException as e:
    #         print(f"Test with invalid header value passed: {e.detail}")
            
    # import asyncio
    # asyncio.run(_test_auth_status())
