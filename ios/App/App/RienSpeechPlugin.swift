import AVFoundation
import Capacitor
import Speech
import UIKit

// The app's bridge, so it can register plugins that live in this target.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RienSpeechPlugin())
    }
}

// Speech recognition for Say It. Deliberately gives the recognizer no hint of the
// expected sentence: a hint would make it "hear" endings she actually dropped.
@objc(RienSpeechPlugin)
public class RienSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RienSpeechPlugin"
    public let jsName = "RienSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
    ]

    // Stop listening this long after the last new words.
    private let silenceSeconds = 1.6

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var call: CAPPluginCall?
    private var lastResult: SFSpeechRecognitionResult?
    private var silenceTimer: Timer?
    private var limitTimer: Timer?
    // Her voice, so she can play herself back next to the model reading.
    private var recording: AVAudioFile?
    private var recordingURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("say-it.m4a")
    }

    // MARK: Permissions

    private func speechState() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }

    private func microphoneState() -> String {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speech": speechState(), "microphone": microphoneState()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { _ in
            AVAudioApplication.requestRecordPermission { _ in
                DispatchQueue.main.async {
                    call.resolve(["speech": self.speechState(), "microphone": self.microphoneState()])
                }
            }
        }
    }

    // MARK: Listening

    @objc func listen(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.start(call)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.request?.endAudio()
            call.resolve()
        }
    }

    private func start(_ call: CAPPluginCall) {
        guard speechState() == "granted", microphoneState() == "granted" else {
            call.reject("Speech recognition or microphone permission is not granted", "permission")
            return
        }
        let language = call.getString("language") ?? "en-US"
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
            call.reject("Speech recognition is not available right now", "unavailable")
            return
        }

        // Always start fresh, after any audio, from a tap in the app.
        finish(rejecting: "Replaced by a new attempt")
        self.call = call
        lastResult = nil

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            finish(rejecting: "Could not start the microphone: \(error.localizedDescription)")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.addsPunctuation = false
        // On the phone by default (private, works offline). With onDevice false,
        // iOS may use Apple's online recognition, which is usually more accurate.
        let onDevice = call.getBool("onDevice") ?? true
        if onDevice && recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        try? FileManager.default.removeItem(at: recordingURL)
        recording = try? AVAudioFile(
            forWriting: recordingURL,
            settings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: format.sampleRate,
                AVNumberOfChannelsKey: format.channelCount,
            ],
            commonFormat: format.commonFormat,
            interleaved: format.isInterleaved
        )
        let file = recording
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
            try? file?.write(from: buffer)
        }
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            finish(rejecting: "Could not start the microphone: \(error.localizedDescription)")
            return
        }

        let maxSeconds = call.getDouble("maxSeconds") ?? 10
        limitTimer = Timer.scheduledTimer(withTimeInterval: maxSeconds, repeats: false) { [weak self] _ in
            self?.request?.endAudio()
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let result = result {
                    self.lastResult = result
                    self.notifyListeners("partial", data: ["text": result.bestTranscription.formattedString])
                    self.restartSilenceTimer()
                    if result.isFinal {
                        self.finish(with: result)
                        return
                    }
                }
                if let error = error {
                    if let last = self.lastResult {
                        self.finish(with: last)
                    } else {
                        self.finish(rejecting: error.localizedDescription)
                    }
                }
            }
        }
    }

    private func restartSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: silenceSeconds, repeats: false) { [weak self] _ in
            self?.request?.endAudio()
        }
    }

    // Returns every whole-sentence reading, each word of the best one with its
    // confidence and the other spellings considered, and the recording.
    private func finish(with result: SFSpeechRecognitionResult) {
        let alternatives = result.transcriptions.map { $0.formattedString }
        let words: [[String: Any]] = result.bestTranscription.segments.map { segment in
            [
                "text": segment.substring,
                "confidence": Double(segment.confidence),
                "alternatives": segment.alternativeSubstrings,
            ]
        }
        let pending = call
        let hasRecording = recording != nil
        teardown()
        var data: [String: Any] = ["alternatives": alternatives, "words": words]
        if hasRecording {
            data["recording"] = recordingURL.absoluteString
        }
        pending?.resolve(data)
    }

    private func finish(rejecting message: String) {
        let pending = call
        teardown()
        pending?.reject(message)
    }

    private func teardown() {
        silenceTimer?.invalidate()
        limitTimer?.invalidate()
        silenceTimer = nil
        limitTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)
        task?.cancel()
        task = nil
        request = nil
        call = nil
        // Releasing the file finishes writing it.
        recording = nil
        // Hand audio back so reading aloud works again straight after.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
