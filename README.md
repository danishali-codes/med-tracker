# Med Tracker

A medication reminder app for people with lots of meds on different schedules. It's built with Expo (React Native): Android first, with iPhone possible later from the same code.

Your doses and history stay on your phone. There's no account and no server. The only things that leave the phone are medicine names, when you search for a medicine or check interactions (see below).

## What it does

- **Flexible schedules:** every day, chosen weekdays, every N days or weeks (e.g. every 2 weeks), on/off cycles (e.g. 21 on / 7 off), monthly, or as needed. Each med can be due several times a day, with optional start and end dates.
- **Reminders that are hard to miss:** one notification per time slot with **Taken / Snooze / Skip** buttons that work without opening the app. Alarm-clock delivery on Android means battery saver can't delay them. Reminders can repeat every few minutes until you answer.
- **Today screen:** three rings (doses today, on time, this week), a week strip, what's due, one-tap logging and confetti when the day is done.
- **Doses that match the box:** each med has a strength and an amount, e.g. *500 mg × 3 tablets*. Half tablets and ml work too.
- **Medicine search:** start typing a brand or generic name. It searches a built-in list of common UAE brands (Panadol, Adol, Concor, Glucophage…) plus the full US RxNorm list of names, fills in the active ingredient and offers the strengths it comes in.
- **Interaction check:** with your other meds, alcohol and food, from a short built-in list of well-known interactions and the official US drug labels (openFDA). It always says the list isn't complete and to ask a doctor or pharmacist.
- **Light and dark mode**, following the phone or picked in Settings.
- **Home screen widget:** today's progress, your streak and the next dose, with a Take button when it's due.
- **History calendar:** each day is coloured (all taken / some missed / missed / streak freeze used). Tap a day to see or fix what was logged.
- **Refill reminders:** stock is counted in tablets (or ml, puffs…). Each dose uses its amount, and you get an alert with roughly how many days are left.
- **Rewards:**
  - A streak that only breaks when a dose is never taken that day. Late doses still count.
  - Streak freezes, earned every 7 perfect days (up to 2), save a streak on a bad day.
  - A Progress tab with your streak, 30-day and on-time rates, the last two weeks and badges.
  - (Room decorating is switched off for now and may come back later.)
- **Backup:** export everything to a JSON file and restore it on a new phone.

## Install on Android

1. Open the [latest release](../../releases/tag/latest) on your phone and download the `.apk`.
2. Open it. Android will ask you to allow installs from your browser or files app; allow it once.
3. In the app, open **Settings** (gear icon) and:
   - allow **Notifications** and **Alarms & reminders**;
   - tap **Battery → Open** and choose *Unrestricted* / *Allow background activity*. Samsung phones also have *Settings → Battery → Background usage limits*: make sure Med Tracker is not in "Sleeping apps".
   - tap **Send a test reminder** to check it works.

Each build on a pull request is also available under the **Actions** tab, as the `med-tracker-apk` artifact.

## Development

```bash
npm install
npm test            # schedule, streak and reminder logic
npm run typecheck
npx expo run:android   # needs Android Studio / an Android device
```

The app uses native modules (notifications, SQLite, background tasks), so it needs a development build. Expo Go won't run it.

### Layout

- `src/domain/`: pure logic, fully unit tested
  - `schedule.ts`: when doses are due
  - `progress.ts`: day summaries, streaks, freezes, badges
  - `reminders.ts`: which notifications to schedule
  - `dose.ts`: strength × amount, units, days of supply
  - `interactions.ts`: built-in interactions and reading drug-label text
- `src/drugs/`: medicine search (built-in list + RxNav) and label lookups (openFDA)
- `src/widget/`: the Android home screen widget
- `src/db/`: SQLite storage
- `src/notifications/`: scheduling, the notification buttons, background tasks and permissions
- `src/app/`: screens (Expo Router)
- `.github/workflows/android.yml`: tests, then builds the APK and opens it on an emulator. Merges to `main` publish it as the `latest` release.

### Signing

Release APKs are signed with the app's own key when these repository secrets exist: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Without them the build falls back to the shared debug key.

### Data sources

- [RxNav / RxNorm](https://lhncbc.nlm.nih.gov/RxNav/) from the US National Library of Medicine: drug names, ingredients and strengths. Free, no key.
- [openFDA drug labels](https://open.fda.gov/apis/drug/label/): official US label text, read for interaction warnings. Free, no key (rate limited per phone).
