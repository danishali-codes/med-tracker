#!/usr/bin/env bash
# Runs inside the emulator job. Installs the demo APK, opens each screen through
# its deep link and saves a screenshot, first in light mode and then in dark mode.
# Usage: capture.sh <apk> <out dir> <screen list file>
set -u
APK=$1; OUT=$2; SCREENS=$3
PKG=com.danishalicodes.medtracker
mkdir -p "$OUT"

adb install -r "$APK"
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true

# A clean status bar: fixed clock, full battery and signal, no notifications.
adb shell settings put global sysui_demo_allowed 1
demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
demo enter
demo clock -e hhmm 1015
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4
demo network -e mobile show -e datatype none -e level 4
demo notifications -e visible false

shoot() { # mode
  local mode=$1
  adb shell cmd uimode night "$mode"
  adb shell am force-stop $PKG
  adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 15
  while read -r name link; do
    [ -z "$name" ] && continue
    adb shell am start -W -a android.intent.action.VIEW -d "medtracker://$link" $PKG </dev/null >/dev/null
    sleep 4
    local file="$OUT/$name.png"; [ "$mode" = yes ] && file="$OUT/$name-dark.png"
    adb exec-out screencap -p </dev/null > "$file"
    echo "saved $file"
  done < "$SCREENS"
}

shoot no
shoot yes
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:V '*:S' > "$OUT/log.txt" || true
