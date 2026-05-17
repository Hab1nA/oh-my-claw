import * as readline from 'node:readline';
import type {
  ChannelConfig,
  ContentType,
  NormalizedMessage,
  OutboundMessage,
  MessageSender,
  MessageRecipient,
  MessageContent,
  Attachment,
  MessageMetadata
} from '../../types/index.js';
import { BaseChannelAdapter } from '../adapter.js';
import { ChannelError } from '../../utils/index.js';
import type { TuiConfig } from './types.js';

// ─── ANSI helpers (zero external deps) ───────────────────────────
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const FG_CYAN = `${ESC}36m`;
const FG_GREEN = `${ESC}32m`;
const FG_YELLOW = `${ESC}33m`;
const FG_RED = `${ESC}31m`;
const FG_MAGENTA = `${ESC}35m`;
const FG_GRAY = `${ESC}90m`;

// ─── Internal payload shape ──────────────────────────────────────
interface TuiPayload {
  text: string;
  senderId: string;
  senderName: string;
  recipientId: string;
}

// ─── Built-in commands ───────────────────────────────────────────
const BUILTIN_COMMANDS: Record<string, string> = {
  '/quit': 'Exit the TUI session',
  '/exit': 'Exit the TUI session',
  '/clear': 'Clear the terminal screen',
  '/help': 'Show available commands',
  '/status': 'Show current session info'
};

export class TuiAdapter extends BaseChannelAdapter {
  readonly channelName = 'tui';
  readonly supportedContentTypes: ContentType[] = ['text'];

  private tuiConfig: TuiConfig;
  private rl: readline.Interface | null = null;
  private colorEnabled: boolean;
  private resolveClosed: (() => void) | null = null;

  constructor(config: TuiConfig) {
    super(config as ChannelConfig);
    this.tuiConfig = {
      prompt: '> ',
      sessionId: 'tui-local',
      userId: 'local-user',
      userName: 'Local User',
      colorEnabled: undefined,
      showTimestamp: false,
      ...config
    };

    // Auto-detect color support: explicit config > TTY detection
    this.colorEnabled =
      this.tuiConfig.colorEnabled ?? (process.stdout.isTTY === true);
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  validateConfig(): void {
    if (this.tuiConfig.sessionId && typeof this.tuiConfig.sessionId !== 'string') {
      throw new ChannelError('TuiConfig.sessionId must be a string', this.channelName);
    }
  }

  async setupConnection(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.tuiConfig.prompt,
      terminal: true
    });

