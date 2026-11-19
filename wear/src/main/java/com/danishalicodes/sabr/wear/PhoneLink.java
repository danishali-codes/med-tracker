package com.danishalicodes.sabr.wear;

import android.content.Context;
import android.net.Uri;

import androidx.wear.tiles.TileService;

import com.google.android.gms.wearable.DataItem;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

/** Talks to the Sabr app on the paired phone, directly over the Wear OS data layer. */
final class PhoneLink {
    static final String PATH_TODAY = "/sabr/today";

    private PhoneLink() {}

    /** Sends /sabr/take, /sabr/snooze or /sabr/refresh with the day and time the tile showed. */
    static void send(Context context, String path, String date, String time) {
        final Context app = context.getApplicationContext();
        byte[] body;
        try {
            body = new JSONObject().put("date", date).put("time", time).toString().getBytes(StandardCharsets.UTF_8);
        } catch (JSONException e) {
            return;
        }
        Wearable.getNodeClient(app).getConnectedNodes().addOnSuccessListener(nodes -> {
            for (Node node : nodes) Wearable.getMessageClient(app).sendMessage(node.getId(), path, body);
        });
    }

    /** Reads the latest data the phone put on the data layer, in case a change was missed. */
    static void pull(Context context) {
        final Context app = context.getApplicationContext();
        Uri uri = new Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(PATH_TODAY).build();
        Wearable.getDataClient(app).getDataItems(uri).addOnSuccessListener(items -> {
            String json = null;
            for (DataItem item : items) {
                String j = DataMapItem.fromDataItem(item).getDataMap().getString("json");
                if (j != null) json = j;
            }
            items.release();
            if (json == null) return;
            Today fresh = Today.parse(json);
            Today held = Today.load(app);
            if (fresh != null && (held == null || fresh.made > held.made)) {
                Today.save(app, json);
                redraw(app);
            }
        });
    }

    static void redraw(Context context) {
        TileService.getUpdater(context).requestUpdate(SabrTileService.class);
    }
}
