## ADDED Requirements

### Requirement: SocketModeClient initialization with proxy agent

The `SocketModeConnection` class SHALL initialize a `SocketModeClient` from `@slack/socket-mode` directly, passing `clientOptions: { agent }` where `agent` is an `HttpsProxyAgent` instance when a proxy URL is configured in the environment, or `undefined` when no proxy is configured.

#### Scenario: Proxy configured

- **WHEN** `HTTPS_PROXY` or `HTTP_PROXY` environment variable is set
- **THEN** `SocketModeClient` SHALL be constructed with `clientOptions: { agent: HttpsProxyAgent(proxyUrl) }`

#### Scenario: No proxy configured

- **WHEN** neither `HTTPS_PROXY` nor `HTTP_PROXY` is set
- **THEN** `SocketModeClient` SHALL be constructed with `clientOptions: { agent: undefined }`

### Requirement: WebClient initialization with proxy agent

The `SocketModeConnection` class SHALL initialize a `WebClient` from `@slack/web-api` with the same `agent` used for `SocketModeClient`, so that all REST API calls also route through the configured proxy.

#### Scenario: WebClient uses same agent as SocketModeClient

- **WHEN** a proxy agent is created for the Socket Mode connection
- **THEN** `WebClient` SHALL be constructed with the same agent instance

#### Scenario: WebClient without proxy

- **WHEN** no proxy is configured
- **THEN** `WebClient` SHALL be constructed without an agent option

### Requirement: SlackConnection interface compliance

The `SocketModeConnection` class SHALL continue to implement the `SlackConnection` interface with `start()`, `stop()`, `getApp()`, and `isActive()` methods.

#### Scenario: start() initiates SocketModeClient connection

- **WHEN** `start()` is called
- **THEN** `socketClient.start()` SHALL be invoked and `isRunning` set to `true` on success

#### Scenario: stop() disconnects SocketModeClient

- **WHEN** `stop()` is called
- **THEN** `socketClient.disconnect()` SHALL be invoked and `isRunning` set to `false`

#### Scenario: getApp() returns WebClient

- **WHEN** `getApp()` is called
- **THEN** the initialized `WebClient` instance SHALL be returned

#### Scenario: isActive() reflects connection state

- **WHEN** `start()` has succeeded
- **THEN** `isActive()` SHALL return `true`
- **WHEN** `stop()` has been called
- **THEN** `isActive()` SHALL return `false`

### Requirement: @slack/socket-mode declared as direct dependency

The `@slack/socket-mode` package SHALL be listed as a direct dependency in `package.json`, as `SocketModeConnection` imports from it directly.

#### Scenario: Package listed in package.json

- **WHEN** `package.json` is inspected
- **THEN** `@slack/socket-mode` SHALL appear under `dependencies`

### Requirement: proxy.ts returns HttpsProxyAgent

The `createProxyAgents` function in `src/proxy.ts` SHALL be replaced or supplemented with a `createProxyAgent` function that returns a single `HttpsProxyAgent | undefined`, since Slack's WebSocket and REST endpoints both use HTTPS.

#### Scenario: Proxy URL provided

- **WHEN** `proxyConfig.url` is defined
- **THEN** `createProxyAgent` SHALL return an `HttpsProxyAgent` constructed from the proxy URL (with credentials embedded if username/password are provided)

#### Scenario: No proxy URL

- **WHEN** `proxyConfig` is undefined or `proxyConfig.url` is not set
- **THEN** `createProxyAgent` SHALL return `undefined`

### Requirement: SocketModeClient event-based handler registration

The `SocketModeConnection` class SHALL expose a method to register event handlers on the underlying `SocketModeClient` so that callers can use `socketClient.on('message', ...)` style registration, consistent with `slack_demo.js`.

#### Scenario: message event handler registration

- **WHEN** a handler is registered via `onMessage(handler)` or equivalent
- **THEN** the handler SHALL be invoked when the `SocketModeClient` emits a `message` event

#### Scenario: connection lifecycle event logging

- **WHEN** the `SocketModeClient` emits `connecting`, `connected`, `disconnecting`, `disconnected`, or `reconnecting` events
- **THEN** the `SocketModeConnection` SHALL log each event at the appropriate log level
