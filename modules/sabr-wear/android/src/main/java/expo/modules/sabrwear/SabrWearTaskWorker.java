// Based on HeadlessJsTaskWorker from https://github.com/wjaykim/react-native-headless-task-worker
// (MIT License, Copyright (c) 2022 Jay Kim), as also used by react-native-android-widget.
package expo.modules.sabrwear;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.concurrent.futures.CallbackToFutureAdapter;
import androidx.work.Data;
import androidx.work.ListenableWorker;
import androidx.work.WorkerParameters;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactInstanceEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.facebook.react.jstasks.HeadlessJsTaskContext;
import com.facebook.react.jstasks.HeadlessJsTaskEventListener;
import com.google.common.util.concurrent.ListenableFuture;

/** Runs the SabrWearAction JavaScript task in the background, starting React if needed. */
public class SabrWearTaskWorker extends ListenableWorker implements HeadlessJsTaskEventListener {
    private int taskId = -1;
    private CallbackToFutureAdapter.Completer<Result> completer;

    public SabrWearTaskWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public ListenableFuture<Result> startWork() {
        return CallbackToFutureAdapter.getFuture(c -> {
            completer = c;
            Data data = getInputData();
            WritableMap args = Arguments.createMap();
            args.putString("action", data.getString("action"));
            args.putString("body", data.getString("body"));
            startTask(new HeadlessJsTaskConfig("SabrWearAction", args, 30 * 1000, true));
            return "SabrWearAction";
        });
    }

    private void startTask(final HeadlessJsTaskConfig config) {
        final ReactHost host = getReactHost();
        ReactContext context = host.getCurrentReactContext();
        if (context == null) {
            host.addReactInstanceEventListener(new ReactInstanceEventListener() {
                @Override
                public void onReactContextInitialized(@NonNull ReactContext ctx) {
                    invokeStartTask(ctx, config);
                    host.removeReactInstanceEventListener(this);
                }
            });
            host.start();
        } else {
            invokeStartTask(context, config);
        }
    }

    private void invokeStartTask(ReactContext context, final HeadlessJsTaskConfig config) {
        final HeadlessJsTaskContext tasks = HeadlessJsTaskContext.getInstance(context);
        tasks.addTaskEventListener(this);
        UiThreadUtil.runOnUiThread(() -> taskId = tasks.startTask(config));
    }

    private void cleanUp() {
        ReactContext context = getReactHost().getCurrentReactContext();
        if (context != null) HeadlessJsTaskContext.getInstance(context).removeTaskEventListener(this);
    }

    @Override
    public void onStopped() {
        super.onStopped();
        cleanUp();
    }

    @Override
    public void onHeadlessJsTaskStart(int id) {}

    @Override
    public void onHeadlessJsTaskFinish(int id) {
        if (id == taskId && completer != null) {
            completer.set(Result.success());
            cleanUp();
        }
    }

    private ReactHost getReactHost() {
        return ((ReactApplication) getApplicationContext()).getReactHost();
    }
}
