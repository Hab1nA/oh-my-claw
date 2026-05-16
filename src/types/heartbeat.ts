export interface HeartbeatTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  actions: HeartbeatAction[];
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatAction {
  type: 'skill' | 'command' | 'notification';
  skill?: string;
  params?: Record<string, unknown>;
  command?: string;
  message?: string;
  channel?: string;
}

export interface ScheduledTask {
  task: HeartbeatTask;
  nextRun: Date;
  lastRun?: Date;
  lastResult?: TaskResult;
}

export interface TaskResult {
  success: boolean;
  executedAt: Date;
  error?: string;
}
