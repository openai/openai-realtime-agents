# Vinson Voice

Mobile-first voice-only app adapted from openai/openai-realtime-agents (MIT).
Original customer-service agents and tool endpoints have been removed.

## First call

1. On your PC, add your OpenAI API key to `.env.local`. Never put it in chat or a NEXT_PUBLIC variable.
2. Run `./Start-Voice.ps1`. After editing the key, run `./Stop-Voice.ps1` then start again.
3. Keep this PC awake and connected to the internet.
4. On the phone, enable Tailscale and open https://desktop-qs57858.tail78449b.ts.net .
5. Tap Start conversation and allow the microphone. Ukrainian is the default; English is available.

Local address: http://localhost:3210 . The Next server binds to loopback only.
Tailscale Serve supplies private HTTPS; no public Funnel or router port forwarding.

## Development

Node 24+, `npm ci`, `npm run dev`.
Production: `npm run build`, then `npm start` or the PowerShell launcher.
Tests: `npm test`; with server running, `npm run test:browser`.
Install the test browser once with `npx playwright install chromium`.
The lockfile pins the installed dependencies.

## Voice behavior

Speech-to-speech via OpenAI Realtime WebRTC, semantic turn detection, automatic interruptions,
mute, end/cancel call, transcript in memory, optional screen wake lock.
Only voice/language preferences are saved in this browser. Transcripts disappear on reload/new call.
No microphone before Start. End closes the connection and releases the microphone.
No automatic redial: a new call starts new context.
The keep-awake option applies only while the page is visible; it does not grant background privileges.

## Phone acceptance test (still required)

Test 15 minutes on the actual phone: Ukrainian, natural pauses, interruption, Bluetooth/car mic,
navigation in foreground, locking/unlocking the phone, Wi-Fi to cellular, incoming calls, reconnect.
Background microphone operation is browser/OS-dependent. Do not treat this web version as verified
for screen-locked conversations until this passes. A native client remains an option if it fails.

## Configuration

`REALTIME_MODEL` defaults to `gpt-realtime-2.1`; model availability depends on your API account.
`APP_ORIGIN` must exactly match your private HTTPS address (no trailing slash).
The backend creates short-lived credentials through OpenAI's client_secrets API.
Your main API key stays on the PC. Audio goes directly between phone and OpenAI.
The app is restricted to your tailnet; origin validation rejects cross-site credential requests.
API billing is separate from ChatGPT subscriptions.

## Next phase

Add an MCP client to the PC backend and expose selected tools to the Realtime session.
No MCP, browser automation, or external action tools are enabled in this version.
Logs contain server operational messages; do not add keys/transcripts to logs.

## Stop / private access

Stop app: `./Stop-Voice.ps1`.
Disable only its Tailscale route: `tailscale serve --https=443 off`.
Do not use serve reset if you later add other routes.
