import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import type { SoulConfig, IdentityConfig, UserPreferences, NotificationPreferences } from '../types/index.js';
import { logger, ConfigParseError } from '../utils/index.js';

export class ConfigParser {
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async parseSoul(): Promise<SoulConfig> {
    const soulPath = join(this.configPath, 'SOUL.md');
    
    if (!existsSync(soulPath)) {
      logger.debug('SOUL.md not found, using default');
      return this.getDefaultSoul();
    }

    try {
      const content = await fs.readFile(soulPath, 'utf-8');
      return this.parseSoulMarkdown(content);
    } catch (error) {
      throw new ConfigParseError('SOUL.md', error as Error);
    }
  }

  async parseIdentity(): Promise<IdentityConfig> {
    const identityPath = join(this.configPath, 'IDENTITY.md');
    
    if (!existsSync(identityPath)) {
      logger.debug('IDENTITY.md not found, using default');
      return this.getDefaultIdentity();
    }

    try {
      const content = await fs.readFile(identityPath, 'utf-8');
      return this.parseIdentityMarkdown(content);
    } catch (error) {
      throw new ConfigParseError('IDENTITY.md', error as Error);
    }
  }

  async parseUserPreferences(): Promise<UserPreferences> {
    const userPath = join(this.configPath, 'USER.md');
    
    if (!existsSync(userPath)) {
      logger.debug('USER.md not found, using default');
      return this.getDefaultUserPreferences();
    }

    try {
      const content = await fs.readFile(userPath, 'utf-8');
      return this.parseUserMarkdown(content);
    } catch (error) {
      throw new ConfigParseError('USER.md', error as Error);
    }
  }

  async parseAll(): Promise<{
    soul: SoulConfig;
    identity: IdentityConfig;
    user: UserPreferences;
  }> {
    const [soul, identity, user] = await Promise.all([
      this.parseSoul(),
      this.parseIdentity(),
      this.parseUserPreferences()
    ]);

    return { soul, identity, user };
  }

  private parseSoulMarkdown(content: string): SoulConfig {
    const sections = this.splitSections(content);

    return {
      values: sections['values'] ?? sections['core values'] ?? '',
      behavior: this.extractList(sections['behavior'] ?? sections['directives'] ?? ''),
      guidelines: this.extractList(sections['guidelines'] ?? sections['rules'] ?? '')
    };
  }

  private parseIdentityMarkdown(content: string): IdentityConfig {
    const sections = this.splitSections(content);
    const frontMatter = this.parseFrontMatter(content);

    const identity: IdentityConfig = {
      name: frontMatter['name'] ?? sections['name'] ?? 'Assistant',
      background: sections['background'] ?? sections['about'] ?? sections['story'] ?? '',
      personality: this.extractList(sections['personality'] ?? sections['traits'] ?? ''),
      traits: this.extractList(sections['traits'] ?? sections['characteristics'] ?? '')
    };

    const age = frontMatter['age'] ?? sections['age'];
    if (age) {
      identity.age = age;
    }

    const greeting = sections['greeting'] ?? sections['intro'];
    if (greeting) {
      identity.greeting = greeting;
    }

    return identity;
  }

  private parseUserMarkdown(content: string): UserPreferences {
    const sections = this.splitSections(content);
    const frontMatter = this.parseFrontMatter(content);

    const notificationPrefs: NotificationPreferences = {
      enabled: !sections['notifications']?.toLowerCase().includes('disabled')
    };

    const quietHours = this.extractQuietHours(sections['quiet hours'] ?? sections['quiethours'] ?? '');
    if (quietHours) {
      notificationPrefs.quietHours = quietHours;
    }

    return {
      name: frontMatter['name'] ?? sections['name'] ?? 'User',
      language: frontMatter['language'] ?? sections['language'] ?? 'en',
      timezone: frontMatter['timezone'] ?? sections['timezone'] ?? 'UTC',
      channels: this.extractList(sections['channels'] ?? ''),
      notificationPreferences: notificationPrefs
    };
  }

  private splitSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const sectionMatch = line.match(/^##?\s+(.+)$/);
      if (sectionMatch) {
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
        }
        currentSection = sectionMatch[1] ?? '';
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private parseFrontMatter(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return result;
    }

    const frontMatter = frontMatterMatch[1];
    if (!frontMatter) {
      return result;
    }
    
    const lines = frontMatter.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        if (key && value) {
          result[key.toLowerCase()] = value.trim();
        }
      }
    }

    return result;
  }

  private extractList(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private extractQuietHours(content: string): string | undefined {
    if (!content.trim()) {
      return undefined;
    }

    const match = content.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (match && match[1] && match[2]) {
      return `${match[1]}-${match[2]}`;
    }

    return content.trim() || undefined;
  }

  private getDefaultSoul(): SoulConfig {
    return {
      values: 'Be helpful, honest, and respectful. Prioritize user safety and privacy.',
      behavior: [
        'Be concise and to the point',
        'Ask clarifying questions when needed',
        'Admit when you do not know something',
        'Provide actionable suggestions'
      ],
      guidelines: [
        'Do not make up information',
        'Respect user privacy',
        'Avoid harmful or dangerous actions',
        'Be transparent about limitations'
      ]
    };
  }

  private getDefaultIdentity(): IdentityConfig {
    return {
      name: 'OpenClaw',
      background: 'An AI assistant designed to help users with various tasks. Powered by OpenClaw framework.',
      personality: ['Helpful', 'Friendly', 'Professional', 'Curious'],
      traits: ['Patient', 'Knowledgeable', 'Reliable', 'Adaptable']
    };
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      name: 'User',
      language: 'en',
      timezone: 'UTC',
      channels: [],
      notificationPreferences: {
        enabled: true
      }
    };
  }

  /**
   * @deprecated Use PromptBuilder.buildSystemPromptFromConfig() instead.
   * Kept for backward compatibility with INTEGRATION.md examples.
   */
  buildSystemPrompt(soul: SoulConfig, identity: IdentityConfig, user: UserPreferences): string {
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

    return parts.join('\n');
  }
}
