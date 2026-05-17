import { PromptBuilder } from '../agent/prompt/builder.js';
import type { SoulConfig, IdentityConfig, UserPreferences } from '../types/config.js';
import type { ToolDefinition } from '../types/tool.js';

const mockTools: ToolDefinition[] = [
  {
    name: 'test_tool',
    description: 'A test tool',
    parameters: { type: 'object', properties: {} },
    handler: async () => ({ success: true })
  }
];

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  it('should build a default system prompt with tools', () => {
    const prompt = builder.buildSystemPrompt(mockTools);
    expect(prompt).toContain('OpenClaw-Minimal');
    expect(prompt).toContain('test_tool');
    expect(prompt).toContain('Available tools');
  });

  it('should use system prompt override when set', () => {
    builder.setSystemPromptOverride('Custom prompt');
    const prompt = builder.buildSystemPrompt(mockTools);
    expect(prompt).toContain('Custom prompt');
    expect(prompt).toContain('test_tool');
  });

  it('should build prompt from config', () => {
    const soul: SoulConfig = {
      values: 'Be helpful',
      behavior: ['Be concise'],
      guidelines: ['Do no harm']
    };
    const identity: IdentityConfig = {
      name: 'TestBot',
      background: 'A test assistant',
      personality: ['Friendly'],
      traits: ['Reliable']
    };
    const user: UserPreferences = {
      name: 'Alice',
      language: 'en',
      timezone: 'UTC',
      channels: [],
      notificationPreferences: { enabled: true }
    };

    const prompt = builder.buildSystemPromptFromConfig(soul, identity, user, mockTools);
    expect(prompt).toContain('TestBot');
    expect(prompt).toContain('Be helpful');
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('test_tool');
  });

  it('should truncate long message content', () => {
    const longContent = 'x'.repeat(15000);
    const messages = [{ id: '1', role: 'user' as const, content: longContent, timestamp: new Date() }];
    const result = builder.buildMessages(messages);
    expect(result[0]!.content.length).toBeLessThan(longContent.length);
    expect(result[0]!.content).toContain('content truncated');
  });
});
