## 1. New module: model alias mapping and preference store

- [x] 1.1 Create `src/copilot/models.ts` with a `MODEL_ALIASES` constant that maps `sonnet → claude-sonnet-4.6`, `haiku → claude-haiku-4.5`, `opus → claude-opus-4.6`, `gpt-5 → gpt-5.4` (implements **Model alias mapping** requirement)
- [x] 1.2 Add `resolveModel(alias: string): string | undefined` helper in `src/copilot/models.ts` that performs a case-insensitive lookup in `MODEL_ALIASES`
- [x] 1.3 Add `ModelPreferenceStore` class in `src/copilot/models.ts` with `set(userId: string, modelId: string)`, `get(userId: string): string | undefined`, and `clear(userId: string)` methods backed by a `Map<string, string>` (implements **User model preference storage** requirement; implements **User preference stored in ModelPreferenceStore class** design decision)
- [x] 1.4 Export `MODEL_ALIASES`, `resolveModel`, and `ModelPreferenceStore` from `src/copilot/models.ts`

## 2. SessionManager: inject model preference store

- [x] 2.1 Add optional `modelPreferenceStore?: ModelPreferenceStore` parameter to `SessionManager` constructor in `src/copilot/session-manager.ts` (implements **Model alias table in a dedicated module** and **SessionManager receives ModelPreferenceStore via constructor injection** design decisions)
- [x] 2.2 In `SessionManager.getOrCreate`, read `modelPreferenceStore?.get(userId)` and pass it as `model` to `client.createSession` when defined; omit the `model` property when undefined (implements **Session creation uses user model preference** requirement)
- [x] 2.3 Update `createSessionManager` factory function signature to accept an optional `modelPreferenceStore` parameter and forward it to the `SessionManager` constructor

## 3. Slash command handler: /model

- [x] 3.1 Add `modelPreferenceStore: ModelPreferenceStore` and `webClient: WebClient` parameters to `registerCommandHandlers` in `src/handlers.ts` (implements **Slash command /model handler** requirement and **Slash command handler updated in registerCommandHandlers** design decision)
- [x] 3.2 Inside the `slash_commands` event handler, add a branch for `body.command === '/model'` that extracts the first whitespace-separated token from `body.text`
- [x] 3.3 Call `resolveModel(alias)` and if resolved: call `modelPreferenceStore.set(body.user_id, resolvedModelId)` then `ack` with a confirmation message including the resolved model name (implements **Slash command /model handler** — valid alias accepted scenario)
- [x] 3.4 If alias is unrecognized: `ack` with an error message listing all supported aliases (`Object.keys(MODEL_ALIASES).join(', ')`); do NOT update the preference store (implements invalid alias rejected scenario)
- [x] 3.5 If `body.text` is empty or whitespace-only: `ack` with usage instructions; do NOT update the preference store (implements empty argument rejected scenario)
- [x] 3.6 Update the `registerHandlers` function call in `src/handlers.ts` to forward the new parameters to `registerCommandHandlers`

## 4. Wire up at application entry point

- [x] 4.1 In `src/index.ts`, instantiate `ModelPreferenceStore` and pass it to both `createSessionManager` and `registerHandlers` (or `registerCommandHandlers` directly)
- [x] 4.2 Verify application starts without TypeScript errors by running `npx tsc --noEmit`
