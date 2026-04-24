/**
 * Base interface for Slack connection implementations
 */
export interface SlackConnection {
  /**
   * Start the connection
   */
  start(): Promise<void>;

  /**
   * Stop the connection gracefully
   */
  stop(): Promise<void>;

  /**
   * Get the underlying Bolt app instance
   */
  getApp(): any;

  /**
   * Check if connection is active
   */
  isActive(): boolean;
}

/**
 * Connection lifecycle events
 */
export interface ConnectionEvents {
  onStart?: () => void | Promise<void>;
  onStop?: () => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}
