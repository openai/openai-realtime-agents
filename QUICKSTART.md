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

## Manual reasoning modes

Choose Realtime, Terra, Sol or Astra before starting or during a call. The last selection is saved on this browser.
- Realtime: the existing native speech-to-speech behavior.
- Terra: gpt-5.6-terra; Sol: gpt-5.6-sol; Astra: gpt-6-astra through Responses API, medium reasoning.
- Voice commands: «підключи Астру», «передай Sol», «підключи Теру», «поверни Realtime»; English «switch to Astra» also works.
- Commands change the persistent mode. «Підключи Астру: поясни ...» switches and asks in one utterance.
- Commands must begin the utterance (optional «будь ласка»). Merely mentioning model names does not switch modes.
- In a reasoning mode automatic Realtime answers are disabled. The completed input transcript is routed in code to the selected model, then Realtime reads the returned answer. This adds transcription and reasoning latency.
- Up to 30 recent text turns, capped at 60,000 characters, are forwarded as context; no cross-call memory.
- Speaking again, switching modes, or ending a call cancels pending work locally and discards late answers. Provider work already performed can still incur cost.
- There is no silent fallback to another model. Failures are shown and spoken; choose another mode or repeat the question.
- OpenAI text-model charges are additional to Realtime voice charges. Astra costs more than Sol, which costs more than Terra at the verified current rates.

Validation: production build; 20 automated tests; one real Responses API answer from each of Terra, Sol and Astra.
The complete spoken switching flow still needs a real-microphone check on your phone.

## Browser tools (Playwright MCP)

Browser tools are enabled by default for Realtime, Terra, Sol and Astra. Turn off **Browser tools** before starting a call to use voice without browsing.

Try: “Відкрий example.com і прочитай заголовок” or “Знайди на сайті …”. The UI shows the actual browser action while it runs. The model receives page text and accessibility snapshots through OpenAI; the browser itself runs on this PC.

To sign in to Facebook or another site, end the voice call, click **Open browser on PC**, and log in manually in that browser window. Then start a new call. The dedicated `.browser-profile` preserves logins and is excluded from Git. It does not use your normal Chrome profile automatically. The first time this button is used, the hidden browser is restarted as a visible window; open pages may need reopening.

The app exposes navigation, snapshots, finding, clicking, typing, form filling, keyboard input, hovering, selecting, tabs and short waits. It does not expose arbitrary JavaScript, shell commands, file upload or cookie export. The agent is instructed to require explicit user authorization for sending messages, publishing, purchases or deletions. This is an instruction to the model, not a deterministic transaction approval system.

The profile is shared by this personal app; use one active browser task at a time. Ending or interrupting reasoning prevents subsequent actions; an already executed browser action cannot be rolled back. Text-model browser tasks are limited to 12 tool steps and 3 minutes per request.

Checks: `npm test`, `npm run test:browser`, `npm run build`. `node scripts/smoke-browser.mjs` performs a small paid Realtime API test against example.com using the existing local key; set `NODE_USE_SYSTEM_CA=1` if required on this PC.
