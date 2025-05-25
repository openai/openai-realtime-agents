import pytest
from fastapi import HTTPException, Request
from unittest.mock import MagicMock # For mocking Request object
from sqlalchemy.orm import Session # For mocking DB session

from backend.security import get_supabase_user, SupabaseUser, HEADER_SUPABASE_USER_ID, HEADER_SUPABASE_USER_EMAIL, HEADER_SUPABASE_USER_ROLE
from backend.services import audit_logging_service # To potentially mock log_audit_event

# Mock for the database session dependency in get_supabase_user
@pytest.fixture
def mock_db_session_for_security():
    return MagicMock(spec=Session)

@pytest.mark.asyncio
async def test_get_supabase_user_success(mock_db_session_for_security: Session):
    user_id = "test-user-id-123"
    email = "test@example.com"
    role = "authenticated"
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {
        HEADER_SUPABASE_USER_ID: user_id,
        HEADER_SUPABASE_USER_EMAIL: email,
        HEADER_SUPABASE_USER_ROLE: role
    }
    
    # Mock audit logging to prevent actual DB calls during this unit test
    with patch.object(audit_logging_service, 'log_audit_event') as mock_log_audit:
        supabase_user = await get_supabase_user(request=mock_request, db=mock_db_session_for_security)
    
    assert isinstance(supabase_user, SupabaseUser)
    assert supabase_user.id == user_id
    assert supabase_user.email == email
    assert supabase_user.role == role
    
    # Verify audit log was called for successful validation
    mock_log_audit.assert_called_once()
    args, kwargs = mock_log_audit.call_args
    assert kwargs.get("action") == "AUTH_GATEWAY_VALIDATION"
    assert kwargs.get("status") == "SUCCESS"

@pytest.mark.asyncio
async def test_get_supabase_user_missing_user_id_header(mock_db_session_for_security: Session):
    mock_request = MagicMock(spec=Request)
    mock_request.headers = { # Missing HEADER_SUPABASE_USER_ID
        HEADER_SUPABASE_USER_EMAIL: "test@example.com",
        HEADER_SUPABASE_USER_ROLE: "user"
    }
    
    with patch.object(audit_logging_service, 'log_audit_event') as mock_log_audit:
        with pytest.raises(HTTPException) as exc_info:
            await get_supabase_user(request=mock_request, db=mock_db_session_for_security)
            
    assert exc_info.value.status_code == 401
    assert "Missing or invalid user identification from gateway" in exc_info.value.detail
    
    # Verify audit log was called for failed validation
    mock_log_audit.assert_called_once()
    args, kwargs = mock_log_audit.call_args
    assert kwargs.get("action") == "AUTH_GATEWAY_VALIDATION"
    assert kwargs.get("status") == "FAILURE"
    assert f"Missing '{HEADER_SUPABASE_USER_ID}' header" in kwargs.get("details", {}).get("reason", "")

@pytest.mark.asyncio
async def test_get_supabase_user_optional_headers_missing(mock_db_session_for_security: Session):
    user_id = "test-user-only-id"
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {
        HEADER_SUPABASE_USER_ID: user_id
        # Email and Role are missing
    }
    
    with patch.object(audit_logging_service, 'log_audit_event'): # Mock audit
        supabase_user = await get_supabase_user(request=mock_request, db=mock_db_session_for_security)
        
    assert isinstance(supabase_user, SupabaseUser)
    assert supabase_user.id == user_id
    assert supabase_user.email is None
    assert supabase_user.role is None

@pytest.mark.asyncio
async def test_get_supabase_user_invalid_email_format(mock_db_session_for_security: Session):
    user_id = "test-user-invalid-email"
    # Pydantic's EmailStr will handle validation.
    # The current get_supabase_user logic passes email_str directly to SupabaseUser model,
    # so Pydantic's validation error will be raised there if email is malformed.
    # This test assumes that if an invalid email is passed, Pydantic raises a ValueError (or similar)
    # which would then result in a 500 error if not handled specifically by FastAPI's error handlers.
    # For a unit test of get_supabase_user, we are testing its logic, not Pydantic's.
    # So, we only need to ensure it passes the string to the model.
    # If the email header is present but malformed, Pydantic validation will fail during model instantiation.
    # Let's test that it correctly passes a potentially "invalid" string if it's not None.
    
    # This test can be simplified: if an invalid email string is provided,
    # `EmailStr(user_email_str)` would raise a ValueError.
    # `get_supabase_user` should ideally catch this or let FastAPI handle it.
    # For now, we'll assume it's passed and Pydantic handles it.
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {
        HEADER_SUPABASE_USER_ID: user_id,
        HEADER_SUPABASE_USER_EMAIL: "not-an-email"
    }
    
    # Pydantic's EmailStr will raise ValueError on "not-an-email"
    # The current get_supabase_user does `EmailStr(user_email_str) if user_email_str else None`
    # This will raise ValueError, which will become a 500 error unless caught by FastAPI.
    # For robustness, get_supabase_user could catch Pydantic validation errors for optional fields
    # and perhaps log them and set the field to None, or let the request fail.
    # Current implementation will let Pydantic raise an error.
    # This test is more about if the header value is passed to SupabaseUser model.
    
    with patch.object(audit_logging_service, 'log_audit_event'):
      with pytest.raises(ValueError): # Expect Pydantic's EmailStr validation to fail
          # This call will fail during `SupabaseUser(id=user_id, email=EmailStr("not-an-email"), role=None)`
          # if EmailStr validation is strict and happens at that point inside get_supabase_user.
          # Actually, `EmailStr("not-an-email")` itself raises ValueError.
          await get_supabase_user(request=mock_request, db=mock_db_session_for_security)

# To test the log_audit_event calls more deeply, one could inspect mock_log_audit.call_args.
```
