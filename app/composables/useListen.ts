import { Capacitor } from '@capacitor/core'
import { RienSpeech, type Heard } from '~/utils/rienSpeech'

// Her recording being played back, so it can be stopped.
let playback: HTMLAudioElement | null = null

// Stops everything that makes or takes sound: reading aloud, her recording
// playing back, and listening. Runs on every screen change, when the app goes
// to the background, and when a sheet closes.
export function stopAllSound() {
  stopSpeaking()
  playback?.pause()
  playback = null
  if (Capacitor.isNativePlatform()) void RienSpeech.stop().catch(() => {})
  activeRecognition?.abort()
  activeRecognition = null
}

// The browser's own speech recognition (Chrome, Edge, Samsung Internet, Safari).
interface BrowserRecognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionClass = new () => BrowserRecognition

function browserRecognition(): RecognitionClass | undefined {
  if (!import.meta.client) return undefined
  const w = window as Window & { SpeechRecognition?: RecognitionClass, webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

// Whether Say It works here: the Rien app, or a browser with speech
// recognition. Not an iPhone Home Screen web app, where Apple blocks it.
export function canListen(): boolean {
  if (Capacitor.isNativePlatform()) return true
  if (!browserRecognition()) return false
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const homeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return !(ios && homeScreen)
}

let activeRecognition: BrowserRecognition | null = null

// Speech recognition for Say It: the app's own plugin in the Rien app, the
// browser's speech recognition on the web.
export function useListen() {
  if (getCurrentScope()) onScopeDispose(() => stopAllSound())
  const native = Capacitor.isNativePlatform()
  const supported = canListen()

  async function ensurePermission(): Promise<boolean> {
    // The browser asks for the microphone itself when listening starts.
    if (!native) return true
    let status = await RienSpeech.checkPermissions()
    if (status.speech === 'prompt' || status.microphone === 'prompt') status = await RienSpeech.requestPermissions()
    return status.speech === 'granted' && status.microphone === 'granted'
  }

  // One sentence through the browser: partial results as she speaks, then the
  // best few readings. Fails with "not-allowed" when the microphone is refused.
  function listenInBrowser(onPartial: (text: string) => void): Promise<Heard> {
    const Recognition = browserRecognition()
    if (!Recognition) return Promise.reject(new Error('unsupported'))
    return new Promise((resolve, reject) => {
      const recognition = new Recognition()
      activeRecognition = recognition
      recognition.lang = 'en-US'
      recognition.interimResults = true
      recognition.maxAlternatives = 3
      recognition.continuous = false
      let finalAlternatives: string[] = []
      let failed: string | null = null
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1]
        if (!result) return
        if (result.isFinal) finalAlternatives = Array.from(result, alt => alt.transcript.trim()).filter(Boolean)
        else onPartial(result[0]?.transcript ?? '')
      }
      recognition.onerror = (event) => { failed = event.error }
      recognition.onend = () => {
        activeRecognition = null
        if (finalAlternatives.length) resolve({ alternatives: finalAlternatives })
        else reject(new Error(failed ?? 'no-speech'))
      }
      recognition.start()
    })
  }

  // Listens once (call it from a tap).
  async function listen(onPartial: (text: string) => void, options: { online?: boolean } = {}): Promise<Heard> {
    stopSpeaking()
    if (!native) return listenInBrowser(onPartial)
    const handle = await RienSpeech.addListener('partial', ({ text }) => onPartial(text))
    try {
      return await RienSpeech.listen({ language: 'en-US', maxSeconds: 12, onDevice: !options.online })
    }
    finally {
      await handle.remove()
    }
  }

  // Plays her last recording back through the web view (one at a time).
  function playRecording(url: string) {
    stopSpeaking()
    playback?.pause()
    playback = new Audio(Capacitor.convertFileSrc(url))
    void playback.play().catch(() => {})
  }

  return { supported, ensurePermission, listen, playRecording, stop: () => (native ? RienSpeech.stop() : Promise.resolve(activeRecognition?.stop())) }
}
