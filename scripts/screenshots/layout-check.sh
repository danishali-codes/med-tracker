#!/usr/bin/env bash
# Layout check: shoots every screen in dark mode, scrolled from top to bottom, first as the
# phone comes and then with big text on a narrow screen (font scale 1.3, 360 dp wide).
# Used to catch squashed, clipped and overlapping layouts.
# Usage: layout-check.sh <apk> <out dir> <screen list file> [package]
set -u
APK=$1; OUT=$2; SCREENS=$3
PKG=${4:-com.danishalicodes.medtracker}
mkdir -p "$OUT"

adb install -r "$APK"
adb shell settings put global hide_error_dialogs 1
sleep 20
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true
adb shell settings put global sysui_demo_allowed 1
demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
demo enter
demo clock -e hhmm 1015
demo battery -e level 100 -e plugged false
demo notifications -e visible false
adb shell cmd uimode night yes

shoot() { # tag
  local tag=$1
  adb shell am force-stop $PKG
  adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 15
  local size; size=$(adb shell wm size | tail -1 | grep -o '[0-9]*x[0-9]*')
  local w=${size%x*} h=${size#*x}
  while read -r name link pages; do
    [ -z "$name" ] && continue
    [ "$link" = "-" ] && link=""
    adb shell am start -W -a android.intent.action.VIEW -d "medtracker://$link" $PKG </dev/null >/dev/null
    sleep 4
    for i in $(seq 1 "${pages:-2}"); do
      adb exec-out screencap -p </dev/null > "$OUT/$tag-$name-$i.png"
      adb shell input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h / 4)) 500 </dev/null
      sleep 2
    done
    adb shell input keyevent KEYCODE_BACK </dev/null
    sleep 1
  done < "$SCREENS"
}

shoot normal
adb shell settings put system font_scale 1.3
adb shell wm density 480
sleep 3
shoot big
adb shell settings put system font_scale 1.0
adb shell wm density reset
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:V '*:S' > "$OUT/log.txt" || true
