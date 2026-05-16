export class OpenClawError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OpenClawError';
  }
}

export class ToolExecutionError extends OpenClawError {
  constructor(toolName: string, cause: Error) {
    super(`Tool execution failed: ${toolName}`, 'TOOL_EXECUTION_ERROR', {
      toolName,
      cause: cause.message
    });
    this.name = 'ToolExecutionError';
  }
}

export class SessionNotFoundError extends OpenClawError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', { sessionId });
    this.name = 'SessionNotFoundError';
  }
}

