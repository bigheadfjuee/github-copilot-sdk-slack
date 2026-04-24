## Why

Users want to chat with GitHub Copilot directly from Slack. By bridging the Slack bot with `@github/copilot-sdk`, every Slack message can be forwarded to a Copilot session and the AI response streamed back to the channel as a threaded reply — no browser or IDE required.

## What Changes

- Add `@github/copilot-sdk` as a direct dependency
- Create `src/copilot/client.ts` — singleton `CopilotClient` lifecycle manager (start / stop / get-or-create session per Slack user or channel)
- Create `src/copilot/session-manager.ts` — maps Slack user/channel IDs to persistent `CopilotSession` instances with idle cleanup
- Replace the current echo handler in `src/handlers.ts` with a Copilot-forwarding handler that: (1) calls `session.sendAndWait()` with the Slack message text, (2) posts the `assistant.message` content back as a Slack threaded reply
- Add `GITHUB_TOKEN` env var to `src/config.ts` for Copilot authentication
- Update `src/index.ts` to start/stop the `CopilotClient` alongside the Slack connection

## Capabilities

### New Capabilities

- `copilot-session-bridge`: Manages CopilotClient lifecycle and per-user CopilotSession mapping; routes Slack messages to Copilot and returns responses

### Modified Capabilities

(none)

## Impact

- New dependency: `@github/copilot-sdk`
- New files: `src/copilot/client.ts`, `src/copilot/session-manager.ts`
- Modified files: `src/handlers.ts`, `src/config.ts`, `src/index.ts`
- New env var required: `GITHUB_TOKEN`
