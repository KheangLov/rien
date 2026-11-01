package io.github.kheanglov.rien;

import android.app.UiModeManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
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

    // Main colour -> its launcher entry in AndroidManifest.xml (teal keeps the
    // old name, so icons already on a home screen keep working).
    private static final String[][] ICONS = {
        { "teal", "MainActivity" }, { "blue", "IconBlue" }, { "indigo", "IconIndigo" }, { "violet", "IconViolet" },
        { "pink", "IconPink" }, { "red", "IconRed" }, { "orange", "IconOrange" }, { "green", "IconGreen" },
    };
    private static final String PREFS = "rien-look";

    // Her choice of home-screen icon, applied when she leaves the app
    // (applyLauncherIcon): switching launcher entries can close the app on
    // some phones, so never while she is using it.
    @PluginMethod
    public void setLauncherIcon(PluginCall call) {
        String accent = call.getString("accent", "teal");
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("icon", accent).apply();
        call.resolve();
    }

    // Switches on the launcher entry for the chosen colour and off the others.
    // Some launchers (Samsung's among them) then drop the icon from the home
    // screen; it stays in the app list. Settings warns her before she chooses.
    static void applyLauncherIcon(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String wanted = prefs.getString("icon", "teal");
        if (wanted.equals(prefs.getString("iconApplied", "teal"))) return;
        PackageManager pm = context.getPackageManager();
        String base = RienActivity.class.getPackage().getName();
        String chosen = null;
        for (String[] icon : ICONS) if (icon[0].equals(wanted)) chosen = icon[1];
        if (chosen == null) return;
        // The new one first, so there is never a moment with no launcher entry.
        pm.setComponentEnabledSetting(new ComponentName(context.getPackageName(), base + "." + chosen),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String[] icon : ICONS) {
            if (icon[1].equals(chosen)) continue;
            pm.setComponentEnabledSetting(new ComponentName(context.getPackageName(), base + "." + icon[1]),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
        prefs.edit().putString("iconApplied", wanted).apply();
    }

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
