/**
 * A tiny client for PocketBase: the Sabr server, or one you run yourself. Only used when
 * you turn sync on. Everything stored is already encrypted on the phone (see crypto.ts).
 *
 * Server setup: server/README.md. One collection, "vaults":
 *   owner (relation to users), kind ("backup" | "share"), data (encrypted text).
 */

export type Fetch = typeof fetch;

export interface Session {
  server: string;
  token: string;
  userId: string;
  email: string;
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

function normalizeServer(url: string): string {
  let s = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

async function call<T>(f: Fetch, url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = init.token;
  let res: Response;
  try {
    res = await f(url, { ...init, headers });
  } catch (e) {
    // Fully local refused before anything was sent; say that rather than "can't reach".
    if (e instanceof Error && e.name === 'FullyLocalError') throw e;
    throw new SyncError('Could not reach the server. Check the address and your connection.');
  }
  const text = await res.text();
  let body: { message?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    if (res.ok) throw new SyncError('The server sent something unexpected. Check the address points to your PocketBase server.', res.status);
  }
  if (!res.ok) {
    const msg =
      res.status === 401 || res.status === 403
        ? 'Signed out. Sign in to your server again.'
        : res.status === 404
          ? 'Not found on the server.'
          : body?.message || `Server error (${res.status})`;
    throw new SyncError(msg, res.status);
  }
  return body as T;
}

export async function signIn(f: Fetch, server: string, email: string, password: string): Promise<Session> {
  const s = normalizeServer(server);
  const r = await call<{ token: string; record: { id: string; email: string } }>(f, `${s}/api/collections/users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: email.trim(), password }),
  });
  return { server: s, token: r.token, userId: r.record.id, email: r.record.email ?? email.trim() };
}

export async function signUp(f: Fetch, server: string, email: string, password: string): Promise<Session> {
  const s = normalizeServer(server);
  await call(f, `${s}/api/collections/users/records`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password, passwordConfirm: password }),
  });
  return signIn(f, s, email, password);
}

/** Extends the session; tokens otherwise expire after the server's set time. */
export async function refresh(f: Fetch, session: Session): Promise<Session> {
  const r = await call<{ token: string }>(f, `${session.server}/api/collections/users/auth-refresh`, { method: 'POST', token: session.token });
  return { ...session, token: r.token };
}

interface VaultRecord {
  id: string;
  kind: 'backup' | 'share';
  data: string;
  updated: string;
}

/** Creates or replaces your vault of a kind. Returns its record id. */
export async function putVault(f: Fetch, session: Session, kind: VaultRecord['kind'], data: string, id?: string | null): Promise<string> {
  const base = `${session.server}/api/collections/vaults/records`;
  if (id) {
    try {
      const r = await call<VaultRecord>(f, `${base}/${id}`, { method: 'PATCH', token: session.token, body: JSON.stringify({ data }) });
      return r.id;
    } catch (e) {
      if (!(e instanceof SyncError) || e.status !== 404) throw e;
    }
  }
  const r = await call<VaultRecord>(f, base, { method: 'POST', token: session.token, body: JSON.stringify({ owner: session.userId, kind, data }) });
  return r.id;
}

/** All your vaults of a kind, newest first. */
export async function listVaults(f: Fetch, session: Session, kind: VaultRecord['kind']): Promise<VaultRecord[]> {
  const q = encodeURIComponent(`kind="${kind}"`);
  const r = await call<{ items: VaultRecord[] }>(f, `${session.server}/api/collections/vaults/records?filter=${q}&sort=-updated&perPage=50`, {
    token: session.token,
  });
  return r.items;
}

/** Reads a shared vault. No account needed: knowing the id is the permission, and the key unlocks it. */
export async function getShared(f: Fetch, server: string, id: string): Promise<{ data: string; updated: string }> {
  const r = await call<VaultRecord>(f, `${normalizeServer(server)}/api/collections/vaults/records/${encodeURIComponent(id)}`);
  return { data: r.data, updated: r.updated };
}

export async function deleteVault(f: Fetch, session: Session, id: string): Promise<void> {
  try {
    await call(f, `${session.server}/api/collections/vaults/records/${id}`, { method: 'DELETE', token: session.token });
  } catch (e) {
    if (!(e instanceof SyncError) || e.status !== 404) throw e;
  }
}

// ---- share codes ----

/** Everything a caregiver needs to follow you: where, which record, and the key. */
export interface ShareCode {
  server: string;
  id: string;
  key: string;
}

const PREFIX = 'MT1:';

export function makeShareCode(c: ShareCode): string {
  return PREFIX + [c.server.replace(/^https:\/\//, ''), c.id, c.key].join('~');
}

export function parseShareCode(text: string): ShareCode {
  const m = text.trim().match(/MT1:([^\s]+)/);
  if (!m) throw new Error('That is not a share code. It starts with MT1:');
  const [server, id, key] = m[1].split('~');
  if (!server || !id || !key) throw new Error('This share code is incomplete. Copy the whole code.');
  return { server: normalizeServer(server), id, key };
}
