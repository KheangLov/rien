import type { IconName } from '~/components/RienIcon.vue'

export interface ActivityInfo {
  title: string
  blurb: string
  icon: IconName
}

export const ACTIVITIES = {
  'word-recall': { title: 'Word Recall', blurb: 'Type the words from class', icon: 'word-recall' },
  'fix-it': { title: 'Fix It', blurb: 'Find and fix the mistake', icon: 'fix-it' },
  'sound-hunter': { title: 'Final Sound Hunter', blurb: 'Hear the word endings', icon: 'sound-hunter' },
  'sentence-builder': { title: 'Sentence Builder', blurb: 'Put the words in order', icon: 'sentence-builder' },
  'gap-radio': { title: 'Gap Radio', blurb: 'Listen and fill the gaps', icon: 'gap-radio' },
  'say-it': { title: 'Say It', blurb: 'Read aloud, check your endings', icon: 'say-it' },
  'file-boss': { title: 'File Boss', blurb: '15 questions to finish a File', icon: 'file-boss' },
  'couple-talk': { title: 'Couple Talk', blurb: 'Ten minutes of English together', icon: 'couple-talk' },
} as const satisfies Record<string, ActivityInfo>

export type GameId = keyof typeof ACTIVITIES
