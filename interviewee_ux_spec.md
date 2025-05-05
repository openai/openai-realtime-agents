# Interviewee UX – Proof of Concept Specification

_Last updated: {{DATE}}_

## 1. Access & Security

| Item | Decision |
|------|----------|
| Link format | `https://<domain>/i/{invite_token}` – token in path segment |
| Auth | Route `/i/*` and `/app?candidate=1` exempt from auth middleware |
| Token validity | Link works as long as associated interview status is **not** `completed` |
| Re-use | Multiple openings allowed until marked completed |
| Expiration | none for POC |

## 2. Entry Flow
1. Candidate clicks the invite link (`/i/{token}`).
2. Server resolves `invite_token` → `interview.id`.
3. If interview status is `completed`: redirect → `/invite-completed` (future page).  
   If token not found: redirect → `/invite-not-found` (future page).
4. Otherwise, redirect → `/app?interviewId={id}&candidate=1`.

_No additional onboarding or mic-check screens for POC._

## 3. Candidate UI inside `/app`

| Element | Behaviour / Notes |
|---------|-------------------|
| Header | Minimal: "Interview Session" + product logo. No scenario/agent selectors. |
| Main area | `InterviewExperience` component reused. Shows:<br>• Current question (medium size, centred left column)<br>• Progress text: "Question N of M"<br>• Horizontal progress bar<br>• Audio-wave visualisation canvas below<br>• Status pill (Live/Connecting) |
| Agent state indicator | `Agent is speaking…` (green pulse) vs `Agent is listening…` (grey) |
| Transcript & Events panes | **Hidden** in candidate view |
| Bottom toolbar | Temporarily left visible for dev controls; will be hidden in prod. |
| Typing fallback | Not implemented for POC |

## 4. Completion & Thank-You

Trigger: Client detects assistant's **final** message + session disconnect → sets `sessionStatus = DISCONNECTED`.

Action:
* After 500 ms debounce, if `isCandidateView && isInterviewMode && sessionStatus === DISCONNECTED` → `router.push("/i/thank-you")`.

### Thank-You screen (`/i/thank-you`)
* Large headline: "Thank you for your time!"
* Sub-text: "You may now close this tab or return to Volta."
* Button `Return to Volta` → `https://voltaeffect.com` (opens new tab)
* No other navigation.
* Refreshing this page keeps the user on thank-you screen (static route).

## 5. Edge Cases / Out-of-Scope
* Mic permission failures → **not** handled (risk accepted).
* Session resume after refresh during interview → deferred.
* One-time / time-limited tokens → deferred.
* Manual "Finish" button for candidate → deferred.
* Legal/privacy blurb → delivered verbally by AI, no UI display for POC.

## 6. Implementation Notes
* `middleware.ts` updated: public routes `/i` & `/app` bypass auth.
* `/i/[token]/page.tsx` handles token resolution & redirect logic.
* Candidate mode detected via query param `candidate=1`.
* UI conditional logic in `App.tsx`:
  * Hides transcript/events
  * Hides bottom toolbar once ready for prod
  * Tracks agent-speaking state via transcript items
* Thank-You page implemented at `src/app/i/thank-you/page.tsx`.

---
**Ready for developer hand-off.** 