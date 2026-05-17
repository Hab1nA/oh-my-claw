import { randomId, filterEnvVars } from '../utils/id.js';

describe('randomId', () => {
  it('should return a UUID string', () => {
    const id = randomId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomId()));
    expect(ids.size).toBe(100);
  });
});

describe('filterEnvVars', () => {
  it('should filter out undefined values', () => {
    const result = filterEnvVars({ FOO: 'bar', BAZ: undefined });
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('should filter out sensitive environment variables', () => {
    const result = filterEnvVars({
      PATH: '/usr/bin',
      API_KEY: 'secret123',
      DATABASE_PASSWORD: 'pass',
      MY_TOKEN: 'tok',
      NODE_ENV: 'test'
    });
    expect(result.PATH).toBe('/usr/bin');
    expect(result.NODE_ENV).toBe('test');
    expect(result.API_KEY).toBeUndefined();
    expect(result.DATABASE_PASSWORD).toBeUndefined();
    expect(result.MY_TOKEN).toBeUndefined();
  });
});
