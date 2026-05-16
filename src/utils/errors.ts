export class OpenClawError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OpenClawError';
  }
}

export class ChannelError extends OpenClawError {
  constructor(message: string, channel: string, cause?: Error) {
    super(message, 'CHANNEL_ERROR', { channel, cause: cause?.message });
    this.name = 'ChannelError';
  }
}

export class SkillLoadError extends OpenClawError {
  constructor(skillName: string, cause: Error) {
    super(
      `Failed to load skill: ${skillName}`,
      'SKILL_LOAD_ERROR',
      { skillName, cause: cause.message }
    );
    this.name = 'SkillLoadError';
  }
}

export class SkillExecutionError extends OpenClawError {
  constructor(skillName: string, toolName: string, cause: Error) {
    super(
      `Skill execution failed: ${skillName}.${toolName}`,
      'SKILL_EXECUTION_ERROR',
      { skillName, toolName, cause: cause.message }
    );
    this.name = 'SkillExecutionError';
  }
}

export class ToolExecutionError extends OpenClawError {
  constructor(toolName: string, cause: Error) {
    super(
      `Tool execution failed: ${toolName}`,
      'TOOL_EXECUTION_ERROR',
      { toolName, cause: cause.message }
    );
    this.name = 'ToolExecutionError';
  }
}

export class ConfigParseError extends OpenClawError {
  constructor(configFile: string, cause: Error) {
    super(
      `Failed to parse config file: ${configFile}`,
      'CONFIG_PARSE_ERROR',
      { configFile, cause: cause.message }
    );
    this.name = 'ConfigParseError';
  }
}

export class HeartbeatError extends OpenClawError {
  constructor(taskName: string, cause: Error) {
    super(
      `Heartbeat task failed: ${taskName}`,
      'HEARTBEAT_ERROR',
      { taskName, cause: cause.message }
    );
    this.name = 'HeartbeatError';
  }
}
