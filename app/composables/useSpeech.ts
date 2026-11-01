// Reading aloud only for now. Safari needs every call to start from a tap,
// so call speak() directly inside a click handler.

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'))
  return english.find(v => v.localService && /en[-_]us/i.test(v.lang))
    ?? english.find(v => v.localService)
    ?? english[0]
}

export function useSpeech() {
  const supported = import.meta.client && 'speechSynthesis' in window

  // Says each text in turn; a new call stops anything still playing.
  function speak(text: string | string[], rate = 0.85) {
    if (!supported) return
    window.speechSynthesis.cancel()
    const voice = englishVoice()
    for (const part of Array.isArray(text) ? text : [text]) {
      if (!part) continue
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
