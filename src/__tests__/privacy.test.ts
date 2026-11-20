import { describe, expect, it, vi } from 'vitest';

const settings = { fullyLocal: false };
vi.mock('../db/repo', () => ({ getSettings: () => settings }));

describe('Fully local', () => {
  it('is off by default', async () => {
    expect((await import('../domain/types')).DEFAULT_SETTINGS.fullyLocal).toBe(false);
  });

  it('blocks every server and Drive request while on, and says why', async () => {
    const { assertCloudAllowed, cloudAllowed } = await import('../privacy');
    expect(cloudAllowed()).toBe(true);
    settings.fullyLocal = true;
    expect(cloudAllowed()).toBe(false);
    expect(() => assertCloudAllowed()).toThrow(/Fully local/);
    settings.fullyLocal = false;
  });
});
