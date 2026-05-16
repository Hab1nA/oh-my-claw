import type { GatewayConfig } from '../config/types.js';

type LogLevel = GatewayConfig['logLevel'];

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  private static instance: Logger | undefined;
  private level: LogLevel = 'info';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write('error', message, data);
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) {
      return;
    }
    const record = {
      time: new Date().toISOString(),
      level,
      message,
      ...(data ? { data } : {})
    };
    const line = JSON.stringify(record);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

