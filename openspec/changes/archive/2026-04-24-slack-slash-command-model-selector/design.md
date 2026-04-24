## Context

The project is a Slack bot that uses the GitHub Copilot SDK to create per-user chat sessions. Currently `SessionManager.getOrCreate` always calls `client.createSession` without specifying a model, using the SDK default.

The bot registers slash command handlers in `src/handlers.ts` via `registerCommandHandlers`, which currently only echoes the command text. The `SessionManager` class in `src/copilot/session-manager.ts` holds the per-user session map.

## Goals / Non-Goals

**Goals:**
- Add `/model <alias>` slash command support
- Store per-user model preference in memory
- Pass the stored model to `createSession` when starting a new session
- Keep changes minimal and contained to a new module + small edits to two existing files

**Non-Goals:**
- Dynamic model switching mid-conversation
- Persistent storage across restarts
- Authorization / entitlement checks on model selection

## Decisions

### Model alias table in a dedicated module

A new file `src/copilot/models.ts` exports the alias→model-ID mapping as a plain `Record<string, string>` constant and a helper function `resolveModel(alias: string): string | undefined`.

**Why**: Centralising the mapping avoids duplication if it is needed in tests or future features; it also makes the alias list easy to review.

### User preference stored in ModelPreferenceStore class

A new class `ModelPreferenceStore` (also in `src/copilot/models.ts`) wraps a `Map<string, string>` with `set(userId, modelId)`, `get(userId): string | undefined`, and `clear(userId)` methods.

**Why**: A named class is easier to mock in tests than a bare module-level `Map`.

### SessionManager receives ModelPreferenceStore via constructor injection

`SessionManager` constructor gains an optional `modelPreferenceStore?: ModelPreferenceStore` parameter. Inside `getOrCreate`, the resolved model ID (if any) is passed to `createSession`.

**Why**: Dependency injection keeps `SessionManager` testable without touching the preference store.

### Slash command handler updated in registerCommandHandlers

`registerCommandHandlers` gains two additional parameters: `webClient: WebClient` (already available at call site) and `modelPreferenceStore: ModelPreferenceStore`. The handler matches on `body.command === '/model'` and processes accordingly.

**Why**: Keeping all command registration in one function preserves the existing structure.

## Risks / Trade-offs

- [Risk] User changes model but already has an active session → the new model takes effect only on the next session (after the current session is idle-timed out or reset). **Mitigation**: Confirmation message informs the user the model will apply to the next conversation.
- [Risk] Alias list becomes stale as new Copilot models are released. **Mitigation**: Alias table is a single constant in `models.ts`, easy to update.
