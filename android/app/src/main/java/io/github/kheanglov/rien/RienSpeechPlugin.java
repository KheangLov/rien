package io.github.kheanglov.rien;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.Locale;

// Android twin of ios/App/App/RienSpeechPlugin.swift, under the same JS name.
// Listening: Android's SpeechRecognizer. Like the iPhone version it gets no hint
// of the expected sentence, so it cannot "hear" endings she dropped.
// Reading aloud: Android's web view has no speechSynthesis, so speak() is here too.
@CapacitorPlugin(
    name = "RienSpeech",
    permissions = {
        // Android has one permission for both; the app asks for "speech" and "microphone".
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "speech", strings = { Manifest.permission.RECORD_AUDIO }),
    }
)
public class RienSpeechPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall listenCall;
    private Runnable limit;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final ArrayList<Runnable> afterReady = new ArrayList<>();
    private int utteranceCounter = 0;
    // The tracked utterance and its call, which resolves when reading ends.
    private String trackedId;

    // MARK: Listening

    @PluginMethod
    public void listen(PluginCall call) {
        main.post(() -> start(call));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    private void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is not available on this phone", "unavailable");
            return;
        }
        finish(null, "Replaced by a new attempt");
        stopSpeakingNow();
        listenCall = call;

        boolean onDevice = call.getBoolean("onDevice", true);
        if (onDevice && android.os.Build.VERSION.SDK_INT >= 31
                && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
        } else {
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        }
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onEvent(int eventType, Bundle params) {}

            @Override public void onPartialResults(Bundle partial) {
                ArrayList<String> texts = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (texts != null && !texts.isEmpty() && !texts.get(0).isEmpty()) {
                    JSObject data = new JSObject();
                    data.put("text", texts.get(0));
                    notifyListeners("partial", data);
                }
            }

            @Override public void onResults(Bundle results) {
                ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                JSObject data = new JSObject();
                JSArray alternatives = new JSArray();
                if (texts != null) for (String text : texts) alternatives.put(text);
                data.put("alternatives", alternatives);
                finish(data, null);
            }

            @Override public void onError(int error) {
                if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                    // Heard nothing usable: an empty answer, as on the iPhone.
                    JSObject data = new JSObject();
                    data.put("alternatives", new JSArray());
                    finish(data, null);
                } else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                    finish(null, "Microphone permission is not granted");
                } else {
                    finish(null, "Speech recognition stopped (error " + error + ")");
                }
            }
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "en-US"));
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, onDevice);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1600L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1600L);
        recognizer.startListening(intent);

        double maxSeconds = call.getDouble("maxSeconds", 10.0);
        limit = () -> { if (recognizer != null) recognizer.stopListening(); };
        main.postDelayed(limit, (long) (maxSeconds * 1000));
    }

    private void finish(JSObject data, String error) {
        PluginCall pending = listenCall;
        listenCall = null;
        if (limit != null) main.removeCallbacks(limit);
        limit = null;
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (pending == null) return;
        if (data != null) pending.resolve(data);
        else pending.reject(error);
    }

    // MARK: Reading aloud

    private void withTts(Runnable action) {
        if (ttsReady) {
            action.run();
            return;
        }
        afterReady.add(action);
        if (tts != null) return;
        tts = new TextToSpeech(getContext(), status -> main.post(() -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) {
                tts.setLanguage(Locale.US);
                tts.setOnUtteranceProgressListener(progress);
            }
            ArrayList<Runnable> queued = new ArrayList<>(afterReady);
            afterReady.clear();
            for (Runnable r : queued) r.run();
        }));
    }

    private final UtteranceProgressListener progress = new UtteranceProgressListener() {
        @Override public void onStart(String id) {}

        @Override public void onDone(String id) { ended(id); }

        // Still abstract, so it must be implemented; Android 5+ calls the one below.
        @SuppressWarnings("deprecation")
        @Override public void onError(String id) { ended(id); }

        @Override public void onError(String id, int errorCode) { ended(id); }

        @Override public void onStop(String id, boolean interrupted) { ended(id); }

        @Override public void onRangeStart(String id, int start, int end, int frame) {
            if (!id.equals(trackedId)) return;
            JSObject data = new JSObject();
            data.put("charIndex", start);
            notifyListeners("word", data);
        }
    };

    private void ended(String id) {
        if (!id.equals(trackedId)) return;
        trackedId = null;
        JSObject data = new JSObject();
        data.put("charIndex", -1);
        notifyListeners("word", data);
    }

    // Reads each text in turn; a new call stops anything still playing.
    // tracked: send "word" events for the first text (then -1 at the end).
    @PluginMethod
    public void speak(PluginCall call) {
        JSArray texts = call.getArray("texts", new JSArray());
        float rate = call.getFloat("rate", 0.85f);
        boolean tracked = call.getBoolean("tracked", false);
        main.post(() -> withTts(() -> {
            if (!ttsReady) {
                call.reject("Reading aloud is not available on this phone", "unavailable");
                return;
            }
            // A new tracked reading takes over the word events quietly; anything
            // else first tells the old tracked reading it ended.
            if (tracked) trackedId = null;
            stopSpeakingNow();
            tts.setSpeechRate(rate);
            try {
                for (int i = 0; i < texts.length(); i++) {
                    String id = "rien-" + (++utteranceCounter);
                    if (tracked && i == 0) trackedId = id;
                    tts.speak(texts.getString(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, id);
                }
            } catch (Exception e) {
                call.reject("Could not read that aloud");
                return;
            }
            call.resolve();
        }));
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        main.post(() -> {
            stopSpeakingNow();
            call.resolve();
        });
    }

    private void stopSpeakingNow() {
        if (tts != null && ttsReady) tts.stop();
        if (trackedId != null) ended(trackedId);
    }

    @Override
    protected void handleOnDestroy() {
        finish(null, "The app closed");
        if (tts != null) tts.shutdown();
    }
}
