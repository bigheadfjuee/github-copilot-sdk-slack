## ADDED Requirements

### Requirement: CopilotClient singleton lifecycle

The bot process SHALL create exactly one `CopilotClient` instance at startup (using `GITHUB_TOKEN` env var for authentication) and stop it on graceful shutdown. If `GITHUB_TOKEN` is absent or `CopilotClient.start()` throws, the system SHALL log a warning and continue in echo mode without Copilot integration.

#### Scenario: Successful startup with GITHUB_TOKEN

- **WHEN** `GITHUB_TOKEN` is set in the environment
- **THEN** `CopilotClient` SHALL be started before the Slack connection begins accepting messages

#### Scenario: Missing GITHUB_TOKEN falls back to echo mode

- **WHEN** `GITHUB_TOKEN` is not set
- **THEN** the bot SHALL log a warning and skip Copilot initialization, falling back to echo behavior for all messages

#### Scenario: CopilotClient.start() failure falls back to echo mode

- **WHEN** `CopilotClient.start()` throws an error (e.g., CLI not installed)
- **THEN** the bot SHALL log the error and continue in echo mode without crashing

#### Scenario: Graceful shutdown stops CopilotClient

- **WHEN** the process receives `SIGTERM` or `SIGINT`
- **THEN** `CopilotClient.stop()` SHALL be called before the process exits

### Requirement: Per-user CopilotSession mapping

`SessionManager` SHALL maintain a `Map<string, CopilotSession>` keyed by Slack user ID. On the first message from a user, `SessionManager` SHALL call `client.createSession({ onPermissionRequest: approveAll })` and cache the result. Subsequent messages from the same user SHALL reuse the cached session.

#### Scenario: First message from user creates a new session

- **WHEN** a Slack message arrives from a user ID with no existing session
- **THEN** `SessionManager` SHALL call `client.createSession()` and cache the returned `CopilotSession` under that user ID

#### Scenario: Second message from same user reuses existing session

- **WHEN** a second Slack message arrives from the same user ID
- **THEN** `SessionManager` SHALL return the cached `CopilotSession` without calling `createSession()` again

### Requirement: Message forwarding to Copilot with reply

The message handler in `src/handlers.ts` SHALL, for each non-bot Slack message with non-empty text, call `session.sendAndWait({ prompt: event.text })` and post `reply.data.content` back to Slack via `webClient.chat.postMessage` in the originating thread. If `sendAndWait` does not resolve within 60 seconds, the handler SHALL post an error message to Slack and call `sessionManager.resetSession(userId)` to discard the hung session.

#### Scenario: Successful Copilot reply

- **WHEN** a non-bot Slack message arrives with non-empty text
- **THEN** the handler SHALL post the Copilot `assistant.message` content as a threaded reply in the same Slack channel within 60 seconds

#### Scenario: Bot messages are ignored

- **WHEN** a Slack message has `event.bot_id` set
- **THEN** the handler SHALL NOT forward the message to Copilot

#### Scenario: Empty message is ignored

- **WHEN** a Slack message has empty or whitespace-only text
- **THEN** the handler SHALL NOT forward the message to Copilot

#### Scenario: sendAndWait timeout

- **WHEN** `session.sendAndWait()` does not resolve within 60 000 ms
- **THEN** the handler SHALL post `"Copilot did not respond in time. Please try again."` to the Slack thread and reset the session for that user

### Requirement: Idle session cleanup

`SessionManager` SHALL schedule a `setTimeout` of `SESSION_IDLE_TIMEOUT_MS` (default 1 800 000 ms, overridable via `COPILOT_SESSION_IDLE_MS` env var) after each reply. If the timer fires without a new message from that user, `SessionManager` SHALL call `session.disconnect()` and remove the entry from the map. Each new message from the user SHALL reset the timer.

#### Scenario: Session cleaned up after idle timeout

- **WHEN** no message has been received from a user for `SESSION_IDLE_TIMEOUT_MS` milliseconds after the last reply
- **THEN** `SessionManager` SHALL call `session.disconnect()` and remove the session from the map

#### Scenario: Timer resets on new message

- **WHEN** a new message arrives from a user before the idle timer fires
- **THEN** the existing timer SHALL be cleared and a new timer SHALL be started after the reply is sent

### Requirement: GITHUB_TOKEN config

`src/config.ts` SHALL read `GITHUB_TOKEN` from the environment and expose it as `config.githubToken?: string`. No validation error is thrown when it is absent (echo fallback applies).

#### Scenario: GITHUB_TOKEN present in config

- **WHEN** `GITHUB_TOKEN` is set
- **THEN** `loadConfig()` SHALL return `githubToken` equal to that value

#### Scenario: GITHUB_TOKEN absent in config

- **WHEN** `GITHUB_TOKEN` is not set
- **THEN** `loadConfig()` SHALL return `githubToken` as `undefined` without throwing
