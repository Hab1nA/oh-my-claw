export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  author?: string;
  triggers: SkillTrigger[];
  tools: string[];
  permissions?: string[];
}

export interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'schedule' | 'event';
  pattern?: string;
  keywords?: string[];
  schedule?: string;
  eventType?: string;
}

export interface LoadedSkill extends SkillDefinition {
  module: SkillModule;
  path: string;
}

export interface SkillModule {
  name: string;
  version: string;
  tools: Record<string, SkillToolDefinition>;
  triggers?: SkillTrigger[];
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  category?: string;
  parameters: import('./tool.js').ToolParameterSchema;
  handler: import('./tool.js').ToolHandler;
  tags?: string[];
}
