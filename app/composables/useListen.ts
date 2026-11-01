import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { HeardWord } from '#shared/utils/spoken'

type Permission = 'granted' | 'denied' | 'prompt'

export interface Heard {
  // Whole-sentence readings, best first.
  alternatives: string[]
  // The best reading word by word, with confidence and other spellings considered.
  words?: HeardWord[]
  // file:// URL of her recording.
  recording?: string
}

interface RienSpeechPlugin {
  listen(options: { language?: string, maxSeconds?: number, onDevice?: boolean }): Promise<Heard>
  stop(): Promise<void>
  checkPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  requestPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  addListener(event: 'partial', listener: (data: { text: string }) => void): Promise<PluginListenerHandle>
}

// The app's own plugin: ios/App/App/RienSpeechPlugin.swift and
// android/app/src/main/java/io/github/kheanglov/rien/RienSpeechPlugin.java.
const RienSpeech = registerPlugin<RienSpeechPlugin>('RienSpeech')

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
