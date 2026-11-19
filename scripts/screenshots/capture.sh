#!/usr/bin/env bash
# Runs inside the emulator job. Installs the demo APK, opens each screen through
# its deep link and saves a screenshot, first in light mode and then in dark mode.
# Usage: capture.sh <apk> <out dir> <screen list file> [package]
set -u
APK=$1; OUT=$2; SCREENS=$3
PKG=${4:-com.danishalicodes.medtracker}
mkdir -p "$OUT"

adb install -r "$APK"
# A slow emulator can pop up "Pixel Launcher isn't responding" over the app. Don't show
# system error dialogs at all, and give the launcher time to settle before shooting.
adb shell settings put global hide_error_dialogs 1
adb shell settings put global anr_show_background 0 || true
sleep 20
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

# Presses "Wait" on any "isn't responding" dialog that still shows, then closes system dialogs.
clear_dialogs() {
  for _ in 1 2 3; do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 </dev/null || return 0
    local ui; ui=$(adb shell cat /sdcard/ui.xml </dev/null 2>/dev/null)
    case "$ui" in
      *"isn't responding"*|*"isn’t responding"*)
        local b; b=$(printf '%s' "$ui" | grep -o 'text="Wait"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1)
        if [ -n "$b" ]; then
          local x1 y1 x2 y2; read -r x1 y1 x2 y2 <<<"$(echo "$b" | sed 's/\]\[/,/; s/[][]//g' | tr ',' ' ')"
          adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 )) </dev/null
        else
          adb shell input keyevent KEYCODE_BACK </dev/null
        fi
        sleep 3 ;;
      *) return 0 ;;
    esac
  done
}

# Taps the first element whose text starts with the given words.
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 </dev/null || return 0
  local b; b=$(adb shell cat /sdcard/ui.xml </dev/null | grep -o "text=\"$1[^\"]*\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | head -1)
  [ -z "$b" ] && { echo "no '$1' on screen"; return 0; }
  local x1 y1 x2 y2; read -r x1 y1 x2 y2 <<<"$(echo "$b" | sed 's/\]\[/,/; s/[][]//g' | tr ',' ' ')"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 )) </dev/null
}

shoot() { # mode
  local mode=$1
  adb shell cmd uimode night "$mode"
  adb shell am force-stop $PKG
  adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 15
  while read -r name link action; do
    [ -z "$name" ] && continue
    adb shell am start -W -a android.intent.action.VIEW -d "medtracker://$link" $PKG </dev/null >/dev/null
    sleep 4
    if [ "${action:-}" = "@notify" ]; then
      # Press "Send a test reminder" and shoot the notification shade once it arrives.
      tap_text "Send a test reminder"
      sleep 15
      adb shell cmd statusbar expand-notifications </dev/null
      sleep 3
    fi
    local file="$OUT/$name.png"; [ "$mode" = yes ] && file="$OUT/$name-dark.png"
    clear_dialogs
    adb exec-out screencap -p </dev/null > "$file"
    echo "saved $file"
    [ "${action:-}" = "@notify" ] && { adb shell cmd statusbar collapse </dev/null; adb shell cmd notification cancel_all 2>/dev/null </dev/null || true; }
  done < "$SCREENS"
}

shoot no
shoot yes
adb logcat -d -v brief AndroidRuntime:E ReactNativeJS:V '*:S' > "$OUT/log.txt" || true
