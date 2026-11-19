import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Settings and the phone's cache are mocked so the real request code can run here.
const settings = { offline: true };
vi.mock('../../db/repo', () => ({ getSettings: () => settings }));
vi.mock('expo-file-system', () => {
  class File {
    exists = false;
    name = '';
    async text() {
      return '';
    }
    create() {}
    write() {}
    delete() {}
  }
  class Directory {
    list() {
      return [];
    }
  }
  return { File, Directory, Paths: { cache: '/cache' } };
});

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('offline mode', () => {
  it('sends nothing for search, details or labels', async () => {
    settings.offline = true;
    const online = await import('../online');
    const hits = await online.searchMedicines('panadol');
    const details = await online.medicineDetails('Panadol', 'paracetamol');
    const label = await online.fetchLabel('paracetamol');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hits.some((h) => h.name.toLowerCase().includes('panadol'))).toBe(true); // built-in list still works
    expect(details.generic).toBe('paracetamol');
    expect(label).toBeNull();
  });

  it('goes online when offline mode is off, with no cookies', async () => {
    settings.offline = false;
    const online = await import('../online');
    await online.fetchLabel('paracetamol');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/api\.fda\.gov\//);
    expect(init.credentials).toBe('omit');
  });
});
