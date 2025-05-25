import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session
import uuid
import datetime

from backend.services.audit_logging_service import log_audit_event
from backend.models.audit_log import AuditEvent # To check instance type
from backend.security import SupabaseUser # For mock user

@pytest.fixture
def mock_db_session_for_audit():
    session = MagicMock(spec=Session)
    return session

def test_log_audit_event_with_all_fields(mock_db_session_for_audit: Session):
    mock_user = SupabaseUser(id="user-audit-test-123", email="audit@example.com", role="admin")
    action = "TEST_ACTION_FULL"
    status = "SUCCESS"
    resource_type = "test_resource"
    resource_id = "res_789"
    details = {"key1": "value1", "numeric_key": 123}

    log_audit_event(
        db=mock_db_session_for_audit,
        user=mock_user,
        action=action,
        status=status,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details
    )

    mock_db_session_for_audit.add.assert_called_once()
    added_event = mock_db_session_for_audit.add.call_args[0][0]
    
    assert isinstance(added_event, AuditEvent)
    assert added_event.user_id == mock_user.id
    assert added_event.user_role == mock_user.role
    assert added_event.action == action
    assert added_event.status == status
    assert added_event.resource_type == resource_type
    assert added_event.resource_id == resource_id
    assert added_event.details == details
    # id and timestamp are auto-generated, so we don't check their specific values here
    # unless we want to mock uuid.uuid4 and datetime.datetime.now

    mock_db_session_for_audit.commit.assert_called_once()

def test_log_audit_event_minimal_fields(mock_db_session_for_audit: Session):
    action = "TEST_ACTION_MINIMAL"
    status = "FAILURE"

    log_audit_event(
        db=mock_db_session_for_audit,
        action=action,
        status=status
        # All other fields are optional
    )

    mock_db_session_for_audit.add.assert_called_once()
    added_event = mock_db_session_for_audit.add.call_args[0][0]
    
    assert isinstance(added_event, AuditEvent)
    assert added_event.user_id is None
    assert added_event.user_role is None
    assert added_event.action == action
    assert added_event.status == status
    assert added_event.resource_type is None
    assert added_event.resource_id is None
    assert added_event.details is None
    
    mock_db_session_for_audit.commit.assert_called_once()

def test_log_audit_event_no_user(mock_db_session_for_audit: Session):
    log_audit_event(
        db=mock_db_session_for_audit,
        action="SYSTEM_ACTION",
        status="SUCCESS",
        user=None # Explicitly None
    )
    mock_db_session_for_audit.add.assert_called_once()
    added_event = mock_db_session_for_audit.add.call_args[0][0]
    assert added_event.user_id is None
    assert added_event.user_role is None

@patch('backend.services.audit_logging_service.logger.error') # Patch the logger inside the module
def test_log_audit_event_db_commit_exception(mock_logger_error: MagicMock, mock_db_session_for_audit: Session):
    mock_db_session_for_audit.commit.side_effect = Exception("DB commit failed")
    
    mock_user = SupabaseUser(id="user-fail-commit", email="fail@example.com", role="user")
    action = "ACTION_DB_FAIL"
    status = "SUCCESS_PRE_COMMIT" # Status before commit failed

    log_audit_event(
        db=mock_db_session_for_audit,
        user=mock_user,
        action=action,
        status=status
    )
    
    mock_db_session_for_audit.add.assert_called_once() # Add should still be called
    mock_logger_error.assert_called_once()
    args, kwargs = mock_logger_error.call_args
    assert f"Failed to log audit event: Action='{action}', Status='{status}'" in args[0]
    assert "DB commit failed" in str(kwargs.get("exc_info"))

# Test that default UUID and timestamp are generated if not provided (conceptual)
# This is harder to test directly without more complex mocking of uuid.uuid4 and datetime.now
# or by inspecting the object before commit, but SQLAlchemy handles these defaults.
# We can trust the model definition for this part in unit tests of the logging function.
```
