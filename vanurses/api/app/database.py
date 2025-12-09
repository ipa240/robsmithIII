from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from .config import get_settings

settings = get_settings()

# Production-ready connection pool for thousands of users
# QueuePool with tuned parameters for high concurrency
engine = create_engine(
    settings.database_url,
    poolclass=QueuePool,
    pool_size=20,          # Base connections in pool
    max_overflow=30,       # Additional connections when pool exhausted  
    pool_timeout=30,       # Seconds to wait for available connection
    pool_recycle=1800,     # Recycle connections after 30 minutes
    pool_pre_ping=True,    # Verify connections before use
    echo=False,            # Don't log SQL in production
)

# Add connection pool event listeners for monitoring
@event.listens_for(engine, "connect")
def connect(dbapi_conn, connection_record):
    connection_record.info['pid'] = id(dbapi_conn)

@event.listens_for(engine, "checkout")
def checkout(dbapi_conn, connection_record, connection_proxy):
    pass  # Could add logging here for monitoring

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_pool_status():
    """Get current connection pool status for monitoring"""
    return {
        "pool_size": engine.pool.size(),
        "checked_in": engine.pool.checkedin(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "invalid": engine.pool._invalidated
    }
