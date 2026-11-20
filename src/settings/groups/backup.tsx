import { link } from '../rows';
import type { SettingsGroup } from '../types';

export const backupGroup: SettingsGroup = {
  id: 'backup',
  title: 'Backup and sharing',
  icon: 'cloud-outline',
  blurb: 'Backups, sync, and people you look after',
  summary: (s) =>
    [s.autoBackup.enabled ? 'Automatic backup on' : null, s.sync.enabled ? 'Sync on' : null].filter(Boolean).join(' · ') || 'Nothing leaves this phone',
  sections: [
    {
      items: [
        link({
          id: 'backupRestore',
          title: 'Backup and restore',
          hint: 'Save a password-locked file to Google Drive or your phone.',
          keywords: ['backup', 'restore', 'export', 'import', 'google drive', 'file', 'automatic', 'weekly', 'new phone', 'password'],
          icon: 'cloud-download-outline',
          href: '/backup',
          summary: (s) => (s.autoBackup.enabled && s.autoBackup.folderName ? `Automatic backup to ${s.autoBackup.folderName}` : null),
        }),
        link({
          id: 'sync',
          title: 'Sync and sharing',
          hint: 'Encrypted backup and sharing through a server. Off until you set it up.',
          keywords: ['sync', 'server', 'pocketbase', 'share', 'caregiver', 'family', 'encrypted', 'share code'],
          icon: 'lock-closed-outline',
          href: '/sync',
          summary: (s) =>
            s.sync.enabled
              ? [s.sync.backup ? 'Encrypted backup on' : null, s.sync.share ? 'Sharing with a caregiver' : null].filter(Boolean).join(' · ') ||
                'Connected to your server'
              : 'Off. Nothing leaves this phone.',
        }),
        link({
          id: 'care',
          title: 'People I look after',
          hint: 'See whether a family member took their doses, with the code they send you.',
          keywords: ['caregiver', 'family', 'parent', 'follow', 'child', 'missed alert'],
          icon: 'people-outline',
          href: '/care',
        }),
      ],
    },
  ],
};
