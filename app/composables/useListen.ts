import { Capacitor } from '@capacitor/core'
import { RienSpeech, type Heard } from '~/utils/rienSpeech'

export type { Heard }

// Speech recognition for Say It. Native apps only (iPhone and Android): iPhone
// Home Screen web apps cannot use speech recognition.
export function useListen() {
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

  // Plays her last recording back through the web view.
  function playRecording(url: string) {
    void new Audio(Capacitor.convertFileSrc(url)).play().catch(() => {})
  }

  return { supported, ensurePermission, listen, playRecording, stop: () => RienSpeech.stop() }
}
