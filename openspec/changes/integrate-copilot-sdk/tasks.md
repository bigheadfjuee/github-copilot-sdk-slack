## 1. Dependencies & Config

- [x] 1.1 Run `pnpm add @github/copilot-sdk` to install the SDK as a direct dependency
- [x] 1.2 Add `githubToken?: string` field to `BotConfig` interface in `src/config.ts` and read `process.env.GITHUB_TOKEN` in `loadConfig()` — satisfies `GITHUB_TOKEN config` requirement (no error when absent)
- [x] 1.3 Add `COPILOT_SESSION_IDLE_MS` env var reading to `loadConfig()` as `sessionIdleMs: number` (default `1800000`) — used by SessionManager idle cleanup
- [x] 1.4 Add `GITHUB_TOKEN=` and `COPILOT_SESSION_IDLE_MS=` entries to `.env.example`

## 2. CopilotClient singleton lifecycle — src/copilot/ — single CopilotClient shared across all Slack events

- [x] 2.1 Create `src/copilot/` directory (CopilotClient placed in src/copilot/) and `src/copilot/client.ts` exporting a `CopilotClientManager` class with: `start(githubToken: string): Promise<void>` (creates and starts `CopilotClient({ githubToken })`), `stop(): Promise<void>`, `getClient(): CopilotClient | null` — satisfies `CopilotClient singleton lifecycle` requirement
- [x] 2.2 In `start()`, wrap `client.start()` in try/catch; on error log a warning and set internal client to `null` (echo fallback) — satisfies `CopilotClient.start() failure falls back to echo mode` scenario
- [x] 2.3 Export a module-level singleton instance `copilotManager` from `src/copilot/client.ts`

## 3. Per-user CopilotSession mapping — session keyed by Slack user ID — src/copilot/session-manager.ts

- [x] 3.1 Create `src/copilot/session-manager.ts` exporting `SessionManager` class; constructor accepts `CopilotClient` and `idleTimeoutMs: number`
- [x] 3.2 Implement `getOrCreate(userId: string): Promise<CopilotSession>` — checks `Map<string, {session, timer}>`, calls `client.createSession({ onPermissionRequest: approveAll })` on cache miss — satisfies `Per-user CopilotSession mapping` requirement
- [x] 3.3 Implement `resetSession(userId: string): Promise<void>` — calls `session.disconnect()`, removes from map, clears timer — used on timeout error
- [x] 3.4 Implement private `scheduleIdle(userId: string)` — clears any existing timer, sets `setTimeout(idleTimeoutMs)` that calls `resetSession(userId)` — satisfies `Idle session cleanup` requirement
- [x] 3.5 Call `scheduleIdle(userId)` at the end of each successful `getOrCreate()` call (i.e., after the reply is sent, the caller invokes `scheduleIdle` explicitly; expose `scheduleIdle` as public method)
- [x] 3.6 Export a factory function `createSessionManager(client, idleTimeoutMs)` from the module

## 4. Message forwarding to Copilot — src/handlers.ts

- [x] 4.1 Update `registerMessageHandlers` to accept an optional `sessionManager: SessionManager | null` third parameter; when `null`, fall back to the existing echo behavior — satisfies `Missing GITHUB_TOKEN falls back to echo mode` scenario
- [x] 4.2 When `sessionManager` is provided: call `sessionManager.getOrCreate(event.user)` to get the `CopilotSession` — satisfies `Message forwarding to Copilot with reply` requirement
- [x] 4.3 Wrap `session.sendAndWait({ prompt: event.text })` in `Promise.race()` against a `60000ms` rejection timeout — sendAndWait for simplicity; satisfies `sendAndWait timeout` scenario
- [x] 4.4 On success, post `reply.data.content` via `webClient.chat.postMessage({ channel, text, thread_ts })` and call `sessionManager.scheduleIdle(event.user)`
- [x] 4.5 On timeout, post `"Copilot did not respond in time. Please try again."` to the Slack thread and call `sessionManager.resetSession(event.user)` — satisfies `sendAndWait timeout` scenario
- [x] 4.6 Skip forwarding when `event.bot_id` is set (already done) and when `event.text` is empty/whitespace — satisfies `Bot messages are ignored` and `Empty message is ignored` scenarios

## 5. Startup / shutdown wiring — src/index.ts

- [x] 5.1 Import `copilotManager` and `createSessionManager` in `src/index.ts`
- [x] 5.2 After `loadConfig()`, if `config.githubToken` is set: call `await copilotManager.start(config.githubToken)`; if not set log a warning "GITHUB_TOKEN not set — running in echo mode" — satisfies `CopilotClient singleton lifecycle` and `Missing GITHUB_TOKEN falls back to echo mode` scenarios
- [x] 5.3 Create `sessionManager = copilotManager.getClient() ? createSessionManager(copilotManager.getClient()!, config.sessionIdleMs) : null`
- [x] 5.4 Pass `sessionManager` to `registerHandlers(socketClient, webClient, sessionManager)`
- [x] 5.5 In `setupShutdownHandlers`, call `await copilotManager.stop()` before `connection.stop()` — satisfies `Graceful shutdown stops CopilotClient` scenario

## 6. Build & verification

- [x] 6.1 Run `pnpm run build` and fix all TypeScript compilation errors
