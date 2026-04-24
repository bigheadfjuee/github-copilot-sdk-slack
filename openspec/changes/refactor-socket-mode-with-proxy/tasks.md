## 1. Dependencies

- [x] 1.1 Add `@slack/socket-mode` as a direct dependency in `package.json` (currently only an indirect dep via bolt); run `pnpm add @slack/socket-mode` to satisfy the `@slack/socket-mode declared as direct dependency` requirement

## 2. proxy.ts — createProxyAgent (proxy agent 建立統一走 HttpsProxyAgent)

- [x] 2.1 Add a new exported function `createProxyAgent(proxyConfig?: ProxyConfig): HttpsProxyAgent | undefined` in `src/proxy.ts` that: (a) returns `undefined` when `proxyConfig?.url` is absent, (b) builds the proxy URL string with embedded `username:password` credentials when provided, (c) returns `new HttpsProxyAgent(proxyUrlString)` — satisfies the `proxy.ts returns HttpsProxyAgent` requirement
- [x] 2.2 Keep the existing `createProxyAgents` export to avoid breaking the HTTP mode connection; it can internally call `createProxyAgent` for the `httpsAgent` field

## 3. socket-mode.ts — SocketModeClient initialization with proxy agent / WebClient 獨立初始化 / 直接使用 SocketModeClient 取代 Bolt App

- [x] 3.1 Remove `@slack/bolt App` import; add `SocketModeClient` from `@slack/socket-mode` and `WebClient` from `@slack/web-api` in `src/connections/socket-mode.ts` (直接使用 SocketModeClient 取代 Bolt App)
- [x] 3.2 Accept an optional `agent: HttpsProxyAgent | undefined` parameter in `SocketModeConnection` constructor (passed from factory)
- [x] 3.3 Construct `SocketModeClient({ appToken, clientOptions: { agent } })` — satisfies `SocketModeClient initialization with proxy agent` requirement
- [x] 3.4 Construct `new WebClient(botToken, { agent })` and assign to `this.webClient` (WebClient 獨立初始化) — satisfies `WebClient initialization with proxy agent` requirement

## 4. socket-mode.ts — SlackConnection interface compliance / getApp() 回傳 WebClient

- [x] 4.1 Implement `start()` by calling `await this.socketClient.start()` and setting `isRunning = true` on success — satisfies `start() initiates SocketModeClient connection` (SlackConnection interface compliance)
- [x] 4.2 Implement `stop()` by calling `await this.socketClient.disconnect()` and setting `isRunning = false` — satisfies `stop() disconnects SocketModeClient` (SlackConnection interface compliance)
- [x] 4.3 Implement `getApp()` to return `this.webClient` — satisfies `getApp() 回傳 WebClient` decision and `getApp() returns WebClient` scenario (SlackConnection interface compliance)
- [x] 4.4 Confirm `isActive()` returns `this.isRunning` — satisfies `isActive() reflects connection state` (SlackConnection interface compliance)

## 5. socket-mode.ts — SocketModeClient event-based handler registration

- [x] 5.1 In `SocketModeConnection` constructor, register lifecycle event listeners on `socketClient` for `connecting`, `connected`, `disconnecting`, `disconnected`, and `reconnecting`, logging each at appropriate level (info/warn) — satisfies `connection lifecycle event logging` (SocketModeClient event-based handler registration)
- [x] 5.2 Register the `error` event on `socketClient` and invoke `this.events.onError` when fired — satisfies `setupErrorHandling` (SocketModeClient event-based handler registration)
- [x] 5.3 Expose a public method `onMessage(handler: (payload: any) => Promise<void>): void` that calls `this.socketClient.on('message', handler)` — satisfies `message event handler registration` (SocketModeClient event-based handler registration)

## 6. factory.ts — pass proxy agent to SocketModeConnection

- [x] 6.1 In `src/connections/factory.ts`, import `createProxyAgent` from `../proxy` and call it with `config.proxy` to obtain the agent
- [x] 6.2 Pass the agent to `new SocketModeConnection(config, events, agent)` constructor

## 7. handlers.ts — migrate from Bolt middleware to SocketModeClient events

- [x] 7.1 Update `registerHandlers` signature in `src/handlers.ts` to accept `(socketClient: any, webClient: any)` instead of `(app: App)`, removing the `@slack/bolt` import
- [x] 7.2 Replace `app.message(...)` with `socketClient.on('message', async ({ event, ack }) => { await ack(); ... })` using `webClient.chat.postMessage` for replies — satisfies `message event handler registration`
- [x] 7.3 Replace `app.command('/echo', ...)` with the equivalent `socketClient.on('slash_commands', ...)` handler (or remove if slash command support requires Bolt; document the decision)
- [x] 7.4 Replace `app.event('app_mention', ...)` with `socketClient.on('app_mention', ...)` handler using `webClient.chat.postMessage`
- [x] 7.5 Update `src/index.ts` to call `registerHandlers(connection.getApp(), webClient)` or equivalent after creating the connection

## 8. Verification

- [x] 8.1 Run `pnpm run build` and fix all TypeScript compilation errors
- [x] 8.2 Run `pnpm test` and confirm existing tests pass
