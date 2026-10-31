import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

type Permission = 'granted' | 'denied' | 'prompt'

interface RienSpeechPlugin {
  listen(options: { language?: string, maxSeconds?: number }): Promise<{ alternatives: string[] }>
  stop(): Promise<void>
  checkPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  requestPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  addListener(event: 'partial', listener: (data: { text: string }) => void): Promise<PluginListenerHandle>
}

// The app's own Swift plugin (ios/App/App/RienSpeechPlugin.swift).
const RienSpeech = registerPlugin<RienSpeechPlugin>('RienSpeech')

// Speech recognition for Say It. Native app only: iPhone Home Screen web apps
// cannot use speech recognition.
export function useListen() {
  const supported = Capacitor.isNativePlatform()

  async function ensurePermission(): Promise<boolean> {
    let status = await RienSpeech.checkPermissions()
    if (status.speech === 'prompt' || status.microphone === 'prompt') status = await RienSpeech.requestPermissions()
    return status.speech === 'granted' && status.microphone === 'granted'
  }

  // Listens once (call it from a tap) and returns the alternatives, best first.
  async function listen(onPartial: (text: string) => void): Promise<string[]> {
    const handle = await RienSpeech.addListener('partial', ({ text }) => onPartial(text))
    try {
      window.speechSynthesis?.cancel()
      return (await RienSpeech.listen({ language: 'en-US', maxSeconds: 12 })).alternatives
    }
    finally {
      await handle.remove()
    }
  }

  return { supported, ensurePermission, listen, stop: () => RienSpeech.stop() }
}
