# Changelog

Each version gets a GitHub release with these notes and its screenshots. Screenshots of
every screen, light and dark, are in [docs/screenshots](docs/screenshots).

<!-- Each "## x.y" heading becomes a release named vx.y.0. "commit:" pins the release to
     an older commit; without it the release points at the merge that added the heading. -->

## 0.9

A layout pass over every screen, bigger widgets that show more as they grow, and early doses.

### Fixed
- Buttons, the 2 weeks / Month / Year switch and the mood chips no longer get squished. They fill their space evenly.
- Content no longer slides under the status bar when you scroll, and the last card on each tab clears the floating tab bar.
- On a gold day the "All on time" pill no longer runs off the screen.
- The History calendar shows all seven days in a row again, instead of wrapping Sunday onto its own line.
- Pages and pop-up menus keep clear of the phone's navigation bar, and long menus scroll.
- Rows of buttons wrap onto a second line on narrow phones or with large text.
- The streak card, review tiles and charts make room for large text sizes.

### Widgets
- The ring and text grow to fill the widget instead of sitting small in a corner.
- Each widget changes with its size: small shows the next dose, medium adds today's ring and a Take button, and tall shows today's dose times, this week's days and more.
- Medicine names stay hidden on widgets unless you turn them on in Settings.

### Early doses
- A dose taken more than the on-time window before its time shows as "Early". It counts for your streak, but not as on time, so it doesn't make a gold day.
- There's a hidden badge to find for taking a dose early.

## 0.8

A full check-up of the code: bug fixes, a leaner app, and a sturdier watch tile.

### Fixed
- Changing a dose time in a medicine no longer mixes up its "different times on some days", and can't silently merge two doses into one.
- Moving a dose time keeps today's logged dose with it, so it doesn't show as due again. Removing a time and adding another doesn't carry the log over.
- Days where a weekday time moves a dose past another dose keep each dose matched to its own log.
- Watch tile: a Taken or Snooze the phone can't accept (not due yet, a new day) is undone on the tile instead of staying wrong. A slow watch connection no longer holds up the rest of the app, and a press that arrives while the app can't start is retried.
- "Take all" logs each dose in turn and tells you if any couldn't be saved.
- A damaged backup file is refused with a clear message instead of freezing the app.
- Sync shows a clear message when the server address isn't a PocketBase server.

### Privacy
- While the app lock is on, the locked app is hidden from screen readers too.

### Removed
- Two unused libraries and a batch of unused code, for a smaller, simpler app. Nothing you use was taken away.

## 0.7

New home screen widgets and a Galaxy Watch tile.

### Added
- Next dose widget: the dose that's due with Taken and Snooze, shrinking to a single strip when made small.
- Today widget with the three rings, and Today's list with a ring header and pill drawings.
- Widgets turn green when the day is done and gold when every dose was on time, and adapt to any size you resize them to.
- Galaxy Watch / Wear OS tile: a ring with one segment per dose that turns green when the day is done, the dose that's due with Taken and Snooze, or the next time and your streak. Off by default (Settings > Smartwatch > Watch tile). The watch app is a separate APK in each release (sabr-watch-0.7.apk); setup in [docs/watch.md](docs/watch.md).

### Privacy
- Medicine names stay off the widgets and the watch tile unless you turn them on in Settings.

## 0.6

Ideas borrowed from habit trackers: keeping your data safe, fairer streaks, routines and a look back at how it's going.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.6/today.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.6/progress.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.6/review.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.6/backup.png" width="200" />
</p>

