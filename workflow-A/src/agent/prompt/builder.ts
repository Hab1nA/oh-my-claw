import type { Message } from '../../shared/types.js';
import type { ToolDefinition } from '../../tools/types.js';

export class PromptBuilder {
  buildSystemPrompt(tools: ToolDefinition[]): string {
    const toolList = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join('\n');
    return [
      'You are OpenClaw-Minimal, a local-first ReAct agent runtime.',
      'Use tools only when they are needed to complete the user task.',
      'When a tool result is returned, reason over the observation and continue until a final answer is ready.',
      'Never invent tool results. Never request dangerous shell commands.',
      'Available tools:',
      toolList
    ].join('\n');
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

