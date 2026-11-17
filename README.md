# Med Tracker

A medication reminder app for people with lots of meds on different schedules. It's built with Expo (React Native): Android first, with iPhone possible later from the same code.

Everything stays on your phone. There's no account and no server.

## What it does

- **Flexible schedules:** every day, chosen weekdays, every N days or weeks (e.g. every 2 weeks), on/off cycles (e.g. 21 on / 7 off), monthly, or as needed. Each med can be due several times a day, with optional start and end dates.
- **Reminders that are hard to miss:** one notification per time slot with **Taken / Snooze / Skip** buttons that work without opening the app. Alarm-clock delivery on Android means battery saver can't delay them. Reminders can repeat every few minutes until you answer.
- **Today screen:** a progress ring, what's due, and one-tap logging.
- **History calendar:** each day is coloured (all taken / some missed / missed / streak freeze used). Tap a day to see or fix what was logged.
- **Pill counts:** stock goes down as you take doses, and you get a refill alert.
- **Rewards:**
  - A streak that only breaks when a dose is never taken that day. Late doses still count.
  - Streak freezes, earned every 7 perfect days (up to 2), save a streak on a bad day.
  - Coins for every dose, with extra for on-time doses, perfect days and streak milestones.
  - Spend coins decorating your own room: furniture, wall items, wallpaper and flooring.
  - Badges for milestones.
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
  - `progress.ts`: day summaries, streaks, freezes, coins, badges
  - `reminders.ts`: which notifications to schedule
  - `decor.ts`: room items
- `src/db/`: SQLite storage
- `src/notifications/`: scheduling, the notification buttons, background tasks and permissions
- `src/app/`: screens (Expo Router)
- `.github/workflows/android.yml`: tests, then builds the APK. Merges to `main` publish it as the `latest` release.
