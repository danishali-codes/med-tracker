import { requireOptionalNativeModule } from 'expo';
import type { HealthDay, HealthKind } from '../../src/domain/health';

interface SabrHealthNative {
  /** Whether Health Connect is on this phone and up to date. */
  status(): 'ready' | 'needsInstall' | 'unavailable';
  /** Which kinds Sabr is allowed to read right now. */
  granted(): Promise<HealthKind[]>;
  /** Shows Health Connect's screen to pick what Sabr may read; answers with what was allowed. */
  request(): Promise<HealthKind[]>;
  /** Opens Health Connect's settings. */
  openSettings(): void;
  /** Daily totals between two days (YYYY-MM-DD, inclusive), only for days with data. */
  daily(from: string, to: string): Promise<HealthDay[]>;
}

/** null where the native side isn't built in (iPhone, web, Expo Go). */
export const SabrHealth = requireOptionalNativeModule<SabrHealthNative>('SabrHealth');
