# Sabr on a Galaxy Watch (Wear OS tile)

The Sabr watch app adds a **tile**: swipe sideways from the watch face to see it, like
Samsung Health's tiles. It works on Wear OS 3 or newer, including every Galaxy Watch from
the Watch4 on (Watch7 included).

- A ring around the edge with one segment per dose today. Taken doses fill in violet,
  skipped ones go grey, and when every dose is answered the whole ring turns green.
- When a dose is due: the time (and names, if you turned names on), with **Taken** and
  **Snooze** buttons. Pressing one updates the phone straight away, so the reminder clears
  there too.
- Otherwise: how many you've taken today and the next time, or "All done" with your streak.

Reminder notifications already show on the watch without this app; the tile is extra.

## 1. Turn it on in the phone app

Sabr on your phone > Settings > Smartwatch > **Watch tile**. It's off by default and nothing
is sent to the watch until you turn it on. Medicine names are only sent if **Show medicine
names in reminders** (Settings > Privacy) is on. See [PRIVACY.md](../PRIVACY.md#watch-tile-off-by-default).

## 2. Get the watch app

Each release has two files: `sabr-x.y.apk` for the phone and `sabr-watch-x.y.apk` for the
watch. The `latest` release has `sabr-watch-<commit>.apk`. Both are signed with the same
key; the phone and watch apps only talk to each other when they are.

## 3. Install it on the watch

The watch app isn't in the Play Store, so it's installed over Wi-Fi debugging, once. Updates
install the same way, over the top, keeping your tile.

On the watch:

1. Settings > About watch > Software information, and tap **Software version** 5 times
   until it says developer mode is on.
2. Settings > Developer options: turn on **ADB debugging** and **Wireless debugging**.
   Put the watch on the same Wi-Fi as the phone (or computer).
3. In Wireless debugging, tap **Pair new device**. Keep that screen open: it shows an IP
   address, a port and a pairing code.

**From the phone, no computer needed:** install a Wear OS sideloading app from the Play
Store, such as *Bugjaeger* or *Wear Installer 2*. Pair it with the code from step 3, then
pick `sabr-watch-….apk` from your Downloads and install it.

**From a computer with [adb](https://developer.android.com/tools/releases/platform-tools):**

```sh
adb pair 192.168.1.23:41234        # the address and port on the pairing screen, then the code
adb connect 192.168.1.23:39555     # the address and port on the Wireless debugging screen
adb install -r sabr-watch-0.8.apk
```

Then turn **ADB debugging** off again on the watch.

## 4. Add the tile

Swipe left from the watch face to the end of your tiles, tap **Add tiles** (or **+**), and
pick **Sabr**. You can also long-press any tile to reorder. Opening Sabr from the watch's
app list shows whether it has heard from the phone.

If the tile says "Turn on Watch tile in Sabr's settings", check step 1, then open Sabr on
the phone once.

## How it works

- Phone: [`src/wear/`](../src/wear) builds a small summary of today
  ([`payload.ts`](../src/wear/payload.ts)) and [`modules/sabr-wear`](../modules/sabr-wear)
  puts it on the Wear OS data layer whenever doses, medicines or settings change. Taken and
  Snooze from the watch arrive as messages and run the same code as the notification buttons,
  even with the app closed.
- Watch: [`wear/`](../wear) is a small native app (Java, Jetpack Tiles). It keeps the last
  summary, draws the tile, and redraws itself when a dose falls due, a snooze ends or the day
  changes. CI builds it next to the phone APK with
  `../android/gradlew -p wear assembleRelease` after `expo prebuild`.
