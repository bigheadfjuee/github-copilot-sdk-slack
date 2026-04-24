# slash-command-model-selector Specification

## Purpose

TBD - created by archiving change 'slack-slash-command-model-selector'. Update Purpose after archive.

## Requirements

### Requirement: Model alias mapping

The system SHALL maintain a static mapping of user-facing model aliases to fully-qualified Copilot SDK model identifiers:
- `sonnet` → `claude-sonnet-4.6`
- `haiku` → `claude-haiku-4.5`
- `opus` → `claude-opus-4.6`
- `gpt-5` → `gpt-5.4`

The mapping SHALL be defined as a constant (not configurable at runtime) and exported for use by other modules.

#### Scenario: Known alias resolves to model ID

- **WHEN** a valid alias string (e.g., `"sonnet"`) is looked up in the mapping
- **THEN** the system SHALL return the corresponding fully-qualified model identifier (e.g., `"claude-sonnet-4.6"`)

#### Scenario: Unknown alias returns undefined

- **WHEN** an alias string that does not exist in the mapping is looked up
- **THEN** the system SHALL return `undefined`


<!-- @trace
source: slack-slash-command-model-selector
updated: 2026-04-24
code:
  - instructions/copilot-sdk-nodejs.instructions.md
  - doc/GITHUB_COPILOT_SDK.md
-->

---
### Requirement: User model preference storage

The system SHALL store each Slack user's selected model identifier in an in-memory map keyed by Slack user ID.

The preference SHALL persist for the duration of the application process and SHALL be cleared only when the application restarts.

#### Scenario: Preference is stored after selection

- **WHEN** a user selects a model via `/model <alias>`
- **THEN** the system SHALL persist the resolved model identifier for that user ID

#### Scenario: No preference returns undefined

- **WHEN** a user who has never issued `/model` has their preference queried
- **THEN** the system SHALL return `undefined`


<!-- @trace
source: slack-slash-command-model-selector
updated: 2026-04-24
code:
  - instructions/copilot-sdk-nodejs.instructions.md
  - doc/GITHUB_COPILOT_SDK.md
-->

---
### Requirement: Slash command /model handler

The system SHALL register a `/model` slash command handler that:
1. Parses the first whitespace-separated token from the command text as the model alias
2. Resolves the alias to a fully-qualified model identifier using the alias mapping
3. Stores the resolved model identifier in the user preference store
4. Responds to the Slack command with an ephemeral confirmation message containing the resolved model name

The handler SHALL reject unrecognized aliases with an error message listing the supported aliases.

#### Scenario: Valid alias is accepted

- **WHEN** a user sends `/model sonnet`
- **THEN** the handler SHALL store `"claude-sonnet-4.6"` for that user and respond with a confirmation message that includes `"claude-sonnet-4.6"`

#### Scenario: Invalid alias is rejected

- **WHEN** a user sends `/model unknown-model`
- **THEN** the handler SHALL respond with an error message listing supported aliases and SHALL NOT update the user's stored preference

#### Scenario: Empty argument is rejected

- **WHEN** a user sends `/model` with no argument
- **THEN** the handler SHALL respond with usage instructions and SHALL NOT update the user's stored preference


<!-- @trace
source: slack-slash-command-model-selector
updated: 2026-04-24
code:
  - instructions/copilot-sdk-nodejs.instructions.md
  - doc/GITHUB_COPILOT_SDK.md
-->

---
### Requirement: Session creation uses user model preference

When `SessionManager.getOrCreate` creates a new Copilot session, the system SHALL pass the user's stored model identifier (if any) to `client.createSession({ model: "<model-id>" })`.

If no preference is stored for the user, the system SHALL call `client.createSession` without a `model` parameter (using the Copilot SDK default).

#### Scenario: Session created with user's preferred model

- **WHEN** a user has previously issued `/model haiku` and then sends a chat message
- **THEN** `createSession` SHALL be called with `{ model: "claude-haiku-4.5" }`

#### Scenario: Session created with default model when no preference set

- **WHEN** a user has not issued any `/model` command and sends a chat message
- **THEN** `createSession` SHALL be called without a `model` property

<!-- @trace
source: slack-slash-command-model-selector
updated: 2026-04-24
code:
  - instructions/copilot-sdk-nodejs.instructions.md
  - doc/GITHUB_COPILOT_SDK.md
-->