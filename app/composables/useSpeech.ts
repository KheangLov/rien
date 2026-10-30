// Reading aloud only for now. Safari needs every call to start from a tap.
export function useSpeech() {
  const supported = import.meta.client && 'speechSynthesis' in window

  function speak(text: string, rate = 0.9) {
    if (!supported || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = rate
    window.speechSynthesis.speak(utterance)
  }

  return { supported, speak }
}
