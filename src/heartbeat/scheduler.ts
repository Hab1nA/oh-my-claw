import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import { CronParser } from './cron.js';
import type { HeartbeatTask, HeartbeatAction, ScheduledTask } from '../types/index.js';
import type { ToolRegistryContract } from '../tools/registry.js';
import type { ChannelRouter } from '../channels/types.js';
import { logger, filterEnvVars } from '../utils/index.js';

export class HeartbeatScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronParser: CronParser;
  private toolRegistry: ToolRegistryContract;
  private channelRouter: ChannelRouter;
  private checkInterval: ReturnType<typeof setInterval> | undefined;
  private isRunning: boolean = false;

  constructor(
    toolRegistry: ToolRegistryContract,
    channelRouter: ChannelRouter
  ) {
    this.cronParser = new CronParser();
    this.toolRegistry = toolRegistry;
    this.channelRouter = channelRouter;
  }

  async loadTasks(configPath: string): Promise<void> {
    const heartbeatPath = join(configPath, 'HEARTBEAT.md');
    
    if (!existsSync(heartbeatPath)) {
      logger.info('No HEARTBEAT.md found, heartbeat scheduler not enabled');
      return;
    }

    try {
      const content = await fs.readFile(heartbeatPath, 'utf-8');
      const tasks = this.parseHeartbeatConfig(content);

      for (const task of tasks) {
        await this.registerTask(task);
      }

      logger.info(`Loaded ${tasks.length} heartbeat tasks`);
    } catch (error) {
      logger.error('Failed to load heartbeat tasks', { error: (error as Error).message });
    }
  }

  async registerTask(taskDef: HeartbeatTask): Promise<void> {
    try {
      const nextRun = this.cronParser.getNextRun(
        taskDef.schedule,
        taskDef.timezone
      );

      const scheduledTask: ScheduledTask = {
        task: taskDef,
        nextRun
      };

      this.tasks.set(taskDef.id, scheduledTask);
      
      logger.info(`Registered heartbeat task: ${taskDef.name}`, {
        schedule: taskDef.schedule,
        nextRun: nextRun.toISOString()
      });
    } catch (error) {
      logger.error(`Failed to register task: ${taskDef.name}`, {
        error: (error as Error).message
      });
    }
  }

  unregisterTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      this.tasks.delete(taskId);
      logger.info(`Unregistered heartbeat task: ${task.task.name}`);
      return true;
    }
    return false;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Heartbeat scheduler is already running');
      return;
    }

    this.isRunning = true;
    
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteTasks().catch(error => {
        logger.error('Error in heartbeat check', { error: (error as Error).message });
      });
    }, 60000);

    logger.info('Heartbeat scheduler started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.isRunning = false;
    logger.info('Heartbeat scheduler stopped');
  }

  private runningTasks = new Set<string>();

  private async checkAndExecuteTasks(): Promise<void> {
    const now = new Date();

    for (const [taskId, scheduledTask] of this.tasks) {
      if (!scheduledTask.task.enabled) continue;
      if (this.runningTasks.has(taskId)) continue;

      if (scheduledTask.nextRun <= now) {
        this.runningTasks.add(taskId);
        this.executeTask(scheduledTask)
          .then(() => {
            scheduledTask.lastRun = now;
            try {
              scheduledTask.nextRun = this.cronParser.getNextRun(
                scheduledTask.task.schedule,
                scheduledTask.task.timezone
              );
            } catch (error) {
              logger.error(`Failed to calculate next run for task: ${taskId}`, {
                error: (error as Error).message
              });
              scheduledTask.task.enabled = false;
            }
          })
          .catch((error: unknown) => {
            logger.error(`Heartbeat task execution failed: ${scheduledTask.task.name}`, {
              error: (error as Error).message
            });
            scheduledTask.lastResult = {
              success: false,
              executedAt: new Date(),
              error: (error as Error).message
            };
            try {
              scheduledTask.nextRun = this.cronParser.getNextRun(
                scheduledTask.task.schedule,
                scheduledTask.task.timezone
              );
            } catch {
              scheduledTask.task.enabled = false;
            }
          })
          .finally(() => {
            this.runningTasks.delete(taskId);
          });
      }
    }
  }

  private async executeTask(scheduledTask: ScheduledTask): Promise<void> {
    const { task } = scheduledTask;
    logger.info(`Executing heartbeat task: ${task.name}`);

    try {
      for (const action of task.actions) {
        await this.executeAction(action, task);
      }

      scheduledTask.lastResult = {
        success: true,
        executedAt: new Date()
      };

      logger.info(`Heartbeat task completed: ${task.name}`);
    } catch (error) {
      logger.error(`Heartbeat task failed: ${task.name}`, {
        error: (error as Error).message
      });

      scheduledTask.lastResult = {
        success: false,
        executedAt: new Date(),
        error: (error as Error).message
      };
    }
  }

  private async executeAction(action: HeartbeatAction, task: HeartbeatTask): Promise<void> {
    switch (action.type) {
      case 'skill':
        if (action.skill && this.toolRegistry.hasTool(action.skill)) {
          await this.toolRegistry.executeTool(
            action.skill,
            action.params ?? {},
            {
              sessionId: task.id,
              userId: 'heartbeat',
              workingDirectory: process.cwd(),
              environment: filterEnvVars(process.env)
            }
          );
        } else {
          logger.warn(`Skill not found: ${action.skill}`);
        }
        break;

      case 'notification':
        if (action.message && action.channel) {
          const adapter = this.channelRouter.getAdapter(action.channel);
          if (adapter) {
            await adapter.send(task.id, {
              content: {
                type: 'text',
                text: action.message
              }
            });
          } else {
            logger.warn(`Channel not found: ${action.channel}`);
          }
        }
        break;

      case 'command':
        if (action.command && this.toolRegistry.hasTool('shell')) {
          await this.toolRegistry.executeTool(
            'shell',
            { command: action.command },
            {
              sessionId: task.id,
              userId: 'heartbeat',
              workingDirectory: process.cwd(),
              environment: filterEnvVars(process.env)
            }
          );
        } else {
          logger.warn('Shell tool not available for command execution');
        }
        break;
    }
  }

  private parseHeartbeatConfig(content: string): HeartbeatTask[] {
    const tasks: HeartbeatTask[] = [];
    const taskBlocks = content.split(/^###\s+/m).filter(Boolean);

    for (const block of taskBlocks) {
      const lines = block.split('\n');
      const name = lines[0]?.trim() ?? '';

      if (!name) continue;

      const task: HeartbeatTask = {
        id: this.generateTaskId(name),
        name,
        description: '',
        schedule: '',
        enabled: true,
        actions: []
      };

      for (const line of lines.slice(1)) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('schedule:') || trimmedLine.startsWith('when:')) {
          const parts = trimmedLine.split(':');
          task.schedule = parts.slice(1).join(':').trim();
        } else if (trimmedLine.startsWith('timezone:')) {
          const parts = trimmedLine.split(':');
          task.timezone = parts.slice(1).join(':').trim();
        } else if (trimmedLine.startsWith('enabled:')) {
          const parts = trimmedLine.split(':');
          task.enabled = parts[1]?.trim()?.toLowerCase() !== 'false';
        } else if (trimmedLine.startsWith('-')) {
          const actionStr = trimmedLine.substring(1).trim();
          const actions = this.parseActionString(actionStr);
          task.actions.push(...actions);
        }
      }

      if (task.schedule && task.actions.length > 0) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  private parseActionString(actionStr: string): HeartbeatAction[] {
    const actions: HeartbeatAction[] = [];

    if (actionStr.startsWith('skill:')) {
      const skillPart = actionStr.substring(6).trim();
      const [skill, ...paramParts] = skillPart.split('|').map(s => s.trim());
      
      let params: Record<string, unknown> | undefined;
      if (paramParts.length > 0) {
        try {
          params = JSON.parse(paramParts.join('|'));
        } catch {
          params = undefined;
        }
      }

      if (skill) {
        actions.push({ type: 'skill', skill, params });
      }
    } else if (actionStr.startsWith('notify:')) {
      const parts = actionStr.substring(7).trim().split('|').map(s => s.trim());
      const message = parts[0] ?? '';
      const channel = parts[1] ?? 'telegram';
      
      actions.push({ type: 'notification', message, channel });
    } else if (actionStr.startsWith('run:')) {
      const command = actionStr.substring(4).trim();
      actions.push({ type: 'command', command });
    }

    return actions;
  }

  private generateTaskId(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `heartbeat_${sanitized}_${Date.now()}`;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  enableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.task.enabled = true;
      logger.info(`Task enabled: ${task.task.name}`);
      return true;
    }
    return false;
  }

  disableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.task.enabled = false;
      logger.info(`Task disabled: ${task.task.name}`);
      return true;
    }
    return false;
  }

  async triggerTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      await this.executeTask(task);
    }
  }
}
