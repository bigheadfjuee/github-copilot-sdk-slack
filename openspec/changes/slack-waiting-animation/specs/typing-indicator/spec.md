## ADDED Requirements

### Requirement: Typing indicator starts before Copilot processing

The system SHALL call `assistant_threads_setStatus` with a non-empty status string before `session.sendAndWait()` is awaited, so that the Slack UI shows the bot is active.

#### Scenario: Indicator starts on message receipt

- **WHEN** a user message is received and processing begins
- **THEN** `assistant_threads_setStatus` SHALL be called with `status="is thinking..."` before `sendAndWait()` resolves

### Requirement: Typing indicator repeats at configurable interval

The system SHALL repeatedly call `assistant_threads_setStatus` at an interval controlled by `COPILOT_TYPING_INTERVAL_MS` (default 2000ms) for the duration of Copilot processing.

#### Scenario: Default interval

- **WHEN** `COPILOT_TYPING_INTERVAL_MS` is not set in the environment
- **THEN** the indicator SHALL refresh every 2000 milliseconds

#### Scenario: Custom interval

- **WHEN** `COPILOT_TYPING_INTERVAL_MS` is set to a positive integer
- **THEN** the indicator SHALL refresh at that interval in milliseconds

### Requirement: Typing indicator stops after processing completes

The system SHALL call `assistant_threads_setStatus` with an empty status string after `sendAndWait()` resolves (success or failure), clearing the typing display.

#### Scenario: Indicator cleared on success

- **WHEN** `sendAndWait()` resolves successfully
- **THEN** `assistant_threads_setStatus` SHALL be called with `status=""` to clear the indicator

#### Scenario: Indicator cleared on failure

- **WHEN** `sendAndWait()` rejects or times out
- **THEN** `assistant_threads_setStatus` SHALL be called with `status=""` to clear the indicator

### Requirement: Typing indicator API errors do not interrupt main flow

If `assistant_threads_setStatus` returns an error, the system SHALL log a warning and continue processing without throwing.

#### Scenario: API error during typing refresh

- **WHEN** a call to `assistant_threads_setStatus` returns an error
- **THEN** the error SHALL be logged at warning level and the main message-handling flow SHALL continue unaffected

### Requirement: COPILOT_TYPING_INTERVAL_MS environment variable

The application SHALL read `COPILOT_TYPING_INTERVAL_MS` from the environment and expose it as a numeric field in `BotConfig`.

#### Scenario: Variable is set

- **WHEN** `COPILOT_TYPING_INTERVAL_MS` is set to a valid positive integer string
- **THEN** `loadConfig()` SHALL return that value as the typing interval in milliseconds

#### Scenario: Variable is not set

- **WHEN** `COPILOT_TYPING_INTERVAL_MS` is absent from the environment
- **THEN** `loadConfig()` SHALL return `2000` as the default typing interval
