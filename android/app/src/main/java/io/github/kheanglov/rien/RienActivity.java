package io.github.kheanglov.rien;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class RienActivity extends BridgeActivity {
    // Her home-screen icon colour changes when she leaves the app (see
    // RienLookPlugin.applyLauncherIcon), never while she is using it.
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
        super.onCreate(savedInstanceState);

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
