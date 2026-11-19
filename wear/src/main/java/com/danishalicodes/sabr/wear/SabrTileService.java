package com.danishalicodes.sabr.wear;

import androidx.annotation.NonNull;
import androidx.concurrent.futures.CallbackToFutureAdapter;
import androidx.wear.protolayout.ResourceBuilders;
import androidx.wear.protolayout.TimelineBuilders;
import androidx.wear.tiles.RequestBuilders;
import androidx.wear.tiles.TileBuilders;
import androidx.wear.tiles.TileService;

import com.google.common.util.concurrent.ListenableFuture;

import java.util.Calendar;

/** The Sabr tile. Swipe to it from the watch face, or add it from the tile list. */
public class SabrTileService extends TileService {
    private static final String RESOURCES_VERSION = "1";
    private static final long MINUTE = 60_000;

    @NonNull
    @Override
    protected ListenableFuture<TileBuilders.Tile> onTileRequest(@NonNull RequestBuilders.TileRequest request) {
        long now = System.currentTimeMillis();
        Today today = Today.load(this);
        String clicked = request.getCurrentState().getLastClickableId();
        if (today != null && today.isToday()) today = handleClick(today, clicked, now);

        // Ask the phone again if there's nothing for today yet (at most every 10 minutes).
        if ((today == null || !today.isToday()) && !Today.refreshAskedRecently(this, now)) {
            PhoneLink.pull(this);
            PhoneLink.askForRefresh(this);
        }
        PhoneLink.flushPending(this);

        long next = Math.min(today != null ? today.nextChange(now) : Long.MAX_VALUE, nextMidnight(now));
        long freshness = Math.max(MINUTE, next - now + 1000);
        TileBuilders.Tile tile = new TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(freshness)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(TileLayout.build(today, now, getPackageName())))
            .build();
        return done(tile);
    }

    /** Taken / Snooze: show it right away, then tell the phone, which sends back fresh data. */
    private Today handleClick(Today today, String clicked, long now) {
        boolean take = clicked.startsWith(TileLayout.CLICK_TAKE);
        boolean snooze = clicked.startsWith(TileLayout.CLICK_SNOOZE);
        if (!take && !snooze) return today;
        String[] parts = clicked.substring(clicked.indexOf(':') + 1).split("\\|");
        if (parts.length != 2 || !parts[0].equals(today.date)) return today;
        Today.Group g = today.find(parts[1]);
        // Already handled (the tile can be asked again with the same click), or not due.
        if (g == null || !g.isDue(now)) return today;
        if (take) {
            today.markTaken(g);
        } else {
            g.snoozedUntil = now + 10 * MINUTE; // the phone replaces this with your snooze length
        }
        Today.save(this, today.toJson());
        PhoneLink.sendAction(this, take ? "/sabr/take" : "/sabr/snooze", today.date, g.time);
        return today;
    }

    @NonNull
    @Override
    protected ListenableFuture<ResourceBuilders.Resources> onTileResourcesRequest(@NonNull RequestBuilders.ResourcesRequest request) {
        return done(new ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build());
    }

    private static long nextMidnight(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 5);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static <T> ListenableFuture<T> done(T value) {
        return CallbackToFutureAdapter.getFuture(completer -> {
            completer.set(value);
            return "sabr-tile";
        });
    }
}