    // Unified exit handling — works reliably on Windows/PowerShell 7+
    this.rl.on('close', () => {
      this.print('\nGoodbye!', FG_YELLOW);
      if (this.resolveClosed) {
        this.resolveClosed();
        this.resolveClosed = null;
      }
    });
  }

  async startListening(): Promise<void> {
    if (!this.rl) {
      throw new ChannelError('readline not initialised — call setupConnection() first', this.channelName);
    }

    this.printBanner();
    this.rl.prompt();

    this.rl.on('line', (line: string) => {
      void this.handleLine(line);
    });

    // Keep the process alive until readline closes
    await new Promise<void>((resolve) => {
      this.resolveClosed = resolve;
    });
  }

  async stopListening(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  // ─── Outbound: Agent → Terminal ──────────────────────────────

  async send(_destination: string, message: OutboundMessage): Promise<void> {
    const text = message.content.text ?? '';
    if (!text) return;

    const label = this.c(`${BOLD}${FG_CYAN}`, '✦ OpenClaw');
    const ts = this.tuiConfig.showTimestamp
      ? this.c(FG_GRAY, ` [${new Date().toLocaleTimeString()}]`)
      : '';

    console.log(`\n${label}${ts}: ${text}`);

    // Re-show prompt after response
    this.rl?.prompt();
  }

  async formatMessage(message: NormalizedMessage): Promise<string> {
    const ts = this.tuiConfig.showTimestamp
      ? this.c(FG_GRAY, `[${message.timestamp.toLocaleTimeString()}] `)
      : '';

    const sender = message.sender.isBot
      ? this.c(FG_CYAN, message.sender.name ?? message.sender.id)
      : this.c(FG_GREEN, message.sender.name ?? message.sender.id);

    return `${ts}${sender}: ${message.content.text ?? ''}`;
  }

  // ─── Inbound: Terminal → Agent (protected extract* methods) ──

  protected extractSender(payload: unknown): MessageSender {
    const p = payload as TuiPayload;
    return {
      id: p.senderId,
      name: p.senderName,
      isBot: false
    };
  }

  protected extractRecipient(payload: unknown): MessageRecipient {
    const p = payload as TuiPayload;
    return {
      id: p.recipientId,
      type: 'user'
    };
  }

  protected extractContent(payload: unknown): MessageContent {
    const p = payload as TuiPayload;
    return { type: 'text', text: p.text };
  }

  protected extractAttachments(_payload: unknown): Attachment[] | undefined {
    return undefined; // TUI is text-only
  }

  protected extractMetadata(_payload: unknown): MessageMetadata {
    return {};
  }

  // ─── Internal helpers ────────────────────────────────────────

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) {
      this.rl?.prompt();
      return;
    }

    // Built-in commands
    if (trimmed.startsWith('/')) {
      const handled = this.handleCommand(trimmed);
      if (handled) {
        this.rl?.prompt();
        return;
      }
    }

    // Build payload and emit as normalised message
    const payload: TuiPayload = {
      text: trimmed,
      senderId: this.tuiConfig.userId!,
      senderName: this.tuiConfig.userName!,
      recipientId: this.tuiConfig.sessionId!
    };

    const message = this.normalizeIncoming(payload);

    // Show the user's own message echoed back
    const label = this.c(`${BOLD}${FG_GREEN}`, '✎ You');
    const ts = this.tuiConfig.showTimestamp
      ? this.c(FG_GRAY, ` [${new Date().toLocaleTimeString()}]`)
      : '';
    console.log(`${label}${ts}: ${trimmed}`);

    this.emit('message', message);
  }

  private handleCommand(cmd: string): boolean {
    switch (cmd) {
      case '/quit':
      case '/exit':
        this.rl?.close();
        return true;

      case '/clear':
        console.clear();
        this.printBanner();
        return true;

      case '/help':
        this.printHelp();
        return true;

      case '/status':
        this.printStatus();
        return true;

      default:
        this.print(`Unknown command: ${cmd}. Type /help for available commands.`, FG_RED);
        return true;
    }
  }

  // ─── Display helpers ─────────────────────────────────────────

  private printBanner(): void {
    const banner = [
      '',
      this.c(`${BOLD}${FG_CYAN}`, '╔════════════════════════════════════════╗'),
      this.c(`${BOLD}${FG_CYAN}`, '║') + this.c(`${BOLD}${FG_MAGENTA}`, '        OpenClaw TUI Session           ') + this.c(`${BOLD}${FG_CYAN}`, '║'),
      this.c(`${BOLD}${FG_CYAN}`, '╚════════════════════════════════════════╝'),
      this.c(FG_GRAY, '  Type your message and press Enter to chat.'),
      this.c(FG_GRAY, '  Type /help for available commands.'),
      ''
    ];
    banner.forEach((l) => console.log(l));
  }

  private printHelp(): void {
    console.log(this.c(`${BOLD}${FG_CYAN}`, '\n── Available Commands ──'));
    for (const [cmd, desc] of Object.entries(BUILTIN_COMMANDS)) {
      console.log(`  ${this.c(FG_YELLOW, cmd.padEnd(10))} ${this.c(FG_GRAY, desc)}`);
    }
    console.log();
  }

  private printStatus(): void {
    console.log(this.c(`${BOLD}${FG_CYAN}`, '\n── Session Status ──'));
    console.log(`  Session ID : ${this.tuiConfig.sessionId}`);
    console.log(`  User ID    : ${this.tuiConfig.userId}`);
    console.log(`  User Name  : ${this.tuiConfig.userName}`);
    console.log(`  Channel    : ${this.channelName}`);
    console.log(`  Running    : ${this.isRunning}`);
    console.log(`  Colors     : ${this.colorEnabled}`);
    console.log();
  }

  /** Apply ANSI colour only when colour is enabled. */
  private c(ansi: string, text: string): string {
    return this.colorEnabled ? `${ansi}${text}${RESET}` : text;
  }

  private print(text: string, _color?: string): void {
    console.log(text);
  }
}
