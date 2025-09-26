import asyncio

import httpx
import pytest

BASE_URL = "http://localhost:8000"


@pytest.mark.asyncio
async def test_sdk_session_flow():
    async with httpx.AsyncClient(timeout=10) as client:
        # Create session
        create_payload = {"instructions": "You are terse."}
        r = await client.post(f"{BASE_URL}/api/sdk/session/create", json=create_payload)
        assert r.status_code == 200, r.text
        data = r.json()
        session_id = data["session_id"]
        assert session_id

        # Send message
        msg_payload = {"session_id": session_id, "user_input": "Say hi twice."}
        r2 = await client.post(f"{BASE_URL}/api/sdk/session/message", json=msg_payload)
        assert r2.status_code == 200, r2.text
        msg_data = r2.json()
        assert "final_output" in msg_data

        # Transcript
        r3 = await client.get(
            f"{BASE_URL}/api/sdk/session/transcript", params={"session_id": session_id}
        )
        assert r3.status_code == 200, r3.text
        trans = r3.json()
        assert trans["length"] >= 0
