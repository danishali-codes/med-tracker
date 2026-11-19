import { useEffect, useSyncExternalStore } from 'react';
import * as sync from '../sync/engine';

/** The people you follow as a caregiver; loads once and re-renders on changes. */
export function useFollowing(): sync.Followed[] {
  useEffect(() => void sync.getFollowing(), []);
  return useSyncExternalStore(sync.subscribeCare, sync.followingSnapshot);
}
