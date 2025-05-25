import uuid
import datetime
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID # For PostgreSQL specific UUID type
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func # For server-side default timestamp

# It's good practice to use a shared Base if your models are in multiple files
# and you want them managed under a single metadata object.
# If database.py already has a Base = declarative_base(), consider importing and using that.
# For simplicity here, if this is the only model file outside conversation_history.py
# using its own Base is fine, but ensure init_db() knows about it.
# Let's assume we might add more models later and use a common Base from database.py eventually.
# For now, this is self-contained for the audit log.
AuditLogBase = declarative_base()

class AuditEvent(AuditLogBase):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # User information (nullable if system action or unauthenticated)
    user_id = Column(String, nullable=True, index=True)
    user_role = Column(String, nullable=True)
    
    action = Column(String, nullable=False, index=True) # e.g., "USER_LOGIN", "TOOL_CALL_INITIATED"
    
    # Resource context (optional)
    resource_type = Column(String, nullable=True) # e.g., "tool", "agent_session", "endpoint"
    resource_id = Column(String, nullable=True)   # e.g., "calculator_tool", session_id, "/ag-ui/events"
    
    status = Column(String, nullable=False) # e.g., "SUCCESS", "FAILURE", "PENDING", "FORBIDDEN"
    
    # Additional details specific to the event
    details = Column(JSON, nullable=True) # Can store arbitrary JSON data

    def __repr__(self):
        return (f"<AuditEvent(id={self.id}, timestamp='{self.timestamp}', user_id='{self.user_id}', "
                f"action='{self.action}', status='{self.status}', resource_type='{self.resource_type}', "
                f"resource_id='{self.resource_id}')>")

if __name__ == '__main__':
    # This block is for demonstration or for direct schema creation if not using Alembic/application startup.
    # To create this table, you'd typically run this through your database initialization logic.
    print("AuditLog model defined. To create table, ensure this model's Base is included in init_db().")
    
    # Example of creating an instance (not saved to DB here)
    event_data = {
        "user_id": "user-123",
        "user_role": "admin",
        "action": "TOOL_CALL_INITIATED",
        "resource_type": "tool",
        "resource_id": "calculator_tool",
        "status": "SUCCESS",
        "details": {"input_expression": "2+2"}
    }
    # Note: 'id' and 'timestamp' have defaults, so not needed for manual instantiation unless overriding.
    # audit_event = AuditEvent(**event_data)
    # print(f"\nExample AuditEvent instance (not saved):\n{audit_event}")
    # print(f"  ID: {audit_event.id}") # Would be None unless default_factory called or set
    # print(f"  Timestamp: {audit_event.timestamp}") # Would be None unless server_default used or set
```
