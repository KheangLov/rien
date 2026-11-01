import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { HeardWord } from '#shared/utils/spoken'

// The app's own native plugin, registered once: ios/App/App/RienSpeechPlugin.swift
// and android/app/src/main/java/io/github/kheanglov/rien/RienSpeechPlugin.java.
// Listening (both) and reading aloud (Android only; iOS uses speechSynthesis).

type Permission = 'granted' | 'denied' | 'prompt'

export interface Heard {
  // Whole-sentence readings, best first.
  alternatives: string[]
  // The best reading word by word, with confidence and other spellings considered (iPhone).
  words?: HeardWord[]
  // file:// URL of her recording (iPhone).
  recording?: string
}

export interface RienSpeechPlugin {
  listen(options: { language?: string, maxSeconds?: number, onDevice?: boolean }): Promise<Heard>
  stop(): Promise<void>
  checkPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  requestPermissions(): Promise<{ speech: Permission, microphone: Permission }>
  speak(options: { texts: string[], rate: number, tracked?: boolean }): Promise<void>
  stopSpeaking(): Promise<void>
  addListener(event: 'partial', listener: (data: { text: string }) => void): Promise<PluginListenerHandle>
  addListener(event: 'word', listener: (data: { charIndex: number }) => void): Promise<PluginListenerHandle>
}

export const RienSpeech = registerPlugin<RienSpeechPlugin>('RienSpeech')
