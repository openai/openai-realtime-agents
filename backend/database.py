from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session # Added Session for type hinting
from sqlalchemy.ext.declarative import declarative_base

# Import DATABASE_URL from main.py. This creates a slight coupling but is common in FastAPI.
# It ensures that the database URL is defined in one central place (main.py, typically loaded from env).
from backend.main import DATABASE_URL 

# Import the Base from your specific model files where SQLAlchemy models are defined.
# This ensures that when `init_db` is called, it knows about all tables that need to be created.
from backend.models.conversation_history import Base as ConversationHistoryBase

# Create the SQLAlchemy engine.
# The engine is the starting point for any SQLAlchemy application.
# It's configured with the database URL and connection options.
# `pool_pre_ping=True` helps manage stale connections.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Create a configured "SessionLocal" class.
# This class will be used to create individual database sessions (connections).
# `autocommit=False` and `autoflush=False` are standard FastAPI/SQLAlchemy settings.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base for declarative class definitions.
# This is a generic Base. If you have models defined directly in this file or
# for other purposes, they would inherit from this.
# However, for models in separate files (like conversation_history.py),
# they should have their own Base or import a shared one.
# For `init_db` to work correctly with models from other files,
# ensure their respective Base objects are used (e.g., ConversationHistoryBase).
Base = declarative_base() 

def init_db():
    """
    Initializes the database by creating all tables defined by imported models.
    This function should be called at application startup or via a separate script.
    It uses the metadata associated with each Base class from your models.
    """
    print(f"Attempting to initialize database tables for URL: {DATABASE_URL}")
    
    # Create tables for models inheriting from ConversationHistoryBase.
    # This assumes ConversationHistoryBase is the declarative base used by ConversationTurn model.
    try:
        ConversationHistoryBase.metadata.create_all(bind=engine)
        print("Tables for ConversationHistoryBase models created (if they didn't exist).")
    except Exception as e:
        print(f"Error creating tables for ConversationHistoryBase: {e}")

    # If you had other model groups using different Base instances, create their tables too:
    # e.g., OtherModelBase.metadata.create_all(bind=engine)
    
    # If any models were defined using the local `Base` in this file, create them:
    # Base.metadata.create_all(bind=engine)
    # print("Tables for local Base models created (if they didn't exist).")

if __name__ == '__main__':
    # This block allows running `python database.py` directly from the command line
    # to initialize the database schema. Useful for setup or migrations in development.
    print("Running database initialization script...")
    init_db()
    print("Database initialization script complete.")

# Dependency for FastAPI to get a database session.
# This function will be used in `Depends()` in API route handlers.
def get_db() -> Session: # Type hint for clarity
    """
    FastAPI dependency that provides a SQLAlchemy database session.
    It ensures that the database session is correctly opened and closed for each request.
    """
    db = SessionLocal()
    try:
        yield db  # Provide the session to the route handler.
    finally:
        db.close() # Ensure the session is closed after the request is processed.
