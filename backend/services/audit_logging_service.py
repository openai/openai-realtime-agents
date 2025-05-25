import logging
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from backend.models.audit_log import AuditEvent
from backend.security import SupabaseUser # For user details

logger = logging.getLogger(__name__)

def log_audit_event(
    db: Session, 
    action: str, 
    status: str,
    user: Optional[SupabaseUser] = None, 
    resource_type: Optional[str] = None, 
    resource_id: Optional[str] = None, 
    details: Optional[Dict[str, Any]] = None
):
    """
    Creates and saves an audit event to the database.

    Args:
        db: SQLAlchemy database session.
        action: A string describing the action being audited (e.g., "USER_LOGIN", "TOOL_CALL").
        status: The outcome of the action (e.g., "SUCCESS", "FAILURE", "FORBIDDEN").
        user: Optional SupabaseUser object representing the user performing the action.
        resource_type: Optional string identifying the type of resource involved (e.g., "tool", "endpoint").
        resource_id: Optional string identifying the specific resource instance.
        details: Optional dictionary for any additional structured data related to the event.
    """
    try:
        audit_entry = AuditEvent(
            user_id=user.id if user else None,
            user_role=user.role if user else None,
            action=action,
            status=status,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details
        )
        db.add(audit_entry)
        db.commit()
        # db.refresh(audit_entry) # Not strictly necessary unless you need the generated ID/timestamp immediately
        logger.debug(f"Audit event logged: Action='{action}', Status='{status}'", 
                     extra={
                         "audit_action": action, "audit_status": status, 
                         "audit_user_id": user.id if user else None,
                         "audit_resource_type": resource_type, "audit_resource_id": resource_id
                     })
    except Exception as e:
        logger.error(f"Failed to log audit event: Action='{action}', Status='{status}'. Error: {e}", 
                     exc_info=True, 
                     extra={
                         "audit_action": action, "audit_status": status,
                         "audit_user_id": user.id if user else None
                     })
        # Depending on policy, you might want to rollback the session if the audit log fails,
        # or handle it as a non-critical error. For now, just logging.

if __name__ == '__main__':
    # This block is for conceptual demonstration.
    # To run this, you'd need a DB session and a SupabaseUser object.
    print("AuditLoggingService defined. Example usage (conceptual):")
    
    # from backend.database import SessionLocal # Assuming SessionLocal is your session factory
    # from backend.security import SupabaseUser
    
    # def example_usage():
    #     db_session = SessionLocal()
    #     mock_user = SupabaseUser(id="user-test-123", email="test@example.com", role="admin")
        
    #     try:
    #         # Example: Successful tool call
    #         log_audit_event(
    #             db=db_session,
    #             user=mock_user,
    #             action="MCP_TOOL_INVOKED",
    #             status="SUCCESS",
    #             resource_type="tool",
    #             resource_id="calculator_tool",
    #             details={"inputs": {"expression": "2+2"}, "output": {"result": 4}}
    #         )
            
    #         # Example: Failed login attempt (user would be None or details of attempt)
    #         log_audit_event(
    #             db=db_session,
    #             user=None, # Or SupabaseUser(id="unknown_user_trying_login")
    #             action="USER_LOGIN_ATTEMPT",
    #             status="FAILURE",
    #             resource_type="endpoint",
    #             resource_id="/auth/login", # Fictional endpoint
    #             details={"reason": "Invalid credentials", "ip_address": "192.168.1.100"}
    #         )
            
    #         print("Example audit events logged (check your database or logs if setup_logging was called).")
            
    #     finally:
    #         db_session.close()

    # if __name__ == '__main__':
    #     # Configure logging to see output if running this file directly
    #     # import sys
    #     # sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    #     # from logging_config import setup_logging
    #     # setup_logging()
        
    #     # example_usage()
    #     pass
    print("To test, call log_audit_event within the application context with a DB session.")
```
