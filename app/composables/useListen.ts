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
}

// Speech recognition for Say It. Native apps only (iPhone and Android): iPhone
// Home Screen web apps cannot use speech recognition.
export function useListen() {
  if (getCurrentScope()) onScopeDispose(() => stopAllSound())
  const supported = Capacitor.isNativePlatform()

  async function ensurePermission(): Promise<boolean> {
    let status = await RienSpeech.checkPermissions()
    if (status.speech === 'prompt' || status.microphone === 'prompt') status = await RienSpeech.requestPermissions()
    return status.speech === 'granted' && status.microphone === 'granted'
  }

  // Listens once (call it from a tap).
  async function listen(onPartial: (text: string) => void, options: { online?: boolean } = {}): Promise<Heard> {
    const handle = await RienSpeech.addListener('partial', ({ text }) => onPartial(text))
    try {
      stopSpeaking()
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

  return { supported, ensurePermission, listen, playRecording, stop: () => RienSpeech.stop() }
}
