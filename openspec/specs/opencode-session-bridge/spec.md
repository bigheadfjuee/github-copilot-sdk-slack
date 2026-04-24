## ADDED Requirements

### Requirement: Opencode client initialization

The system SHALL initialize a single `createOpencodeClient` instance at application startup using the `OPENCODE_BASE_URL` environment variable (default: `http://localhost:4096`).

If `OPENCODE_SERVER_PASSWORD` is set, the client SHALL include an `Authorization: Basic <base64(opencode:<password>)>` header on every request.

The client instance SHALL be shared across all users (one client, multiple sessions).

#### Scenario: Client created with default URL

- **WHEN** `OPENCODE_BASE_URL` is not set
- **THEN** the client SHALL connect to `http://localhost:4096`

#### Scenario: Client created with custom URL

- **WHEN** `OPENCODE_BASE_URL=http://remote-host:5000` is set
- **THEN** the client SHALL use `http://remote-host:5000` as `baseUrl`

#### Scenario: Basic Auth header injected

- **WHEN** `OPENCODE_SERVER_PASSWORD=secret` is set
- **THEN** every request from the client SHALL include `Authorization: Basic <base64("opencode:secret")>`

### Requirement: /oc slash command creates opencode session and sends first prompt

The system SHALL register a `/oc` slash command handler that:
1. Extracts all text after `/oc ` as the initial prompt (trimmed)
2. Calls `client.session.create({ body: {} })` to create a new opencode session
3. Stores the returned session ID in `OpencodeBridge` keyed by the Slack user ID
4. Calls `client.session.prompt({ path: { id: sessionId }, body: { parts: [{ type: "text", text: prompt }] } })` to send the prompt
5. Extracts the assistant's text response from the returned `parts` array (concatenating all `text`-type parts)
6. Replies to the Slack command with the extracted response text as a message in the original channel/thread

If the prompt text is empty (user sent `/oc` with no argument), the handler SHALL respond with usage instructions and SHALL NOT create a session.

If `client.session.create` or `client.session.prompt` throws, the handler SHALL respond with an error message and SHALL NOT store a session ID.

#### Scenario: /oc with prompt creates session and returns response

- **WHEN** user sends `/oc Hello opencode`
- **THEN** the system SHALL create a new opencode session, send `"Hello opencode"` as the first prompt, and reply with opencode's response text in Slack

#### Scenario: /oc with empty prompt returns usage

- **WHEN** user sends `/oc` with no text
- **THEN** the handler SHALL respond with usage instructions and SHALL NOT call `client.session.create`

#### Scenario: /oc when opencode server is unreachable

- **WHEN** user sends `/oc Hello` and `client.session.create` throws a network error
- **THEN** the handler SHALL respond with an error message and SHALL NOT store any session ID

### Requirement: Subsequent Slack messages routed to opencode session

When a Slack user sends a regular (non-slash-command) message and `OpencodeBridge.hasSession(userId)` returns `true`, the message handler SHALL:
1. Retrieve the stored opencode session ID for that user
2. Call `client.session.prompt({ path: { id: sessionId }, body: { parts: [{ type: "text", text: messageText }] } })`
3. Extract the assistant's text response and post it to the same Slack thread via `webClient.chat.postMessage`

If `session.prompt` throws (e.g., session expired), the handler SHALL post an error message and SHALL remove the stored session ID for that user from `OpencodeBridge`.

The opencode routing SHALL take priority over GitHub Copilot routing when both session types exist for the same user.

#### Scenario: Subsequent message forwarded to existing opencode session

- **WHEN** user has an active opencode session and sends a regular Slack message `"What did we discuss?"`
- **THEN** the message SHALL be sent to the opencode session and the response SHALL be posted to the Slack thread

#### Scenario: Opencode session error clears stored session

- **WHEN** `session.prompt` throws for a user's stored session ID
- **THEN** the system SHALL post an error message to Slack and SHALL remove that user's session ID from `OpencodeBridge`

