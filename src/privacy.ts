import { getSettings } from './db/repo';

/**
 * "Fully local": one switch that stops everything that could reach the internet, whatever
 * the other settings say (online medicine search, server backup and sharing, following
 * someone, Google Drive backups, the watch tile). Every network path checks this first.
 */
export class FullyLocalError extends Error {
  constructor() {
    super('Fully local is on, so Sabr stays offline. Turn it off in Settings, Privacy to use this.');
    this.name = 'FullyLocalError';
  }
}

/** False while Fully local is on. Fails closed: if settings can't be read, stay offline. */
export function cloudAllowed(): boolean {
  try {
    return getSettings().fullyLocal !== true;
  } catch {
    return false;
  }
}

export function assertCloudAllowed(): void {
  if (!cloudAllowed()) throw new FullyLocalError();
}