### Added
- Backup and restore (Settings): lock a backup with a password, then save it to Google Drive, Files or anywhere through the share sheet. Restoring asks for the password. Without a password the app warns you first.
- Automatic backup: once a day, week or fortnight, a password-locked backup is written to a folder you choose, keeping the last 4.
- App lock: fingerprint, face or the phone's PIN to open Sabr, locking again after the time you pick. Reminders and their buttons keep working while it's locked. Optional: hide the app in recent apps (this also blocks screenshots).
- Win back a streak: when a streak of 3 days or more breaks with no freeze left, taking every dose for the next 3 days brings it back.
- Planned skips: on the History tab, skip a future dose or a whole day (a test, a doctor's instruction). There's no reminder, and it neither uses a freeze nor breaks the streak.
- Consistency score out of 100, overall and per medicine, after Loop Habit Tracker's habit strength: it rises with each good day and only dips on a missed one.
- Gold days, with a star, when every dose was taken on time. A perfect streak counts days in a row with every dose done and no freeze or win-back used.
- Milestones at 7, 14, 30, 60, 100, 180 and 365 days and beyond, plus new badges.
- Routines: name a time, like Breakfast at 8:00, and pick its medicines. They share one reminder that says the routine's name, and Today groups them with Take all.
- Food timers: mark a medicine as taken on an empty stomach and how long to wait. After you take it, Today counts down and a notice says when you can eat.
- Learns your timing: if you usually take a dose 20 minutes or more before or after its reminder, Sabr offers to move the reminder.
- Month and year in review: taken, on time, full and gold days, longest run, consistency, the hardest time of day, mood and symptoms. Today offers last month's review in the first week of a month.
- Patterns: mood and symptoms on days after a missed dose compared with days after everything was taken, per medicine too. Worked out on the phone, with a reminder that it isn't medical advice.

### Changed
- A day where every dose was skipped on purpose no longer counts towards the streak; it's neutral, like a day with nothing due.

## 0.5.1

The first signed build, under the app's final ID.

### Changed
- The app ID is now `com.danishalicodes.sabrmedicinetracker`, and builds are signed with the app's own key, so every later update installs over this one. Because the ID changed, this installs as a new app next to any earlier test build: export a backup in the old app (Settings, Your data), then restore it in this one and uninstall the old one.
- Screenshots of 0.2 and 0.2.1 retaken without the "Pixel Launcher isn't responding" dialog.

## 0.5
commit: d4771dbf3cb14d81966a597760dc6007b7e10917

Optional backup and caregiver sharing, through a server you run yourself. Off unless you turn it on.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.5/sync.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.5/care.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.5/settings.png" width="200" />
</p>

### Added
- Sync and sharing (Settings): connect to a PocketBase server you host. Nothing changes until you do; with it off, nothing leaves the phone.
- Encrypted backup: your medicines, history and notes, locked on the phone with a recovery key only you have, so the server stores data it can't read. Restore it on a new phone with the key.
- Caregiver sharing: send a family member a share code and they can see today's and yesterday's doses and your week. Medicine names are left out unless you include them. Making a new code cuts off the old one.
- People I look after: paste someone's code to follow their doses, with an optional alert when a dose hasn't been marked a while after it was due. No account needed.
- A setup guide and ready-made collection for the server in `server/`.

## 0.4
commit: 9712bf1a2296b7ce304b70960edbac19d4e946eb

Share your history with your doctor, and add medicines by scanning the box.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.4/report.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.4/progress.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.4/today.png" width="200" />
</p>

### Added
- Doctor report: a PDF for the last week, month, 3 or 6 months or any dates you pick. It lists each medication with doses due, taken, late, skipped and missed, a day-by-day grid, the missed doses, and mood and symptom notes. Made on the phone and shared only where you choose. You can print it too.
- Scan the box: take a photo of a medicine box and the app reads the name, strength, form and pack size on the phone (Google's on-device text recognition) to fill in the form. Scanning a box you already have offers to add the pack to its stock.
- A bigger home screen widget listing every dose today, with Take on each one that's due.

### Changed
- The small widget uses one calm colour instead of a purple-pink gradient.

## 0.3
commit: ed11d243c745938f7795f6ed0f33f84ca501704e

Reminders that fit real life: different times on different days, Ramadan, travel and busy weeks.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.3/today.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.3/medication.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.3/times.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.3/history.png" width="200" />
</p>

### Added
- Different times on some weekdays, for example 6:45 on office days and 10:00 at the weekend. A dose moved this way still counts as the same dose.
- Temporary changes: "from 24 to 30 Nov, remind me at 9:00 instead of 8:00", or shift every dose by up to two hours, for one medication or all. They end by themselves.
- Ramadan mode with start and end dates and a choice of medications. Doses move to suhoor and iftar, using times you set or times worked out from your city's prayer times on the phone, with no internet needed.
- Travel mode: keep reminders on home time while abroad. When the phone's time zone changes, the app tells you what will happen.
- Snooze for 10 minutes, 30 minutes or an hour from a dose's menu in the app.
- Quiet hours with no repeat reminders at night, repeat reminders that come sooner each time, and an evening check listing anything not logged yet.
- Mood (1 to 5), symptoms and a note for each day, on Today and in History.
- A photo of each pill, kept on the phone only and shown on Today.

### Changed
- Long-pressing a dose opens a menu with Taken, snooze times, Skip and Undo.
- Doses moved from their usual time say so on Today.

## 0.2.1
commit: 9279d64ed0b0155e51846447c595529cb11f8415

Pick what each medicine looks like, and an easier medicine form.

### Added
- Choose the shape (round, oval, oblong, capsule, square, diamond, triangle) and colour of each pill, with two colours for capsules. Bottles, pens, inhalers and other forms are drawn in the colour you pick. The drawing shows on Today and Medications.
- A Smartwatch section in Settings explaining how to turn on reminders for a Galaxy Watch.

### Changed
- The medicine type is a dropdown instead of a sideways-scrolling row, and suggested strengths wrap onto several lines so none are hidden.
- The colour that was on the medicine form is now called the accent colour.

## 0.2
commit: b93ed248d30b6928f5613d150c4256930a4966a0

The new look, dose amounts that match the box, medicine search and interaction checks.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.2/today.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.2/meds.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.2/progress.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.2/today-dark.png" width="200" />
</p>

### Added
- Light, dark and true-black modes, following the phone or picked in Settings.
- New design: Nunito font, rounded cards, animated rings and check buttons, confetti when the day is done (can be turned off).
- Dose as strength plus amount, for example 500 mg, 3 tablets. Refills count by the amount, and half tablets and ml work.
- Medicine search: built-in UAE brands plus the US RxNorm list, filling in the ingredient and strengths.
- Interaction check against your other meds, alcohol and food, with a clear "not complete, ask your doctor" note.
- Pause a medication for a while without breaking the streak.
- 7-day squares on each medication, and month and year heatmaps on the Progress tab.
- Home screen widget with today's progress and a Take button.
- Optional release signing so updates install over each other.

### Changed
- Icons instead of emojis everywhere, and calmer colours.
- Progress moved to its own tab.

### Removed
- Room decorating, for now. Coins are still counted in case it comes back.

### Fixed
- The home screen widget showed a blank box.
- History stays when a medication is deleted.

## 0.1
commit: c22ec81cf21bd9634260f4d9885a3cba65dd3019

The first version.

<p>
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.1/today.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.1/meds.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.1/history.png" width="200" />
  <img src="https://raw.githubusercontent.com/danishali-codes/med-tracker/main/docs/screenshots/0.1/room.png" width="200" />
</p>

### Added
- Schedules: daily, chosen weekdays, every N days or weeks, on/off cycles, monthly and as needed, several times a day.
- Reminders with Taken, Snooze and Skip buttons, alarm-clock delivery and repeat reminders until answered.
- Today screen with rings, and a History calendar where any day can be fixed.
- Stock tracking with refill alerts.
- Streaks where late doses count, streak freezes and badges.
- A room to decorate with coins earned from doses.
- Backup to a file and restore.
