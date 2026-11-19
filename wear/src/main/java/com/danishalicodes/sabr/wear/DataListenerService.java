package com.danishalicodes.sabr.wear;

import androidx.annotation.NonNull;

import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

/** Receives today's doses whenever the phone app changes them. */
public class DataListenerService extends WearableListenerService {
    @Override
    public void onDataChanged(@NonNull DataEventBuffer events) {
        boolean changed = false;
        for (DataEvent event : events) {
            if (!PhoneLink.PATH_TODAY.equals(event.getDataItem().getUri().getPath())) continue;
            if (event.getType() == DataEvent.TYPE_DELETED) {
                Today.clear(this);
                changed = true;
            } else if (event.getType() == DataEvent.TYPE_CHANGED) {
                String json = DataMapItem.fromDataItem(event.getDataItem()).getDataMap().getString("json");
                if (json != null && Today.parse(json) != null) {
                    Today.save(this, json);
                    changed = true;
                }
            }
        }
        if (changed) PhoneLink.redraw(this);
    }
}
