## Context

The Slack bot currently echoes messages back to the user. The goal is to replace the echo with a real AI response by forwarding each Slack message to a GitHub Copilot session via `@github/copilot-sdk` and posting the reply back to Slack.

The SDK works by spawning a local Copilot CLI process and communicating over JSON-RPC (stdio or TCP). A `CopilotClient` manages the process; `CopilotSession` objects represent individual conversation threads. Sessions persist across messages so Copilot retains context.

Current constraint: the project uses `@slack/socket-mode` 2.x with `SocketModeClient.on('message', ...)` events in `src/handlers.ts`. The Copilot integration must fit inside these existing event handlers.

## Goals / Non-Goals

**Goals:**

- One persistent `CopilotClient` per bot process (start at boot, stop at shutdown)
- One `CopilotSession` per Slack user (keyed by `event.user`) — preserves per-user conversation context across messages
- Slack message text forwarded to Copilot via `session.sendAndWait()`
- Copilot response posted back to Slack in the original message's thread
- Sessions idle-cleaned after a configurable timeout (default 30 min) to free resources
- `GITHUB_TOKEN` env var passed to `CopilotClient` for authentication
- Bot messages and empty messages ignored (no Copilot call)

**Non-Goals:**

- Multi-turn streaming to Slack (full response posted at once, not token-by-token)
- Image / file attachment forwarding to Copilot
- Per-channel (as opposed to per-user) sessions
- Slash command routing through Copilot
- `app_mention` routing through Copilot (keeps current simple reply)
- Custom tools or system-message customisation at this stage
- Supporting HTTP mode handlers (only Socket Mode is wired up)

## Decisions

### Single CopilotClient shared across all Slack events

**Choice:** Create one `CopilotClient` at startup and share it across all message handlers.

**Rationale:** The SDK spawns a CLI sub-process; spawning one per message would be prohibitively expensive. A singleton matches the Slack bot's single-process lifecycle.

**Alternative rejected:** One client per session — unnecessary overhead; sessions are lightweight.

### Session keyed by Slack user ID

**Choice:** `SessionManager` maintains a `Map<slackUserId, CopilotSession>` and creates a new session on first message from a user.

**Rationale:** Each user should have independent conversation context. Channel-keyed sessions would mix all users into one context.

**Alternative rejected:** New session per message — loses Copilot conversation memory.

### Idle session cleanup

**Choice:** After each reply, schedule a `setTimeout` to call `session.disconnect()` after `SESSION_IDLE_TIMEOUT_MS` (default 1 800 000 ms = 30 min). A new message from the same user resets the timer.

**Rationale:** Copilot sessions hold CLI process state; leaving unlimited open sessions is a resource leak.

### sendAndWait for simplicity

**Choice:** Use `session.sendAndWait({ prompt })` and post `reply?.data.content` to Slack.

**Rationale:** Simpler than manually wiring `session.on('assistant.message')` + `session.on('session.idle')`. Full streaming to Slack would require incremental `chat.update` calls — unnecessary complexity for v1.

**Alternative rejected:** Streaming via `assistant.message_delta` + `chat.update` — deferred to a future change.

### CopilotClient placed in src/copilot/

**Choice:** Two new files: `src/copilot/client.ts` (singleton wrapper) and `src/copilot/session-manager.ts` (user-to-session map + idle cleanup).

**Rationale:** Keeps Copilot logic isolated from Slack event handling; `handlers.ts` only calls `SessionManager.getOrCreate(userId)` then forwards to Copilot.

## Risks / Trade-offs

- [Risk] Copilot CLI not installed on host → `CopilotClient.start()` throws at boot → **Mitigation:** log a clear error and fall back to echo mode (skip Copilot forwarding) if `GITHUB_TOKEN` is not set or CLI start fails
- [Risk] `sendAndWait()` has no built-in timeout → hangs indefinitely if CLI is unresponsive → **Mitigation:** wrap with `Promise.race()` against a 60-second timeout; on timeout, post an error message to Slack and reset the session
- [Risk] Copilot session state grows unbounded on long conversations → **Mitigation:** rely on SDK's built-in infinite-session compaction (enabled by default)
- [Risk] Slack rate limits on `chat.postMessage` → **Mitigation:** existing `WebClient` handles retry; no special action needed for v1

## Migration Plan

1. Add `@github/copilot-sdk` dependency (`pnpm add @github/copilot-sdk`)
2. Add `GITHUB_TOKEN` to `.env.example` and `src/config.ts`
3. Create `src/copilot/client.ts` and `src/copilot/session-manager.ts`
4. Update `src/handlers.ts` message handler to call `SessionManager`
5. Update `src/index.ts` to start/stop `CopilotClient`
6. Run `pnpm run build` — fix type errors
7. Local test: set `GITHUB_TOKEN` and run `pnpm run dev`; send a Slack message, verify Copilot reply appears

**Rollback:** Remove `GITHUB_TOKEN` from env → bot falls back to echo mode (guarded by `if (!copilotClient)` check).
