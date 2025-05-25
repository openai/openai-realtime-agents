import logging
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.orm import Session # For DB session in audit logging
from pydantic import BaseModel, EmailStr, Field 
from typing import Optional

from backend.database import get_db # Import get_db for audit logging
from backend.services.audit_logging_service import log_audit_event # Import audit logging utility

logger = logging.getLogger(__name__)

class SupabaseUser(BaseModel):
    id: str = Field(..., description="User ID from Supabase JWT.")
    email: Optional[EmailStr] = Field(None, description="User email from Supabase JWT (if available).")
    role: Optional[str] = Field(None, description="User role from Supabase JWT (if available, e.g., 'authenticated', 'service_role').")
    class Config:
        extra = "ignore" 

HEADER_SUPABASE_USER_ID = "x-supabase-user-id"
HEADER_SUPABASE_USER_EMAIL = "x-supabase-user-email"
HEADER_SUPABASE_USER_ROLE = "x-supabase-user-role" 

async def get_supabase_user(request: Request, db: Session = Depends(get_db)) -> SupabaseUser: # Inject db session
    user_id = request.headers.get(HEADER_SUPABASE_USER_ID)
    user_email_str = request.headers.get(HEADER_SUPABASE_USER_EMAIL)
    user_role = request.headers.get(HEADER_SUPABASE_USER_ROLE)

    audit_details = {
        "method": request.method,
        "path": request.url.path,
        "client_host": request.client.host if request.client else "Unknown",
        "provided_user_id_header": bool(user_id),
        "provided_user_email_header": bool(user_email_str),
        "provided_user_role_header": bool(user_role),
    }

    if not user_id:
        logger.warning(
            f"Authentication failed: Missing '{HEADER_SUPABASE_USER_ID}' header. "
            "Request may not have passed through the Supabase auth gateway or JWT validation failed there.",
            extra=audit_details
        )
        # Log failed authentication attempt
        log_audit_event(
            db=db, user=None, action="AUTH_GATEWAY_VALIDATION", status="FAILURE",
            resource_type="endpoint", resource_id=request.url.path,
            details={**audit_details, "reason": f"Missing '{HEADER_SUPABASE_USER_ID}' header"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Not authenticated: Missing or invalid user identification from gateway. Please ensure requests are authenticated and route via the API gateway."
        )
    
    user_email = EmailStr(user_email_str) if user_email_str else None
    
    # Create SupabaseUser instance for audit logging context as well
    user_for_audit = SupabaseUser(id=user_id, email=user_email, role=user_role)

    logger.debug(
        f"Authenticated user via gateway: ID='{user_id}', Email='{user_email}', Role='{user_role}'", 
        extra={"user_id": user_id, "user_email": user_email, "user_role": user_role, "path": request.url.path}
    )
    # Log successful "authentication" (header validation) by the backend
    log_audit_event(
        db=db, user=user_for_audit, action="AUTH_GATEWAY_VALIDATION", status="SUCCESS",
        resource_type="endpoint", resource_id=request.url.path,
        details=audit_details # Contains info about which headers were present
    )

    return SupabaseUser(id=user_id, email=user_email, role=user_role)

if __name__ == '__main__':
    print("--- SupabaseUser Pydantic Model Example ---")
    user_data_example = {"id": "user-uuid-from-jwt-12345", "email": "user@example.com", "role": "authenticated"}
    try:
        user_model_instance = SupabaseUser(**user_data_example)
        print("Instance created successfully:"); print(user_model_instance.json(indent=2))
    except Exception as e:
        print(f"Error creating SupabaseUser model instance: {e}")

    print(f"\nFastAPI backend, using the 'get_supabase_user' dependency, expects the following headers to be set by the auth gateway (e.g., Supabase Edge Function):")
    print(f"- '{HEADER_SUPABASE_USER_ID}': <user_id_from_jwt>")
    print(f"- '{HEADER_SUPABASE_USER_EMAIL}': <user_email_from_jwt> (optional, will be validated if present)")
    print(f"- '{HEADER_SUPABASE_USER_ROLE}': <user_role_from_jwt> (optional)")
```
