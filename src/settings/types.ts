import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentType } from 'react';
import type { FeatureId } from '../domain/features';
import type { Settings } from '../domain/types';

export interface SettingCtx {
  settings: Settings;
  /** Saves a change and reschedules reminders. */
  update: (patch: Partial<Settings>) => void;
}

/**
 * One setting. Everything here except Component is used by search, so give each item the
 * words someone might type to find it.
 */
export interface SettingItem {
  /** Unique across all groups. */
  id: string;
  title: string;
  /** What it does, in a sentence. Searched, and shown by the helpers when the row has no live hint. */
  hint?: string;
  /** Other words people might search for. */
  keywords?: string[];
  /** Hidden in Simple mode. Search finds it either way. */
  advanced?: boolean;
  /** Only on Android (alarms, widgets, the watch). */
  androidOnly?: boolean;
  /**
   * Belongs to an optional feature. While that feature is off the item is hidden from its
   * page; search still finds it and offers to turn the feature on.
   */
  feature?: FeatureId;
  /** Shown only while this is true, e.g. options of a toggle that is on. */
  visible?: (s: Settings) => boolean;
  Component: ComponentType<SettingCtx>;
}

export interface SettingsSection {
  /** A heading over this part of the group. Leave out for the first or only part. */
  title?: string;
  items: SettingItem[];
}

export interface SettingsGroup {
  /** The address of its page: /settings/<id>. */
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** One line under the title in the list, when summary has nothing to say. */
  blurb: string;
  /** Live status for the list, e.g. "Automatic backup on". */
  summary?: (s: Settings) => string | null;
  androidOnly?: boolean;
  sections: SettingsSection[];
}
