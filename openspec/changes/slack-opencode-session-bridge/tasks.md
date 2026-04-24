## 1. Dependencies and config

- [x] 1.1 Add `@opencode-ai/sdk` to `package.json` dependencies by running `pnpm add @opencode-ai/sdk`
- [x] 1.2 Add `opencodeBaseUrl: string` and `opencodeServerPassword: string | undefined` fields to `BotConfig` interface in `src/config.ts` (implements **Config exposes OPENCODE_BASE_URL and OPENCODE_SERVER_PASSWORD** requirement; implements **OPENCODE_BASE_URL and OPENCODE_SERVER_PASSWORD in config** design decision)
- [x] 1.3 In `loadConfig()`, read `OPENCODE_BASE_URL` (default `http://localhost:4096`) into `opencodeBaseUrl` and `OPENCODE_SERVER_PASSWORD` (undefined if absent) into `opencodeServerPassword`

## 2. OpencodeBridge class

- [x] 2.1 Create `src/opencode/bridge.ts` with `OpencodeBridge` class that holds a private `Map<string, string>` and exposes `setSession`, `getSessionId`, `hasSession`, and `clearSession` methods (implements **OpencodeBridge per-user session management** requirement; implements **OpencodeBridge class in src/opencode/bridge.ts** design decision)
- [x] 2.2 Add a private `client` field to `OpencodeBridge`; initialize it in the constructor using `createOpencodeClient({ baseUrl })` from `@opencode-ai/sdk` (implements **Opencode client initialization** requirement; implements **createOpencodeClient (client-only mode, not createOpencode)** design decision)
- [x] 2.3 If `serverPassword` is provided to the `OpencodeBridge` constructor, inject a custom `fetch` wrapper that adds `Authorization: Basic <base64("opencode:<password>")>` to every request, and pass it as the `fetch` option to `createOpencodeClient` (implements **Basic Auth header injected** scenario)
- [x] 2.4 Add `sendPrompt(userId: string, prompt: string): Promise<string>` method to `OpencodeBridge` that: calls `client.session.create` if no session exists for the user (via `hasSession`), stores the session ID via `setSession`, calls `client.session.prompt`, concatenates all `text`-type parts from the response, and returns the result; on any error it calls `clearSession(userId)` and re-throws (implements **Opencode session error clears stored session** scenario)
- [x] 2.5 Export `OpencodeBridge` from `src/opencode/bridge.ts`

## 3. Slash command: /oc

- [x] 3.1 Import `OpencodeBridge` into `src/handlers.ts` and add optional `opencodeBridge?: OpencodeBridge` parameter to `registerCommandHandlers` (implements **/oc slash command handled in registerCommandHandlers** design decision)
- [x] 3.2 In the `slash_commands` event handler, add a `/oc` branch that extracts the trimmed text after `/oc`; if empty, ack with usage instructions and return early (implements **empty prompt returns usage** scenario of **/oc slash command creates opencode session** requirement)
- [x] 3.3 In the `/oc` branch: call `opencodeBridge.sendPrompt(body.user_id, prompt)` inside a try/catch; on success ack with the response text; on error ack with a user-facing error message (implements **/oc slash command creates opencode session and sends first prompt** requirement)
- [x] 3.4 Update `registerHandlers` to accept an optional `opencodeBridge?: OpencodeBridge` parameter and forward it to `registerCommandHandlers`

## 4. Message routing to opencode

- [x] 4.1 In the `message` event handler in `src/handlers.ts`, before the existing Copilot routing block, add a check: if `opencodeBridge?.hasSession(event.user)` is true, call `opencodeBridge.sendPrompt(event.user, event.text)` and post the response to the Slack thread; skip Copilot routing; catch errors and post an error message (implements **Subsequent Slack messages routed to opencode session** requirement; implements **Message routing priority: opencode takes precedence over Copilot** design decision)

## 5. Wire up in index.ts

- [x] 5.1 In `src/index.ts`, import `OpencodeBridge` and instantiate it with `config.opencodeBaseUrl` and `config.opencodeServerPassword`
- [x] 5.2 Pass the `OpencodeBridge` instance to `registerHandlers` as the last argument
- [x] 5.3 Run `npx tsc --noEmit` to confirm no TypeScript errors in changed files
