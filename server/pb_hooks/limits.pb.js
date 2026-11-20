/// <reference path="../pb_data/types.d.ts" />

// Keeps a shared server (like the Sabr server) fair: each account can hold only a few
// vaults. The app uses one backup and one share per phone, so this leaves room for a
// couple of phones. Everything in them is encrypted on the phone, so this is all the
// server can check.
const MAX_VAULTS_PER_ACCOUNT = 6;

onRecordCreateRequest((e) => {
  const owner = e.auth ? e.auth.id : '';
  if (owner) {
    const n = e.app.countRecords('vaults', $dbx.hashExp({ owner }));
    if (n >= MAX_VAULTS_PER_ACCOUNT) {
      throw new BadRequestError('This account already has the most backups a server allows. Delete an old one from the app first.');
    }
  }
  e.next();
}, 'vaults');
