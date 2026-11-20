import { requireOptionalNativeModule } from 'expo';

interface SabrWearNative {
  /** Puts today's tile data on the watch (over the Wear OS data layer, phone to watch). */
  sendToday(json: string): Promise<void>;
  /** Removes it from the watch again. */
  clear(): Promise<void>;
  /** Watches connected right now, split by whether the Sabr watch app is installed on them. */
  watchStatus(): Promise<WatchStatus>;
}

/** null where the native side isn't built in (iPhone, web, Expo Go). */
export const SabrWear = requireOptionalNativeModule<SabrWearNative>('SabrWear');

export interface WatchStatus {
  withSabr: string[];
  /** Connected, but without the Sabr watch app (or with a version from before 0.10). */
  others: string[];
}
