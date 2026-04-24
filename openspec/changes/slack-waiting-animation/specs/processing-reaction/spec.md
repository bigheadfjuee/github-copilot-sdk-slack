## ADDED Requirements

### Requirement: Eyes reaction added when processing starts

The system SHALL add a `:eyes:` reaction to the user's original message when processing begins.

#### Scenario: Eyes reaction on processing start

- **WHEN** a user message is received and processing begins
- **THEN** `reactions.add` SHALL be called with `name="eyes"`, targeting the user's original message `channel` and `ts`

### Requirement: Duplicate reaction error is silently ignored

If `reactions.add` returns `already_reacted`, the system SHALL not treat it as an error.

#### Scenario: Already reacted

- **WHEN** `reactions.add` returns error code `already_reacted`
- **THEN** the error SHALL be ignored and processing SHALL continue normally

### Requirement: Check mark reaction replaces eyes on success

After successful processing, the system SHALL remove `:eyes:` and add `:white_check_mark:` to the user's original message.

#### Scenario: Success reaction swap

- **WHEN** `sendAndWait()` resolves successfully
- **THEN** `reactions.remove` SHALL be called with `name="eyes"` and `reactions.add` SHALL be called with `name="white_check_mark"` on the same message

### Requirement: X reaction replaces eyes on failure

After a processing failure (timeout or exception), the system SHALL remove `:eyes:` and add `:x:` to the user's original message.

#### Scenario: Failure reaction swap

- **WHEN** `sendAndWait()` rejects or times out
- **THEN** `reactions.remove` SHALL be called with `name="eyes"` and `reactions.add` SHALL be called with `name="x"` on the same message

### Requirement: Reaction API errors do not interrupt main flow

If any `reactions.add` or `reactions.remove` call returns an error (other than `already_reacted`), the system SHALL log a warning and continue without throwing.

#### Scenario: Reaction API error

- **WHEN** `reactions.add` or `reactions.remove` returns an unexpected error
- **THEN** the error SHALL be logged at warning level and the main flow SHALL continue unaffected
