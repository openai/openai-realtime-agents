import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session 
from sqlalchemy.ext.declarative import declarative_base

from backend.main import DATABASE_URL 
from backend.models.conversation_history import Base as ConversationHistoryBase
from backend.models.audit_log import AuditLogBase # Import Base from audit_log model

logger = logging.getLogger(__name__)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base() # General Base, not strictly necessary if all models use their own.

def init_db():
    """
    Initializes the database by creating all tables defined by imported models.
    """
    logger.info(f"Attempting to initialize database tables.") # URL already logged in main.py
    
    try:
        # Create tables for ConversationHistory
        ConversationHistoryBase.metadata.create_all(bind=engine)
        logger.info("Tables for ConversationHistoryBase models ensured (created if not existing).")
        
        # Create tables for AuditEvent
        AuditLogBase.metadata.create_all(bind=engine)
        logger.info("Tables for AuditLogBase models ensured (created if not existing).")

    except Exception as e:
        logger.error(f"Error during init_db: {e}", exc_info=True)
        # Depending on the application's needs, you might re-raise or handle differently.
        raise # Re-raise to make it visible during startup if it fails

if __name__ == '__main__':
    print("Running database initialization script (python database.py)...")
    # To see JSON logs if running this directly, logging needs to be configured first.
    # from logging_config import setup_logging # Assuming it's in the same directory for direct run
    # setup_logging() 
    init_db()
    print("Database initialization script complete.")

def get_db() -> Session: 
    db = SessionLocal()
    try:
        yield db  
    finally:
        db.close() 
