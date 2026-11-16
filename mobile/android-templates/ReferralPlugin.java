package com.pass.shared;

import android.os.RemoteException;
import android.os.Handler;
import android.os.Looper;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PassInstallReferrer")
public class ReferralPlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        AtomicBoolean settled = new AtomicBoolean(false);
        Handler handler = new Handler(Looper.getMainLooper());
        Runnable timeout = () -> {
            if (settled.compareAndSet(false, true)) {
                client.endConnection();
                call.reject("Google Play install referrer timed out");
            }
        };
        handler.postDelayed(timeout, 10000);
        client.startConnection(new InstallReferrerStateListener() {
            @Override public void onInstallReferrerSetupFinished(int code) {
                if (!settled.compareAndSet(false, true)) return;
                handler.removeCallbacks(timeout);
                try {
                    if (code != InstallReferrerClient.InstallReferrerResponse.OK) {
                        call.reject("Google Play install referrer unavailable");
                        return;
                    }
                    ReferrerDetails details = client.getInstallReferrer();
                    long seconds = details.getInstallBeginTimestampServerSeconds();
                    if (seconds <= 0 || seconds > Long.MAX_VALUE / 1000) {
                        call.reject("Google Play install time unavailable");
                        return;
                    }
                    JSObject data = new JSObject();
                    data.put("referrer", details.getInstallReferrer());
                    data.put("installedAt", seconds * 1000);
                    call.resolve(data);
                } catch (RemoteException | RuntimeException error) {
                    call.reject("Could not read Google Play install referrer", error);
                } finally { client.endConnection(); }
            }
            @Override public void onInstallReferrerServiceDisconnected() {
                if (settled.compareAndSet(false, true)) {
                    handler.removeCallbacks(timeout);
                    client.endConnection();
                    call.reject("Google Play install referrer disconnected");
                }
            }
        });
    }
}
