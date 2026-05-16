import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';
import type { ToolDefinition, SkillDefinition, SkillTrigger, LoadedSkill, SkillModule } from '../types/index.js';
import type { ToolRegistryContract } from './registry.js';
import { logger, SkillLoadError } from '../utils/index.js';

export class SkillsLoader {
  private skillsPath: string;
  private toolRegistry: ToolRegistryContract;
  private skills: Map<string, LoadedSkill> = new Map();

  constructor(skillsPath: string, toolRegistry: ToolRegistryContract) {
    this.skillsPath = skillsPath;
    this.toolRegistry = toolRegistry;
  }

  async loadAll(): Promise<void> {
    if (!existsSync(this.skillsPath)) {
      logger.info(`Skills path does not exist: ${this.skillsPath}`);
      return;
    }

    try {
      const entries = await fs.readdir(this.skillsPath, { withFileTypes: true });
      const skillDirs = entries.filter(entry => entry.isDirectory());

      for (const dir of skillDirs) {
        const skillPath = join(this.skillsPath, dir.name);
        try {
          await this.loadSkill(skillPath, dir.name);
        } catch (error) {
          logger.error(`Failed to load skill ${dir.name}, skipping`, {
            error: (error as Error).message
          });
        }
      }

      logger.info(`Loaded ${this.skills.size} skills`);
    } catch (error) {
      logger.error('Failed to load skills', { error: (error as Error).message });
    }
  }

  private async loadSkill(skillPath: string, skillName: string): Promise<void> {
    try {
      const configPath = join(skillPath, 'skill.yaml');
      if (!existsSync(configPath)) {
        logger.warn(`Skill ${skillName}: No skill.yaml found, skipping`);
        return;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent) as SkillDefinition;

      const skillModule = await this.loadSkillModule(skillPath, skillName);
      if (!skillModule) {
        return;
      }

      const loadedSkill: LoadedSkill = {
        ...config,
        module: skillModule,
        path: skillPath
      };

      for (const toolName of config.tools) {
        const tool = skillModule.tools[toolName];
        if (tool) {
          const toolDef: ToolDefinition = {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            handler: tool.handler,
            tags: [...(tool.tags ?? []), `skill:${config.name}`]
          };
          if (tool.category) {
            toolDef.category = tool.category;
          }
          this.toolRegistry.registerTool(toolDef);
        } else {
          logger.warn(`Skill ${skillName}: Tool ${toolName} not found in module`);
        }
      }

      this.skills.set(config.name, loadedSkill);
      logger.info(`Loaded skill: ${config.name} v${config.version}`, {
        tools: config.tools,
        triggers: config.triggers.length
      });
    } catch (error) {
      throw new SkillLoadError(skillName, error as Error);
    }
  }

  private async loadSkillModule(skillPath: string, skillName: string): Promise<SkillModule | null> {
    const indexJsPath = join(skillPath, 'index.js');
    const indexPath = join(skillPath, 'index.ts');

    try {
      let skillModule: SkillModule;

      if (existsSync(indexJsPath)) {
        const module = await import(indexJsPath);
        skillModule = module.default ?? module;
      } else if (existsSync(indexPath)) {
        const module = await import(indexPath);
        skillModule = module.default ?? module;
      } else {
        logger.warn(`Skill ${skillName}: No index.js/ts found, skipping`);
        return null;
      }

      if (!skillModule.name || !skillModule.tools) {
        logger.warn(`Skill ${skillName}: Invalid module structure`);
        return null;
      }

      return skillModule;
    } catch (error) {
      logger.error(`Failed to load skill module ${skillName}`, {
        error: (error as Error).message
      });
      return null;
    }
  }

  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values()).map(skill => {
      const def: SkillDefinition = {
        name: skill.name,
        version: skill.version,
        description: skill.description,
        triggers: skill.triggers,
        tools: skill.tools
      };
      if (skill.author) {
        def.author = skill.author;
      }
      if (skill.permissions) {
        def.permissions = skill.permissions;
      }
      return def;
    });
  }

  async reloadSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      await this.unloadSkill(name);
      await this.loadSkill(skill.path, name);
      logger.info(`Reloaded skill: ${name}`);
    }
  }

  async unloadSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      for (const toolName of skill.tools) {
        this.toolRegistry.unregisterTool(toolName);
      }
      this.skills.delete(name);
      logger.info(`Unloaded skill: ${name}`);
    }
  }

  findMatchingSkills(text: string): LoadedSkill[] {
    const matchingSkills: LoadedSkill[] = [];
    const textLower = text.toLowerCase();

    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        if (this.matchesTrigger(trigger, textLower)) {
          matchingSkills.push(skill);
          break;
        }
      }
    }

    return matchingSkills;
  }

  private matchesTrigger(trigger: SkillTrigger, textLower: string): boolean {
    switch (trigger.type) {
      case 'keyword':
        if (trigger.keywords) {
          return trigger.keywords.some(keyword =>
            textLower.includes(keyword.toLowerCase())
          );
        }
        break;

      case 'pattern':
        if (trigger.pattern) {
          try {
            const regex = new RegExp(trigger.pattern, 'i');
            return regex.test(textLower);
          } catch {
            return false;
          }
        }
        break;
    }

    return false;
  }

  getSkillCount(): number {
    return this.skills.size;
  }
}
