# Privacy

Med Tracker has no accounts, ads, analytics, crash reporting or tracking. Your medicines,
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
- **Future caregiver sync** (planned for 0.5) will only talk to a server you host yourself,
  and will be off unless you turn it on.
