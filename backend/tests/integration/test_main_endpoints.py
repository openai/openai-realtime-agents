import pytest
import os
from httpx import AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session 
from unittest.mock import patch

from backend.main import app as main_app
from backend.database import Base, get_db

# --- Test Database Setup (Similar to other integration tests) ---
DEFAULT_SQLITE_TEST_DB_URL = "sqlite:///./test_main_endpoints.db" 
TEST_DB_URL = os.environ.get("TEST_SUPABASE_DATABASE_URL", DEFAULT_SQLITE_TEST_DB_URL)
IS_SQLITE = TEST_DB_URL.startswith("sqlite")
engine_args = {"connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
engine = create_engine(TEST_DB_URL, **engine_args)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def override_get_db_fixture_main_endpoints():
    async def _override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    original_get_db = main_app.dependency_overrides.get(get_db)
    main_app.dependency_overrides[get_db] = _override_get_db
    yield
    if original_get_db:
        main_app.dependency_overrides[get_db] = original_get_db
    else:
        del main_app.dependency_overrides[get_db]

@pytest.fixture(scope="session")
def setup_test_db_main_endpoints(override_get_db_fixture_main_endpoints):
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def client(setup_test_db_main_endpoints): # Renamed to avoid conflicts if used elsewhere
    async with AsyncClient(app=main_app, base_url="http://test") as ac:
        yield ac

# --- Tests for Health and Readiness Endpoints ---
@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_readiness_endpoint_db_ok(client: AsyncClient):
    # This test relies on the override_get_db_fixture_main_endpoints
    # ensuring that the test database connection is working.
    response = await client.get("/readiness")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "dependencies": {"database": "ok"}}

@pytest.mark.asyncio
async def test_readiness_endpoint_db_error(client: AsyncClient):
    # To test the DB error case, we need to make the get_db dependency
    # (or rather, the db.execute call within readiness_check) raise an exception.
    
    # We can patch the `db.execute` method that will be called within the
    # `readiness_check` endpoint for the scope of this test.
    # The `get_db` dependency is already overridden to use TestingSessionLocal.
    
    # This requires knowing how `readiness_check` uses the `db` session.
    # It uses `db.execute(text("SELECT 1")).fetchone()`.
    # So, we patch `sqlalchemy.orm.Session.execute`.
    
    with patch('sqlalchemy.orm.Session.execute', side_effect=Exception("Simulated DB connection error")):
        response = await client.get("/readiness")
        assert response.status_code == 503
        response_json = response.json()
        assert response_json["detail"]["status"] == "not_ready"
        assert response_json["detail"]["dependencies"]["database"] == "error"
        assert "Simulated DB connection error" in response_json["detail"]["dependencies"]["error_message"]

@pytest.mark.asyncio
async def test_metrics_debug_endpoint(client: AsyncClient):
    # Make a few requests to generate some metrics
    await client.get("/")
    await client.get("/health")
    
    response = await client.get("/metrics-debug")
    assert response.status_code == 200
    metrics = response.json()
    assert "total_requests" in metrics
    assert "total_errors" in metrics
    assert "detailed_request_counts" in metrics
    assert metrics["total_requests"] >= 2 # At least the two above plus this one

# Note: The test_client_auth_integration fixture in test_auth_flow.py and test_rbac_flow.py
# already uses the main_app, so those tests implicitly cover middleware interaction with those endpoints.
# The tests here specifically target the health, readiness, and metrics-debug endpoints.
```
