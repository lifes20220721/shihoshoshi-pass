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
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.UUID;

@CapacitorPlugin(name = "PassInstallReferrer")
public class ReferralPlugin extends Plugin {
    private static final String CLOCK_ENDPOINT = "https://xs968799.xsrv.jp/pass-review/healthz";

    // Independent of Play attribution; this method never grants a free trial.
    @PluginMethod
    public void trustedTime(PluginCall call) {
        fetchClock(call, new JSObject());
    }

    private void fetchClock(PluginCall call, JSObject data) {
        new Thread(() -> {
            HttpsURLConnection connection = null;
            try {
                URL url = new URL(CLOCK_ENDPOINT + "?clock=" + UUID.randomUUID());
                connection = (HttpsURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("HEAD");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Cache-Control", "no-cache, no-store");
                if (connection.getResponseCode() != 200 || connection.getDate() <= 0) {
                    call.reject("Trusted trial time unavailable");
                    return;
                }
                data.put("trustedNow", connection.getDate());
                data.put("endpoint", CLOCK_ENDPOINT);
                call.resolve(data);
            } catch (Exception error) {
                call.reject("Could not verify server time", error);
            } finally { if (connection != null) connection.disconnect(); }
        }, "pass-server-clock").start();
    }

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
                    // Obtain wall time through TLS, then the web layer advances it
                    // with a monotonic clock. Device date changes do not extend a trial.
                    fetchClock(call, data);
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
