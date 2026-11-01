package io.github.kheanglov.rien;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;

import java.util.ArrayList;
import java.util.List;

// The menu when she holds Rien's icon: straight to today's session, Word
// Recall, adding a word or IELTS practice. Published from the app (not a
// static XML file) so the shortcuts open this build, debug or release, and
// stay with whichever colour launcher icon is switched on.
final class RienShortcuts {
    // Shortcut intents carry the screen to open as rien://open/<route>.
    static final String SCHEME = "rien";

    private static final Object[][] SHORTCUTS = {
        { "session", "Today's session", "Session", "/session", R.drawable.shortcut_session },
        { "words", "Word Recall", "Words", "/games/word-recall", R.drawable.shortcut_words },
        { "add", "Add a word", "Add word", "/add-words", R.drawable.shortcut_add },
        { "ielts", "IELTS practice", "IELTS", "/ielts", R.drawable.shortcut_ielts },
    };

    private RienShortcuts() {}

    static void publish(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return;
        ShortcutManager manager = context.getSystemService(ShortcutManager.class);
        if (manager == null) return;
        List<ShortcutInfo> list = new ArrayList<>();
        int rank = 0;
        for (Object[] s : SHORTCUTS) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(SCHEME + "://open" + s[3]))
                .setClass(context, RienActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int image = (Integer) s[4];
            Icon icon = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? Icon.createWithAdaptiveBitmap(BitmapFactory.decodeResource(context.getResources(), image))
                : Icon.createWithResource(context, image);
            list.add(new ShortcutInfo.Builder(context, (String) s[0])
                .setShortLabel((String) s[2])
                .setLongLabel((String) s[1])
                .setIcon(icon)
                .setIntent(intent)
                .setRank(rank++)
                .build());
        }
        try {
            manager.setDynamicShortcuts(list);
        }
        catch (IllegalStateException | IllegalArgumentException ignored) {
            // Too many shortcuts for this launcher, or rate-limited: try next time.
        }
    }

    // The route a shortcut asked for ("/session"), or null.
    static String routeOf(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !SCHEME.equals(data.getScheme()) || !"open".equals(data.getHost())) return null;
        String path = data.getPath();
        return path == null || path.isEmpty() ? "/" : path;
    }
}
