export class CronParser {
  parse(expression: string): ParsedCron {
    const parts = expression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}. Expected 5 fields (minute hour day-of-month month day-of-week)`);
    }

    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];

    if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
      throw new Error(`Invalid cron expression: ${expression}. Missing fields.`);
    }

    return {
      minute: this.parseField(minute, 0, 59),
      hour: this.parseField(hour, 0, 23),
      dayOfMonth: this.parseField(dayOfMonth, 1, 31),
      month: this.parseField(month, 1, 12),
      dayOfWeek: this.parseField(dayOfWeek, 0, 6),
      original: expression
    };
  }

  private parseField(field: string, min: number, max: number): number[] {
    if (field === '*') {
      return this.range(min, max);
    }

    if (field.includes('/')) {
      return this.parseStep(field, min, max);
    }

    if (field.includes('-')) {
      return this.parseRange(field, min, max);
    }

    if (field.includes(',')) {
      return this.parseList(field, min, max);
    }

    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid cron field value: ${field}`);
    }

    return [value];
  }

  private parseStep(field: string, min: number, max: number): number[] {
    const parts = field.split('/');
    const base = parts[0];
    const stepStr = parts[1];
    
    if (!base || !stepStr) {
      throw new Error(`Invalid step format: ${field}`);
    }
    
    const step = parseInt(stepStr, 10);

    if (isNaN(step) || step <= 0) {
      throw new Error(`Invalid step value: ${stepStr}`);
    }

    let start: number;
    let end: number;

    if (base === '*') {
      start = min;
      end = max;
    } else if (base.includes('-')) {
      const rangeParts = base.split('-');
      const startStr = rangeParts[0];
      const endStr = rangeParts[1];
      if (!startStr || !endStr) {
        throw new Error(`Invalid range format: ${base}`);
      }
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);
    } else {
      start = parseInt(base, 10);
      end = max;
    }

    const result: number[] = [];
    for (let i = start; i <= end; i += step) {
      result.push(i);
    }

    return result;
  }

  private parseRange(field: string, min: number, max: number): number[] {
    const parts = field.split('-');
    const startStr = parts[0];
    const endStr = parts[1];
    
    if (!startStr || !endStr) {
      throw new Error(`Invalid range format: ${field}`);
    }
    
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid range: ${field}`);
    }

    return this.range(start, end);
  }

  private parseList(field: string, min: number, max: number): number[] {
    const values = field.split(',').map(v => parseInt(v.trim(), 10));
    
    for (const v of values) {
      if (isNaN(v) || v < min || v > max) {
        throw new Error(`Invalid list value in: ${field}`);
      }
    }

    return [...new Set(values)].sort((a, b) => a - b);
  }

  private range(start: number, end: number): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }

  getNextRun(expression: string, timezone?: string): Date {
    const parsed = this.parse(expression);
    const now = new Date();
    
    const tzOffset = timezone ? this.getTimezoneOffset(timezone) : 0;
    const adjustedNow = new Date(now.getTime() + tzOffset);

    for (let year = adjustedNow.getFullYear(); year < adjustedNow.getFullYear() + 5; year++) {
      for (const month of parsed.month) {
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (const day of parsed.dayOfMonth) {
          if (day > daysInMonth) continue;

          const date = new Date(year, month - 1, day);
          const dow = date.getDay();

          if (!parsed.dayOfWeek.includes(dow)) continue;

          for (const hour of parsed.hour) {
            for (const minute of parsed.minute) {
              const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
              
              if (candidate.getTime() > adjustedNow.getTime()) {
                return new Date(candidate.getTime() - tzOffset);
              }
            }
          }
        }
      }
    }

    throw new Error('Could not find next run time within 5 years');
  }

  private getTimezoneOffset(timezone: string): number {
    try {
      const now = new Date();
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      return tzDate.getTime() - utcDate.getTime();
    } catch {
      return 0;
    }
  }

  matches(expression: string, date: Date): boolean {
    const parsed = this.parse(expression);
    
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    return parsed.minute.includes(minute) &&
           parsed.hour.includes(hour) &&
           parsed.month.includes(month) &&
           (parsed.dayOfMonth.includes(dayOfMonth) || parsed.dayOfWeek.includes(dayOfWeek));
  }

  getDescription(expression: string): string {
    const parsed = this.parse(expression);
    
    const minuteStr = this.fieldDescription(parsed.minute, 0, 59, 'minute');
    const hourStr = this.fieldDescription(parsed.hour, 0, 23, 'hour');
    const domStr = this.fieldDescription(parsed.dayOfMonth, 1, 31, 'day of month');
    const monthStr = this.fieldDescription(parsed.month, 1, 12, 'month');
    const dowStr = this.fieldDescription(parsed.dayOfWeek, 0, 6, 'day of week');

    return `Every ${minuteStr} ${hourStr} on ${domStr} of ${monthStr} (${dowStr})`;
  }

  private fieldDescription(values: number[], min: number, max: number, name: string): string {
    if (values.length === max - min + 1) {
      return `every ${name}`;
    }
    if (values.length === 1) {
      return `${name} ${values[0]}`;
    }
    return `${name}s ${values.join(', ')}`;
  }
}

export interface ParsedCron {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
  original: string;
}
