import type { Component } from 'vue'
import type { GameId } from '~/utils/activities'
import CoupleTalk from './CoupleTalk.vue'
import FileBoss from './FileBoss.vue'
import FixIt from './FixIt.vue'
import GapRadio from './GapRadio.vue'
import ListenPick from './ListenPick.vue'
import PictureMatch from './PictureMatch.vue'
import SayIt from './SayIt.vue'
import SentenceBuilder from './SentenceBuilder.vue'
import SoundHunter from './SoundHunter.vue'
import SpeedRound from './SpeedRound.vue'
import WordRecall from './WordRecall.vue'

export const GAME_COMPONENTS: Record<GameId, Component> = {
  'word-recall': WordRecall,
  'fix-it': FixIt,
  'sound-hunter': SoundHunter,
  'sentence-builder': SentenceBuilder,
  'gap-radio': GapRadio,
  'say-it': SayIt,
  'speed-round': SpeedRound,
  'listen-pick': ListenPick,
  'picture-match': PictureMatch,
  'file-boss': FileBoss,
  'couple-talk': CoupleTalk,
}
