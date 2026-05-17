import { CronParser } from '../heartbeat/cron.js';

describe('CronParser', () => {
  let parser: CronParser;

  beforeEach(() => {
    parser = new CronParser();
  });

  describe('parse', () => {
    it('should parse a valid 5-field cron expression', () => {
      const result = parser.parse('0 8 * * 1-5');
      expect(result.minute).toEqual([0]);
      expect(result.hour).toEqual([8]);
      expect(result.dayOfMonth.length).toBe(31);
      expect(result.month.length).toBe(12);
      expect(result.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse */5 step expression', () => {
      const result = parser.parse('*/5 * * * *');
      expect(result.minute).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    });

    it('should throw on invalid field count', () => {
      expect(() => parser.parse('0 8 * *')).toThrow('Invalid cron expression');
    });
  });

  describe('matches', () => {
    it('should match a weekday-only schedule on a weekday', () => {
      const monday = new Date('2026-05-18T08:00:00Z');
      expect(parser.matches('0 8 * * 1-5', monday)).toBe(true);
    });

    it('should NOT match a weekday-only schedule on Saturday', () => {
      const saturday = new Date('2026-05-16T08:00:00Z');
      expect(parser.matches('0 8 * * 1-5', saturday)).toBe(false);
    });

    it('should NOT match a weekday-only schedule on Sunday', () => {
      const sunday = new Date('2026-05-17T08:00:00Z');
      expect(parser.matches('0 8 * * 1-5', sunday)).toBe(false);
    });

    it('should match every-minute expression for any time', () => {
      const anyDate = new Date('2026-05-17T14:30:00Z');
      expect(parser.matches('* * * * *', anyDate)).toBe(true);
    });

    it('should match specific day-of-month when dayOfWeek is wildcard', () => {
      const firstDay = new Date('2026-05-01T08:00:00Z');
      expect(parser.matches('0 8 1 * *', firstDay)).toBe(true);
    });

    it('should NOT match wrong day-of-month', () => {
      const secondDay = new Date('2026-05-02T08:00:00Z');
      expect(parser.matches('0 8 1 * *', secondDay)).toBe(false);
    });
  });

  describe('getNextRun', () => {
    it('should return a future date', () => {
      const next = parser.getNextRun('0 8 * * *');
      expect(next.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should throw for an expression that never matches', () => {
      expect(() => parser.getNextRun('0 0 31 2 *')).toThrow();
    });
  });
});
