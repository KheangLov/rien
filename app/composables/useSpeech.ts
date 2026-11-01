import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// Reading aloud. Safari needs every call to start from a tap, so call speak()
// directly inside a click handler. Android's web view has no speechSynthesis,
// so the Android app reads aloud through its own plugin
// (android/app/src/main/java/io/github/kheanglov/rien/RienSpeechPlugin.java).

interface NativeReader {
  speak(options: { texts: string[], rate: number, tracked?: boolean }): Promise<void>
  stopSpeaking(): Promise<void>
  addListener(event: 'word', listener: (data: { charIndex: number }) => void): Promise<PluginListenerHandle>
}

const nativeReader = registerPlugin<NativeReader>('RienSpeech')

export function usesNativeReader(): boolean {
  return Capacitor.getPlatform() === 'android'
}

// Stops anything being read aloud (before listening, for example).
export function stopSpeaking() {
  if (usesNativeReader()) void nativeReader.stopSpeaking().catch(() => {})
  else if (import.meta.client) window.speechSynthesis?.cancel()
}

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'))
  return english.find(v => v.localService && /en[-_]us/i.test(v.lang))
    ?? english.find(v => v.localService)
    ?? english[0]
}

// One listener for word positions, pointed at the latest tracked reading.
let onNativeWord: ((charIndex: number) => void) | null = null
let wordListener: Promise<PluginListenerHandle> | null = null

export function useSpeech() {
  const native = import.meta.client && usesNativeReader()
  const supported = native || (import.meta.client && 'speechSynthesis' in window)

  // Says each text in turn; a new call stops anything still playing.
  function speak(text: string | string[], rate = 0.85) {
    if (!supported) return
    const texts = (Array.isArray(text) ? text : [text]).filter(Boolean)
    if (native) {
      void nativeReader.speak({ texts, rate }).catch(() => {})
      return
    }
    window.speechSynthesis.cancel()
    const voice = englishVoice()
    for (const part of texts) {
      const utterance = new SpeechSynthesisUtterance(part)
      utterance.lang = voice?.lang ?? 'en-US'
      if (voice) utterance.voice = voice
      utterance.rate = rate
      window.speechSynthesis.speak(utterance)
    }
  }

  // Reads text and reports the character position of each word as it is spoken
  // (where the phone sends word boundaries), then -1 at the end.
  function speakTracked(text: string, rate: number, onWord: (charIndex: number) => void) {
    if (!supported) return
    if (native) {
      wordListener ??= nativeReader.addListener('word', ({ charIndex }) => onNativeWord?.(charIndex))
      onNativeWord = onWord
      void nativeReader.speak({ texts: [text], rate, tracked: true }).catch(() => onWord(-1))
      return
    }
    window.speechSynthesis.cancel()
    const voice = englishVoice()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice?.lang ?? 'en-US'
    if (voice) utterance.voice = voice
    utterance.rate = rate
    utterance.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onWord(e.charIndex) }
    utterance.onend = () => onWord(-1)
    window.speechSynthesis.speak(utterance)
  }

  return { supported, speak, speakTracked }
}
