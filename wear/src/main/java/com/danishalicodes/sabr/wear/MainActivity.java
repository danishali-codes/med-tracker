package com.danishalicodes.sabr.wear;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Opened from the watch's app list: a short status and how to add the tile. */
public class MainActivity extends Activity {
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = dp(28);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setPadding(pad, pad, pad, pad);
        col.addView(label("Sabr", 20, Color.WHITE, true));
        status = label("", 15, TileLayout.PRIMARY, true);
        col.addView(status);
        col.addView(label(
            "To add the tile, swipe left from the watch face, scroll to the end, tap Add tiles and pick Sabr.\n\n"
                + "Today's doses come from the Sabr app on your phone. Turn on Watch tile in its settings.",
            13, TileLayout.FAINT, false));
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.BLACK);
        scroll.addView(col);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        PhoneLink.pull(this);
        PhoneLink.send(this, "/sabr/refresh", "", "");
        Today today = Today.load(this);
        if (today == null) status.setText("Waiting for your phone");
        else if (!today.isToday()) status.setText("Open Sabr on your phone to update");
        else if (today.total == 0) status.setText("Nothing due today");
        else status.setText(today.done + " of " + today.total + " taken today");
    }

    private TextView label(String text, float sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextColor(color);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        v.setGravity(Gravity.CENTER);
        if (bold) v.setTypeface(v.getTypeface(), android.graphics.Typeface.BOLD);
        v.setPadding(0, dp(4), 0, dp(4));
        return v;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