#### Scenario: User without opencode session not affected

- **WHEN** a user who has never issued `/oc` sends a regular Slack message
- **THEN** the message SHALL NOT be sent to opencode; existing Copilot routing SHALL apply unchanged

### Requirement: OpencodeBridge per-user session management

The `OpencodeBridge` class SHALL maintain an in-memory `Map<string, string>` mapping Slack user ID to opencode session ID.

It SHALL expose:
- `setSession(userId: string, sessionId: string): void`
- `getSessionId(userId: string): string | undefined`
- `hasSession(userId: string): boolean`
- `clearSession(userId: string): void`

#### Scenario: Session stored and retrieved

- **WHEN** `setSession("U123", "oc-session-abc")` is called
- **THEN** `getSessionId("U123")` SHALL return `"oc-session-abc"` and `hasSession("U123")` SHALL return `true`

#### Scenario: Session cleared

- **WHEN** `clearSession("U123")` is called after a session was set
- **THEN** `hasSession("U123")` SHALL return `false` and `getSessionId("U123")` SHALL return `undefined`

### Requirement: Config exposes OPENCODE_BASE_URL and OPENCODE_SERVER_PASSWORD

`src/config.ts` SHALL read and expose:
- `opencodeBaseUrl: string` — from `OPENCODE_BASE_URL`, defaulting to `http://localhost:4096`
- `opencodeServerPassword: string | undefined` — from `OPENCODE_SERVER_PASSWORD`, undefined if not set

#### Scenario: Default opencode URL when env var absent

- **WHEN** `OPENCODE_BASE_URL` is not defined in the environment
- **THEN** `config.opencodeBaseUrl` SHALL equal `"http://localhost:4096"`

#### Scenario: Custom URL read from env

- **WHEN** `OPENCODE_BASE_URL=http://myserver:9000` is set
- **THEN** `config.opencodeBaseUrl` SHALL equal `"http://myserver:9000"`

## Requirements

### Requirement: Opencode client initialization

The system SHALL initialize a single `createOpencodeClient` instance at application startup using the `OPENCODE_BASE_URL` environment variable (default: `http://localhost:4096`).

If `OPENCODE_SERVER_PASSWORD` is set, the client SHALL include an `Authorization: Basic <base64(opencode:<password>)>` header on every request.

The client instance SHALL be shared across all users (one client, multiple sessions).

#### Scenario: Client created with default URL

- **WHEN** `OPENCODE_BASE_URL` is not set
- **THEN** the client SHALL connect to `http://localhost:4096`

#### Scenario: Client created with custom URL

- **WHEN** `OPENCODE_BASE_URL=http://remote-host:5000` is set
- **THEN** the client SHALL use `http://remote-host:5000` as `baseUrl`

#### Scenario: Basic Auth header injected

- **WHEN** `OPENCODE_SERVER_PASSWORD=secret` is set
- **THEN** every request from the client SHALL include `Authorization: Basic <base64("opencode:secret")>`

---
### Requirement: /oc slash command creates opencode session and sends first prompt

The system SHALL register a `/oc` slash command handler that:
1. Extracts all text after `/oc ` as the initial prompt (trimmed)
2. Calls `client.session.create({ body: {} })` to create a new opencode session
3. Stores the returned session ID in `OpencodeBridge` keyed by the Slack user ID
4. Calls `client.session.prompt({ path: { id: sessionId }, body: { parts: [{ type: "text", text: prompt }] } })` to send the prompt
5. Extracts the assistant's text response from the returned `parts` array (concatenating all `text`-type parts)
6. Replies to the Slack command with the extracted response text as a message in the original channel/thread

If the prompt text is empty (user sent `/oc` with no argument), the handler SHALL respond with usage instructions and SHALL NOT create a session.

