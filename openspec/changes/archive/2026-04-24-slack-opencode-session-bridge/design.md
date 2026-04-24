## Context

The project is a Slack Bot that currently bridges Slack messages to GitHub Copilot SDK sessions. The codebase has `SessionManager` for per-user Copilot sessions and `registerHandlers` for Slack event routing.

opencode is a separate AI coding agent that exposes an HTTP server (`opencode serve`). The `@opencode-ai/sdk` npm package provides a typed client (`createOpencodeClient`) that communicates with the running opencode server via REST and SSE. The goal is to add a parallel bridge so Slack users can interact with opencode—not just GitHub Copilot—by typing `/oc <prompt>` and then continuing the conversation in normal messages.

## Goals / Non-Goals

**Goals:**
- Add `/oc <prompt>` slash command that creates an opencode session and sends the first prompt
- Route subsequent Slack messages from the same user to their existing opencode session (if one exists)
- Return opencode's text response to the Slack thread
- Support optional HTTP Basic Auth for the opencode server via env vars

**Non-Goals:**
- Streaming/incremental opencode responses to Slack (opencode SDK `session.prompt` is synchronous—returns the full response)
- Per-user opencode server instances (one shared client, many sessions)
- Fallback between opencode and Copilot within the same session
- Slash command to explicitly close/reset the opencode session (idle timeout is out of scope for this change)

## Decisions

### OpencodeBridge class in src/opencode/bridge.ts

A new `OpencodeBridge` class wraps the `@opencode-ai/sdk` client and maintains a `Map<string, string>` of `userId → opencode sessionId`.

**Why**: Mirrors the existing `SessionManager` pattern, keeping opencode concerns isolated. Avoids polluting `handlers.ts` with session lifecycle logic.

### createOpencodeClient (client-only mode, not createOpencode)

Use `createOpencodeClient({ baseUrl })` rather than `createOpencode()` which would spawn a new server process.

**Why**: The server is expected to already be running (`opencode serve`). The bot should connect to it, not own it. `createOpencode` would attempt to start a child process, which is undesirable in a Slack Bot deployment.

### Message routing priority: opencode takes precedence over Copilot

When a user has both a Copilot session and an opencode session, the message handler routes to opencode first if `OpencodeBridge.hasSession(userId)` is true.

**Why**: `/oc` is the explicit opt-in. Once a user starts an opencode session, they expect it to receive their messages.

### /oc slash command handled in registerCommandHandlers

`registerCommandHandlers` gains an optional `opencodeBridge?: OpencodeBridge` parameter. The `/oc` branch creates a session, sends the prompt, and acks with the response.

**Why**: Consistent with how `/model` was integrated. All slash command logic lives in one function.

### OPENCODE_BASE_URL and OPENCODE_SERVER_PASSWORD in config

Two new optional env vars are read in `src/config.ts`:
- `OPENCODE_BASE_URL` (default: `http://localhost:4096`)
- `OPENCODE_SERVER_PASSWORD` (optional, triggers Basic Auth header injection)

**Why**: Keeps all runtime configuration in the existing config module.

## Risks / Trade-offs

- [Risk] opencode server is unavailable when `/oc` is called → `createOpencodeClient` does not auto-start a server. `session.create()` or `session.prompt()` will throw. **Mitigation**: Catch errors in the slash command handler and reply with a user-friendly error message.
- [Risk] Long-running opencode prompts block the Slack ack timeout (3 seconds). **Mitigation**: Ack immediately with a "processing…" message, then send the actual response as a follow-up `chat.postMessage` to the thread. Use `prompt_async` endpoint if needed.
- [Risk] `@opencode-ai/sdk` may not be published on npm yet. **Mitigation**: Check npm availability; if unavailable, implement direct HTTP calls to the opencode REST API as fallback.
