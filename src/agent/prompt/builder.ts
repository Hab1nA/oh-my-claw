import type { IdentityConfig, SoulConfig, UserPreferences, Message } from '../../types/index.js';
import type { ToolDefinition } from '../../types/tool.js';

export class PromptBuilder {
  private systemPromptOverride: string | undefined;

  setSystemPromptOverride(prompt: string): void {
    this.systemPromptOverride = prompt;
  }

  buildSystemPrompt(tools: ToolDefinition[]): string {
    const toolList = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    const basePrompt = this.systemPromptOverride ?? [
      'You are OpenClaw-Minimal, a local-first ReAct agent runtime.',
      'Use tools only when they are needed to complete the user task.',
      'When a tool result is returned, reason over the observation and continue until a final answer is ready.',
      'If a tool call fails, do NOT retry the same approach. Try a different tool or answer based on what you already know.',
      'Never invent tool results. Never request dangerous shell commands.'
    ].join('\n');

    return [
      basePrompt,
      'Available tools:',
      toolList
    ].join('\n');
  }

  buildSystemPromptFromConfig(
    soul: SoulConfig,
    identity: IdentityConfig,
    user: UserPreferences,
    tools: ToolDefinition[]
  ): string {
    const toolList = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    const parts: string[] = [];

    parts.push(`# Identity\nYou are ${identity.name}.`);

    if (identity.background) {
      parts.push(`\n## Background\n${identity.background}`);
    }

    if (identity.personality.length > 0) {
      parts.push(`\n## Personality\n${identity.personality.join(', ')}`);
    }

    if (identity.traits.length > 0) {
      parts.push(`\n## Traits\n${identity.traits.join(', ')}`);
    }

    parts.push(`\n# Core Values\n${soul.values}`);

    if (soul.behavior.length > 0) {
      parts.push(`\n## Behavior Guidelines\n${soul.behavior.map(b => `- ${b}`).join('\n')}`);
    }

    if (soul.guidelines.length > 0) {
      parts.push(`\n## Rules\n${soul.guidelines.map(g => `- ${g}`).join('\n')}`);
    }

    parts.push(`\n# User Context\nThe user's name is ${user.name}.`);
    parts.push(`Language preference: ${user.language}`);
    parts.push(`Timezone: ${user.timezone}`);

    parts.push('\n# Available tools:');
    parts.push(toolList);

    parts.push('\n# Instructions');
    parts.push('Use tools only when they are needed to complete the user task.');
    parts.push('When a tool result is returned, reason over the observation and continue until a final answer is ready.');
    parts.push('If a tool call fails, do NOT retry the same approach. Try a different tool or answer based on what you already know.');
    parts.push('Never invent tool results. Never request dangerous shell commands.');

    return this.systemPromptOverride ?? parts.join('\n');
  }

  buildMessages(messages: Message[]): Message[] {
    return messages.map((message) => ({
      ...message,
      content: this.compactContent(message.content)
    }));
  }

  private compactContent(content: string): string {
    const maxChars = 12000;
    if (content.length <= maxChars) return content;
    return content.slice(0, 6000) + '\n...[content truncated]...\n' + content.slice(-6000);
  }
}
