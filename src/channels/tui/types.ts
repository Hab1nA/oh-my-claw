import type { ChannelConfig } from '../../types/index.js';

export interface TuiConfig extends ChannelConfig {
  /** Input prompt string (default: '> ') */
  prompt?: string;
  /** Fixed session ID for the TUI session (default: 'tui-local') */
  sessionId?: string;
  /** User identifier (default: 'local-user') */
  userId?: string;
  /** User display name (default: 'Local User') */
  userName?: string;
  /** Enable ANSI color output (default: auto-detect TTY) */
  colorEnabled?: boolean;
  /** Show timestamps in output (default: false) */
  showTimestamp?: boolean;
  /** Greeting message shown on start (default: OpenClaw banner) */
  greeting?: string;
}
