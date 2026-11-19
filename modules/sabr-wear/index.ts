import { requireOptionalNativeModule } from 'expo';

interface SabrWearNative {
  /** Puts today's tile data on the watch (over the Wear OS data layer, phone to watch). */
  sendToday(json: string): Promise<void>;
  /** Removes it from the watch again. */
  clear(): Promise<void>;
  /** Names of the watches paired with this phone right now. */
  connectedWatches(): Promise<string[]>;
}

/** null where the native side isn't built in (iPhone, web, Expo Go). */
export const SabrWear = requireOptionalNativeModule<SabrWearNative>('SabrWear');
