import { TuiAdapter } from '../channels/tui/adapter.js';
import type { NormalizedMessage, OutboundMessage } from '../types/index.js';

// ── Test helpers ─────────────────────────────────────────────────
function makeAdapter(overrides: Record<string, unknown> = {}) {
  return new TuiAdapter({
    name: 'tui',
    enabled: true,
    sessionId: 'test-session',
    userId: 'test-user',
    userName: 'Test User',
    colorEnabled: false,
    disableAutoReconnect: true,
    ...overrides
  });
}

/**
 * Expose protected normalizeIncoming for direct testing.
 * We create a thin subclass that makes the method public.
 */
class TestableTuiAdapter extends TuiAdapter {
  public normalize(payload: unknown): NormalizedMessage {
    return this.normalizeIncoming(payload);
  }
}

// ── Tests ────────────────────────────────────────────────────────
describe('TuiAdapter', () => {
  describe('properties', () => {
    it('should have channelName "tui"', () => {
      const adapter = makeAdapter();
      expect(adapter.channelName).toBe('tui');
    });

    it('should support text content type', () => {
      const adapter = makeAdapter();
      expect(adapter.supportedContentTypes).toEqual(['text']);
    });
  });

  describe('validateConfig', () => {
    it('should pass with valid config', () => {
      const adapter = makeAdapter();
      expect(() => adapter.validateConfig()).not.toThrow();
    });
  });

  describe('normalizeIncoming (via subclass)', () => {
    let adapter: TestableTuiAdapter;

    beforeEach(() => {
      adapter = new TestableTuiAdapter({
        name: 'tui',
        enabled: true,
        sessionId: 'test-session',
        userId: 'u1',
        userName: 'Alice',
        colorEnabled: false,
        disableAutoReconnect: true
      });
    });

    it('should produce a NormalizedMessage with correct channel', () => {
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.channel).toBe('tui');
    });

    it('should extract sender correctly', () => {
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.sender.id).toBe('u1');
      expect(msg.sender.name).toBe('Alice');
      expect(msg.sender.isBot).toBe(false);
    });

    it('should extract recipient as user type', () => {
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.recipient.id).toBe('test-session');
      expect(msg.recipient.type).toBe('user');
    });

    it('should extract text content', () => {
      const msg = adapter.normalize({
        text: 'hello world',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.content.type).toBe('text');
      expect(msg.content.text).toBe('hello world');
    });

    it('should have no attachments', () => {
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.attachments).toBeUndefined();
    });

    it('should have empty metadata', () => {
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.metadata).toBeDefined();
    });

    it('should generate unique message ids', () => {
      const msg1 = adapter.normalize({
        text: 'a',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      const msg2 = adapter.normalize({
        text: 'b',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should set timestamp to a Date', () => {
      const before = Date.now();
      const msg = adapter.normalize({
        text: 'hello',
        senderId: 'u1',
        senderName: 'Alice',
        recipientId: 'test-session'
      });
      expect(msg.timestamp).toBeInstanceOf(Date);
      expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  describe('formatMessage', () => {
    it('should return a string containing sender name and text', async () => {
      const adapter = makeAdapter({ colorEnabled: false, showTimestamp: false });
      const msg: NormalizedMessage = {
        id: '1',
        channel: 'tui',
        sender: { id: 'u1', name: 'Alice', isBot: false },
        recipient: { id: 's1', type: 'user' },
        content: { type: 'text', text: 'hi' },
        timestamp: new Date('2026-01-01T12:00:00Z'),
        metadata: {}
      };
      const formatted = await adapter.formatMessage(msg);
      expect(formatted).toContain('Alice');
      expect(formatted).toContain('hi');
    });

    it('should include timestamp when showTimestamp is true', async () => {
      const adapter = makeAdapter({ colorEnabled: false, showTimestamp: true });
      const msg: NormalizedMessage = {
        id: '1',
        channel: 'tui',
        sender: { id: 'u1', name: 'Alice', isBot: false },
        recipient: { id: 's1', type: 'user' },
        content: { type: 'text', text: 'hi' },
        timestamp: new Date('2026-01-01T12:00:00Z'),
        metadata: {}
      };
      const formatted = await adapter.formatMessage(msg);
      // Should contain some time-like pattern
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('send', () => {
    let consoleSpy: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should print response text to stdout', async () => {
      const adapter = makeAdapter({ colorEnabled: false });
      await adapter.send('user1', {
        content: { type: 'text', text: 'Agent says hello' }
      });
      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Agent says hello');
      expect(output).toContain('OpenClaw');
    });

    it('should not print empty messages', async () => {
      const adapter = makeAdapter({ colorEnabled: false });
      await adapter.send('user1', {
        content: { type: 'text', text: '' }
      });
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('stopListening', () => {
    it('should resolve without error when not started', async () => {
      const adapter = makeAdapter();
      await expect(adapter.stopListening()).resolves.toBeUndefined();
    });
  });
});
