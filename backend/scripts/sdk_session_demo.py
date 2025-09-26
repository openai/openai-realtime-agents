import asyncio
import os

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")


async def main():
    async with httpx.AsyncClient(timeout=15) as client:
        # Create
        create_body = {"instructions": "You are helpful and concise."}
        r = await client.post(f"{BASE_URL}/api/sdk/session/create", json=create_body)
        r.raise_for_status()
        session = r.json()
        sid = session["session_id"]
        print("Session Created:", session)

        # Message
        msg_body = {"session_id": sid, "user_input": "List three colors."}
        r2 = await client.post(f"{BASE_URL}/api/sdk/session/message", json=msg_body)
        r2.raise_for_status()
        print("Turn Result:", r2.json())

        # Transcript
        r3 = await client.get(
            f"{BASE_URL}/api/sdk/session/transcript", params={"session_id": sid}
        )
        r3.raise_for_status()
        print("Transcript length:", r3.json().get("length"))


if __name__ == "__main__":
    asyncio.run(main())
