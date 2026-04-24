## 1. Config

- [x] 1.1 Add `copilotTypingIntervalMs: number` to `BotConfig` interface in `src/config.ts` and read `COPILOT_TYPING_INTERVAL_MS` from environment in `loadConfig()`, defaulting to `2000` — covers requirement: COPILOT_TYPING_INTERVAL_MS environment variable

## 2. TypingIndicator Module

- [x] 2.1 Create exporting a `TypingIndicator` class that accepts `WebClient`, `channel`, `threadTs`, and `intervalMs`; implements `start()` (calls `assistant_threads_setStatus` immediately then via `setInterval`) and `stop()` (clears interval, calls `assistant_threads_setStatus` with empty status); all API errors are caught and logged at warning level — covers requirements: typing indicator starts before Copilot processing, typing indicator repeats at configurable interval, typing indicator stops after processing completes, typing indicator API errors do not interrupt main flow; covers design decision: TypingIndicator with setInterval + stop event, not recursive setTimeout

## 3. ReactionManager Module

- [x] 3.1 Create `src/slack/reaction-manager.ts` exporting a `ReactionManager` class that accepts `WebClient`, `channel`, and `ts` (original message ts); implements `markProcessing()` (calls `reactions.add` with `eyes`), `markSuccess()` (calls `reactions.remove` with `eyes` then `reactions.add` with `white_check_mark`), and `markFailure()` (calls `reactions.remove` with `eyes` then `reactions.add` with `x`); `already_reacted` errors are silently ignored; all other API errors are caught and logged at warning level — covers requirements: eyes reaction added when processing starts, duplicate reaction error is silently ignored, check mark reaction replaces eyes on success, X reaction replaces eyes on failure, reaction API errors do not interrupt main flow; covers design decision: TypingIndicator and ReactionManager as independent modules

## 4. Handler Integration

- [x] 4.1 Update `src/handlers.ts` to instantiate `TypingIndicator` and `ReactionManager` before `session.sendAndWait()`, call `markProcessing()` and `indicator.start()`, then in the finally block call `indicator.stop()` and either `markSuccess()` or `markFailure()` depending on outcome — covers design decision: pass workingDirectory through config → client → session-manager (wiring pattern), design decision: assistant_threads_setStatus calling approach
- [x] 4.2 Pass `config.copilotTypingIntervalMs` from `src/index.ts` (or config injection point) into the handler setup so `TypingIndicator` receives the configured interval
