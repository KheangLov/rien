package io.github.kheanglov.rien;

import android.app.UiModeManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Her Appearance (Me → Appearance) for the parts Android draws itself: the
// system splash screen at launch follows the app's night mode, which Android 12+
// keeps for the app once it is set here. Older Android versions follow the phone.
@CapacitorPlugin(name = "RienLook")
public class RienLookPlugin extends Plugin {

    @PluginMethod
    public void setAppearance(PluginCall call) {
        String appearance = call.getString("appearance", "system");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve();
            return;
        }
        // Setting it changes the app's configuration, so only when it changed.
        SharedPreferences prefs = getContext().getSharedPreferences("rien-look", Context.MODE_PRIVATE);
        if (appearance.equals(prefs.getString("appearance", "system"))) {
            call.resolve();
            return;
        }
        int mode = "dark".equals(appearance) ? UiModeManager.MODE_NIGHT_YES
            : "light".equals(appearance) ? UiModeManager.MODE_NIGHT_NO
            : UiModeManager.MODE_NIGHT_AUTO;
        UiModeManager uiMode = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        getActivity().runOnUiThread(() -> {
            uiMode.setApplicationNightMode(mode);
            prefs.edit().putString("appearance", appearance).apply();
            call.resolve();
        });
    }
}
