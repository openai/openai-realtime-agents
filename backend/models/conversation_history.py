from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Index
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import datetime

Base = declarative_base()

class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    user_message = Column(Text, nullable=False)
    agent_response = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index('ix_conversation_turns_session_id', 'session_id'),)

if __name__ == '__main__':
    # Example of how to create the table (for local testing/setup)
    # Replace with your actual database URL
    DATABASE_URL = "postgresql://user:password@localhost:5432/dbname"
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    print("ConversationTurn table created (if it didn't exist).")
