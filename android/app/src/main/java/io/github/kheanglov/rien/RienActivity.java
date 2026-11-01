package io.github.kheanglov.rien;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class RienActivity extends BridgeActivity {
    // Her home-screen icon colour changes when she leaves the app (see
    // RienLookPlugin.applyLauncherIcon), never while she is using it.
    // A shortcut used while Rien is already open: go there now.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String route = RienShortcuts.routeOf(intent);
        if (route == null || getBridge() == null) return;
        String js = "window.dispatchEvent(new CustomEvent('rien-shortcut', { detail: " + org.json.JSONObject.quote(route) + " }))";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    @Override
    public void onStop() {
        super.onStop();
        RienLookPlugin.applyLauncherIcon(getApplicationContext());
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins, which live in this module: speech in and out,
        // and her Appearance for Android's own splash screen.
        registerPlugin(RienSpeechPlugin.class);
        registerPlugin(RienLookPlugin.class);
        // A long-press shortcut that started the app: the page asks for it
        // when it is ready (RienLookPlugin.takeLaunchRoute).
        RienLookPlugin.pendingRoute = RienShortcuts.routeOf(getIntent());
        super.onCreate(savedInstanceState);
        RienShortcuts.publish(getApplicationContext());

        // Android's back gesture goes back a screen in the app, and only leaves
        // the app from the first screen (without this it always closes Rien).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