If `client.session.create` or `client.session.prompt` throws, the handler SHALL respond with an error message and SHALL NOT store a session ID.

#### Scenario: /oc with prompt creates session and returns response

- **WHEN** user sends `/oc Hello opencode`
- **THEN** the system SHALL create a new opencode session, send `"Hello opencode"` as the first prompt, and reply with opencode's response text in Slack

#### Scenario: /oc with empty prompt returns usage

- **WHEN** user sends `/oc` with no text
- **THEN** the handler SHALL respond with usage instructions and SHALL NOT call `client.session.create`

#### Scenario: /oc when opencode server is unreachable

- **WHEN** user sends `/oc Hello` and `client.session.create` throws a network error
- **THEN** the handler SHALL respond with an error message and SHALL NOT store any session ID

---
### Requirement: Subsequent Slack messages routed to opencode session

When a Slack user sends a regular (non-slash-command) message and `OpencodeBridge.hasSession(userId)` returns `true`, the message handler SHALL:
1. Retrieve the stored opencode session ID for that user
2. Call `client.session.prompt({ path: { id: sessionId }, body: { parts: [{ type: "text", text: messageText }] } })`
3. Extract the assistant's text response and post it to the same Slack thread via `webClient.chat.postMessage`

If `session.prompt` throws (e.g., session expired), the handler SHALL post an error message and SHALL remove the stored session ID for that user from `OpencodeBridge`.

The opencode routing SHALL take priority over GitHub Copilot routing when both session types exist for the same user.

#### Scenario: Subsequent message forwarded to existing opencode session

- **WHEN** user has an active opencode session and sends a regular Slack message `"What did we discuss?"`
- **THEN** the message SHALL be sent to the opencode session and the response SHALL be posted to the Slack thread

#### Scenario: Opencode session error clears stored session

- **WHEN** `session.prompt` throws for a user's stored session ID
- **THEN** the system SHALL post an error message to Slack and SHALL remove that user's session ID from `OpencodeBridge`

#### Scenario: User without opencode session not affected

- **WHEN** a user who has never issued `/oc` sends a regular Slack message
- **THEN** the message SHALL NOT be sent to opencode; existing Copilot routing SHALL apply unchanged

---
### Requirement: OpencodeBridge per-user session management

The `OpencodeBridge` class SHALL maintain an in-memory `Map<string, string>` mapping Slack user ID to opencode session ID.

It SHALL expose:
- `setSession(userId: string, sessionId: string): void`
- `getSessionId(userId: string): string | undefined`
- `hasSession(userId: string): boolean`
- `clearSession(userId: string): void`

#### Scenario: Session stored and retrieved

- **WHEN** `setSession("U123", "oc-session-abc")` is called
- **THEN** `getSessionId("U123")` SHALL return `"oc-session-abc"` and `hasSession("U123")` SHALL return `true`

#### Scenario: Session cleared

- **WHEN** `clearSession("U123")` is called after a session was set
- **THEN** `hasSession("U123")` SHALL return `false` and `getSessionId("U123")` SHALL return `undefined`

---
### Requirement: Config exposes OPENCODE_BASE_URL and OPENCODE_SERVER_PASSWORD

`src/config.ts` SHALL read and expose:
- `opencodeBaseUrl: string` — from `OPENCODE_BASE_URL`, defaulting to `http://localhost:4096`
- `opencodeServerPassword: string | undefined` — from `OPENCODE_SERVER_PASSWORD`, undefined if not set

#### Scenario: Default opencode URL when env var absent

- **WHEN** `OPENCODE_BASE_URL` is not defined in the environment
- **THEN** `config.opencodeBaseUrl` SHALL equal `"http://localhost:4096"`

#### Scenario: Custom URL read from env

- **WHEN** `OPENCODE_BASE_URL=http://myserver:9000` is set
- **THEN** `config.opencodeBaseUrl` SHALL equal `"http://myserver:9000"`
