# Privacy

Sabr has no accounts, ads, analytics, crash reporting or tracking. Your medicines,
times, doses and history are stored only in the app's database on your phone.

Anything that could share or show what you take is **off until you turn it on** in
Settings > Privacy.

## What leaves the phone

Out of the box, nothing. With **Online medicine search** turned on, two things go online,
both to free US government services, and both send a medicine or ingredient name only. Nothing identifies you, and no cookies, tokens or IDs
are sent. Like any website, the service can see the phone's internet address.

| When | Sent to | What is sent |
| --- | --- | --- |
| First medicine search, then once a month | US National Library of Medicine (RxNav, `rxnav.nlm.nih.gov`) | Nothing but the request. The full list of medicine names is downloaded and searched on the phone, so what you type is never sent. |
| You pick a medicine from search | RxNav | That medicine's name (or the ingredient of a built-in UAE brand), to fill in ingredients and strengths. |
| You open the interaction check | US FDA (openFDA, `api.fda.gov`) | The active ingredient of each medicine checked. Labels are saved on the phone for a month. |

All requests are made from one file, [`src/drugs/online.ts`](src/drugs/online.ts).

## Online medicine search (off by default)

While it is off, the app sends nothing. Search and the interaction check use only the
built-in list and anything already saved on the phone. Every request goes through one
check of this setting, which also counts as off if settings can't be read. Settings >
Privacy can also delete the downloaded names and labels.

## Sync and sharing (off by default)

Settings > Sync and sharing connects the app to a [PocketBase](https://pocketbase.io)
server **that you run yourself** (setup: [server/README.md](server/README.md)). While
**Use my own server** is off, none of this code talks to any network. No server address is
built in, so it can't send anything anywhere you didn't type in.

Everything below is encrypted on the phone before it leaves (XSalsa20-Poly1305), so the
server stores data it can't read.

| When | Sent to | What is sent |
| --- | --- | --- |
| You sign in or create an account | Your server | Your email and password (the server stores a hash). |
| **Keep an encrypted backup** is on, a couple of minutes after changes | Your server | Your medicines, history and notes, encrypted with a recovery key that never leaves the phone. Photos are not included. |
| **Let someone see my doses** is on, a few seconds after changes | Your server | Today's and yesterday's doses, whether each was taken, and the last 7 days' counts, encrypted with a key that exists only in the share code you hand out. Medicine names and doses are replaced with "Medicine A", "Medicine B" unless you turn on **Include medicine names**. |
| You follow someone with their share code | Their server | A request for their encrypted status, a few times a day and when you open the app. No account is needed and nothing about you is sent. |

Server sign-in, encryption keys and the codes you follow are kept in the Android keystore,
not in the app database or its exports. **Stop old codes working** deletes your shared
record and makes a new key. Turning the server off signs you out, takes down your shared
status, and can delete your backup from the server. All sync requests are made from
[`src/sync/pocketbase.ts`](src/sync/pocketbase.ts).

## Other things to know

- **Phone backups:** Android's automatic Google cloud backup is turned off for this app, so
  the database isn't copied to Google Drive. Use Settings > Your data > Export backup instead, and keep
  that file somewhere private.
- **Notifications:** by default reminders and refill alerts don't name your medicines
  ("Time for your 8:00 dose, 2 medicines to take"), on the lock screen and on a paired watch.
  With **Show medicine names in reminders** on, they do. Reminders are marked private, so
  if your phone hides sensitive notification content on the lock screen, the text is hidden
  there and shown once unlocked. They are local notifications; no push service is used.
- **Keyboard:** your phone's keyboard app can see what you type in any app. Gboard and
  Samsung Keyboard have their own settings for this.
- **Photos and box scans:** pill photos stay in the app's own storage. Reading a medicine
  box uses on-device text recognition; the photo is never uploaded.
- **Doctor report:** the PDF is made on the phone and only goes where you send it.
