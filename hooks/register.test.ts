import { expect, test } from 'claude-code/testing'

import {
  animal,
  animalColumn,
  animalShown,
  fare,
  fareAt,
  findPython,
  lastLine,
  parseLive,
  parseProbe,
  poofs,
  render,
  stamped,
  blinkShows,
} from './register'
import type { Fares, Mark, Phase, Run } from './register'

// What meter.py draws for the same state, level and distance: generated from
// meter.render() and meter.animal_column(). The two must stay the same picture.
// Without stamps an eaten coin leaves nothing.
const LINES: readonly (readonly [Phase, number, number, string])[] = [
 [
  'run',
  0,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌'
 ],
 [
  'run',
  0,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌'
 ],
 [
  'run',
  0,
  5,
  '🪙        🪙        🪙        🪙         🐌'
 ],
 [
  'run',
  0,
  6,
  '🪙        🪙        🪙        🪙        🐌'
 ],
 [
  'run',
  0,
  7,
  '🪙        🪙        🪙        🪙       🐌'
 ],
 [
  'run',
  0,
  8,
  '🪙        🪙        🪙        🪙      🐌'
 ],
 [
  'run',
  0,
  13,
  '🪙        🪙        🪙        🪙 🐌'
 ],
 [
  'run',
  0,
  14,
  '🪙        🪙        🪙        🪙🐌'
 ],
 [
  'run',
  0,
  15,
  '🪙        🪙        🪙         🐌'
 ],
 [
  'run',
  0,
  22,
  '🪙        🪙        🪙  🐌'
 ],
 [
  'run',
  0,
  23,
  '🪙        🪙        🪙 🐌'
 ],
 [
  'run',
  0,
  29,
  '🪙        🪙     🐌'
 ],
 [
  'run',
  0,
  36,
  '🪙        🐌'
 ],
 [
  'run',
  0,
  37,
  '🪙       🐌'
 ],
 [
  'run',
  0,
  38,
  '🪙      🐌'
 ],
 [
  'run',
  0,
  77,
  '🪙        🪙   🐌'
 ],
 [
  'run',
  3,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐁'
 ],
 [
  'run',
  3,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐁'
 ],
 [
  'run',
  3,
  5,
  '🪙        🪙        🪙        🪙         🐁'
 ],
 [
  'run',
  3,
  6,
  '🪙        🪙        🪙        🪙        🐁'
 ],
 [
  'run',
  3,
  7,
  '🪙        🪙        🪙        🪙       🐁'
 ],
 [
  'run',
  3,
  8,
  '🪙        🪙        🪙        🪙      🐁'
 ],
 [
  'run',
  3,
  13,
  '🪙        🪙        🪙        🪙 🐁'
 ],
 [
  'run',
  3,
  14,
  '🪙        🪙        🪙        🪙🐁'
 ],
 [
  'run',
  3,
  15,
  '🪙        🪙        🪙         🐁'
 ],
 [
  'run',
  3,
  22,
  '🪙        🪙        🪙  🐁'
 ],
 [
  'run',
  3,
  23,
  '🪙        🪙        🪙 🐁'
 ],
 [
  'run',
  3,
  29,
  '🪙        🪙     🐁'
 ],
 [
  'run',
  3,
  36,
  '🪙        🐁'
 ],
 [
  'run',
  3,
  37,
  '🪙       🐁'
 ],
 [
  'run',
  3,
  38,
  '🪙      🐁'
 ],
 [
  'run',
  3,
  77,
  '🪙        🪙   🐁'
 ],
 [
  'run',
  7,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐘'
 ],
 [
  'run',
  7,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐘'
 ],
 [
  'run',
  7,
  5,
  '🪙        🪙        🪙        🪙         🐘'
 ],
 [
  'run',
  7,
  6,
  '🪙        🪙        🪙        🪙        🐘'
 ],
 [
  'run',
  7,
  7,
  '🪙        🪙        🪙        🪙       🐘'
 ],
 [
  'run',
  7,
  8,
  '🪙        🪙        🪙        🪙      🐘'
 ],
 [
  'run',
  7,
  13,
  '🪙        🪙        🪙        🪙 🐘'
 ],
 [
  'run',
  7,
  14,
  '🪙        🪙        🪙        🪙🐘'
 ],
 [
  'run',
  7,
  15,
  '🪙        🪙        🪙         🐘'
 ],
 [
  'run',
  7,
  22,
  '🪙        🪙        🪙  🐘'
 ],
 [
  'run',
  7,
  23,
  '🪙        🪙        🪙 🐘'
 ],
 [
  'run',
  7,
  29,
  '🪙        🪙     🐘'
 ],
 [
  'run',
  7,
  36,
  '🪙        🐘'
 ],
 [
  'run',
  7,
  37,
  '🪙       🐘'
 ],
 [
  'run',
  7,
  38,
  '🪙      🐘'
 ],
 [
  'run',
  7,
  77,
  '🪙        🪙   🐘'
 ],
 [
  'run',
  12,
  0,
  '🪙        🪙        🪙        🪙        🪙    🦌'
 ],
 [
  'run',
  12,
  1,
  '🪙        🪙        🪙        🪙        🪙   🦌'
 ],
 [
  'run',
  12,
  5,
  '🪙        🪙        🪙        🪙         🦌'
 ],
 [
  'run',
  12,
  6,
  '🪙        🪙        🪙        🪙        🦌'
 ],
 [
  'run',
  12,
  7,
  '🪙        🪙        🪙        🪙       🦌'
 ],
 [
  'run',
  12,
  8,
  '🪙        🪙        🪙        🪙      🦌'
 ],
 [
  'run',
  12,
  13,
  '🪙        🪙        🪙        🪙 🦌'
 ],
 [
  'run',
  12,
  14,
  '🪙        🪙        🪙        🪙🦌'
 ],
 [
  'run',
  12,
  15,
  '🪙        🪙        🪙         🦌'
 ],
 [
  'run',
  12,
  22,
  '🪙        🪙        🪙  🦌'
 ],
 [
  'run',
  12,
  23,
  '🪙        🪙        🪙 🦌'
 ],
 [
  'run',
  12,
  29,
  '🪙        🪙     🦌'
 ],
 [
  'run',
  12,
  36,
  '🪙        🦌'
 ],
 [
  'run',
  12,
  37,
  '🪙       🦌'
 ],
 [
  'run',
  12,
  38,
  '🪙      🦌'
 ],
 [
  'run',
  12,
  77,
  '🪙        🪙   🦌'
 ],
 [
  'run',
  16,
  0,
  '🪙        🪙        🪙        🪙        🪙    🦅'
 ],
 [
  'run',
  16,
  1,
  '🪙        🪙        🪙        🪙        🪙   🦅'
 ],
 [
  'run',
  16,
  5,
  '🪙        🪙        🪙        🪙         🦅'
 ],
 [
  'run',
  16,
  6,
  '🪙        🪙        🪙        🪙        🦅'
 ],
 [
  'run',
  16,
  7,
  '🪙        🪙        🪙        🪙       🦅'
 ],
 [
  'run',
  16,
  8,
  '🪙        🪙        🪙        🪙      🦅'
 ],
 [
  'run',
  16,
  13,
  '🪙        🪙        🪙        🪙 🦅'
 ],
 [
  'run',
  16,
  14,
  '🪙        🪙        🪙        🪙🦅'
 ],
 [
  'run',
  16,
  15,
  '🪙        🪙        🪙         🦅'
 ],
 [
  'run',
  16,
  22,
  '🪙        🪙        🪙  🦅'
 ],
 [
  'run',
  16,
  23,
  '🪙        🪙        🪙 🦅'
 ],
 [
  'run',
  16,
  29,
  '🪙        🪙     🦅'
 ],
 [
  'run',
  16,
  36,
  '🪙        🦅'
 ],
 [
  'run',
  16,
  37,
  '🪙       🦅'
 ],
 [
  'run',
  16,
  38,
  '🪙      🦅'
 ],
 [
  'run',
  16,
  77,
  '🪙        🪙   🦅'
 ],
 [
  'halt',
  0,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌🔧'
 ],
 [
  'halt',
  0,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌🔧'
 ],
 [
  'halt',
  0,
  5,
  '🪙        🪙        🪙        🪙         🐌🔧'
 ],
 [
  'halt',
  0,
  6,
  '🪙        🪙        🪙        🪙        🐌🔧'
 ],
 [
  'halt',
  0,
  7,
  '🪙        🪙        🪙        🪙       🐌🔧'
 ],
 [
  'halt',
  0,
  8,
  '🪙        🪙        🪙        🪙      🐌🔧'
 ],
 [
  'halt',
  0,
  13,
  '🪙        🪙        🪙        🪙 🐌🔧'
 ],
 [
  'halt',
  0,
  14,
  '🪙        🪙        🪙        🪙🐌🔧'
 ],
 [
  'halt',
  0,
  15,
  '🪙        🪙        🪙         🐌🔧'
 ],
 [
  'halt',
  0,
  22,
  '🪙        🪙        🪙  🐌🔧'
 ],
 [
  'halt',
  0,
  23,
  '🪙        🪙        🪙 🐌🔧'
 ],
 [
  'halt',
  0,
  29,
  '🪙        🪙     🐌🔧'
 ],
 [
  'halt',
  0,
  36,
  '🪙        🐌🔧'
 ],
 [
  'halt',
  0,
  37,
  '🪙       🐌🔧'
 ],
 [
  'halt',
  0,
  38,
  '🪙      🐌🔧'
 ],
 [
  'halt',
  0,
  77,
  '🪙        🪙   🐌🔧'
 ],
 [
  'halt',
  3,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐁🔧'
 ],
 [
  'halt',
  3,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐁🔧'
 ],
 [
  'halt',
  3,
  5,
  '🪙        🪙        🪙        🪙         🐁🔧'
 ],
 [
  'halt',
  3,
  6,
  '🪙        🪙        🪙        🪙        🐁🔧'
 ],
 [
  'halt',
  3,
  7,
  '🪙        🪙        🪙        🪙       🐁🔧'
 ],
 [
  'halt',
  3,
  8,
  '🪙        🪙        🪙        🪙      🐁🔧'
 ],
 [
  'halt',
  3,
  13,
  '🪙        🪙        🪙        🪙 🐁🔧'
 ],
 [
  'halt',
  3,
  14,
  '🪙        🪙        🪙        🪙🐁🔧'
 ],
 [
  'halt',
  3,
  15,
  '🪙        🪙        🪙         🐁🔧'
 ],
 [
  'halt',
  3,
  22,
  '🪙        🪙        🪙  🐁🔧'
 ],
 [
  'halt',
  3,
  23,
  '🪙        🪙        🪙 🐁🔧'
 ],
 [
  'halt',
  3,
  29,
  '🪙        🪙     🐁🔧'
 ],
 [
  'halt',
  3,
  36,
  '🪙        🐁🔧'
 ],
 [
  'halt',
  3,
  37,
  '🪙       🐁🔧'
 ],
 [
  'halt',
  3,
  38,
  '🪙      🐁🔧'
 ],
 [
  'halt',
  3,
  77,
  '🪙        🪙   🐁🔧'
 ],
 [
  'halt',
  7,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐘🔧'
 ],
 [
  'halt',
  7,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐘🔧'
 ],
 [
  'halt',
  7,
  5,
  '🪙        🪙        🪙        🪙         🐘🔧'
 ],
 [
  'halt',
  7,
  6,
  '🪙        🪙        🪙        🪙        🐘🔧'
 ],
 [
  'halt',
  7,
  7,
  '🪙        🪙        🪙        🪙       🐘🔧'
 ],
 [
  'halt',
  7,
  8,
  '🪙        🪙        🪙        🪙      🐘🔧'
 ],
 [
  'halt',
  7,
  13,
  '🪙        🪙        🪙        🪙 🐘🔧'
 ],
 [
  'halt',
  7,
  14,
  '🪙        🪙        🪙        🪙🐘🔧'
 ],
 [
  'halt',
  7,
  15,
  '🪙        🪙        🪙         🐘🔧'
 ],
 [
  'halt',
  7,
  22,
  '🪙        🪙        🪙  🐘🔧'
 ],
 [
  'halt',
  7,
  23,
  '🪙        🪙        🪙 🐘🔧'
 ],
 [
  'halt',
  7,
  29,
  '🪙        🪙     🐘🔧'
 ],
 [
  'halt',
  7,
  36,
  '🪙        🐘🔧'
 ],
 [
  'halt',
  7,
  37,
  '🪙       🐘🔧'
 ],
 [
  'halt',
  7,
  38,
  '🪙      🐘🔧'
 ],
 [
  'halt',
  7,
  77,
  '🪙        🪙   🐘🔧'
 ],
 [
  'halt',
  12,
  0,
  '🪙        🪙        🪙        🪙        🪙    🦌🔧'
 ],
 [
  'halt',
  12,
  1,
  '🪙        🪙        🪙        🪙        🪙   🦌🔧'
 ],
 [
  'halt',
  12,
  5,
  '🪙        🪙        🪙        🪙         🦌🔧'
 ],
 [
  'halt',
  12,
  6,
  '🪙        🪙        🪙        🪙        🦌🔧'
 ],
 [
  'halt',
  12,
  7,
  '🪙        🪙        🪙        🪙       🦌🔧'
 ],
 [
  'halt',
  12,
  8,
  '🪙        🪙        🪙        🪙      🦌🔧'
 ],
 [
  'halt',
  12,
  13,
  '🪙        🪙        🪙        🪙 🦌🔧'
 ],
 [
  'halt',
  12,
  14,
  '🪙        🪙        🪙        🪙🦌🔧'
 ],
 [
  'halt',
  12,
  15,
  '🪙        🪙        🪙         🦌🔧'
 ],
 [
  'halt',
  12,
  22,
  '🪙        🪙        🪙  🦌🔧'
 ],
 [
  'halt',
  12,
  23,
  '🪙        🪙        🪙 🦌🔧'
 ],
 [
  'halt',
  12,
  29,
  '🪙        🪙     🦌🔧'
 ],
 [
  'halt',
  12,
  36,
  '🪙        🦌🔧'
 ],
 [
  'halt',
  12,
  37,
  '🪙       🦌🔧'
 ],
 [
  'halt',
  12,
  38,
  '🪙      🦌🔧'
 ],
 [
  'halt',
  12,
  77,
  '🪙        🪙   🦌🔧'
 ],
 [
  'halt',
  16,
  0,
  '🪙        🪙        🪙        🪙        🪙    🦅🔧'
 ],
 [
  'halt',
  16,
  1,
  '🪙        🪙        🪙        🪙        🪙   🦅🔧'
 ],
 [
  'halt',
  16,
  5,
  '🪙        🪙        🪙        🪙         🦅🔧'
 ],
 [
  'halt',
  16,
  6,
  '🪙        🪙        🪙        🪙        🦅🔧'
 ],
 [
  'halt',
  16,
  7,
  '🪙        🪙        🪙        🪙       🦅🔧'
 ],
 [
  'halt',
  16,
  8,
  '🪙        🪙        🪙        🪙      🦅🔧'
 ],
 [
  'halt',
  16,
  13,
  '🪙        🪙        🪙        🪙 🦅🔧'
 ],
 [
  'halt',
  16,
  14,
  '🪙        🪙        🪙        🪙🦅🔧'
 ],
 [
  'halt',
  16,
  15,
  '🪙        🪙        🪙         🦅🔧'
 ],
 [
  'halt',
  16,
  22,
  '🪙        🪙        🪙  🦅🔧'
 ],
 [
  'halt',
  16,
  23,
  '🪙        🪙        🪙 🦅🔧'
 ],
 [
  'halt',
  16,
  29,
  '🪙        🪙     🦅🔧'
 ],
 [
  'halt',
  16,
  36,
  '🪙        🦅🔧'
 ],
 [
  'halt',
  16,
  37,
  '🪙       🦅🔧'
 ],
 [
  'halt',
  16,
  38,
  '🪙      🦅🔧'
 ],
 [
  'halt',
  16,
  77,
  '🪙        🪙   🦅🔧'
 ],
 [
  'vacant',
  0,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌💤'
 ],
 [
  'vacant',
  0,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  0,
  5,
  '🪙        🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  0,
  6,
  '🪙        🪙        🪙        🪙        🐌💤'
 ],
 [
  'vacant',
  0,
  7,
  '🪙        🪙        🪙        🪙       🐌💤'
 ],
 [
  'vacant',
  0,
  8,
  '🪙        🪙        🪙        🪙      🐌💤'
 ],
 [
  'vacant',
  0,
  13,
  '🪙        🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  0,
  14,
  '🪙        🪙        🪙        🪙🐌💤'
 ],
 [
  'vacant',
  0,
  15,
  '🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  0,
  22,
  '🪙        🪙        🪙  🐌💤'
 ],
 [
  'vacant',
  0,
  23,
  '🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  0,
  29,
  '🪙        🪙     🐌💤'
 ],
 [
  'vacant',
  0,
  36,
  '🪙        🐌💤'
 ],
 [
  'vacant',
  0,
  37,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  0,
  38,
  '🪙      🐌💤'
 ],
 [
  'vacant',
  0,
  77,
  '🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  3,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌💤'
 ],
 [
  'vacant',
  3,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  3,
  5,
  '🪙        🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  3,
  6,
  '🪙        🪙        🪙        🪙        🐌💤'
 ],
 [
  'vacant',
  3,
  7,
  '🪙        🪙        🪙        🪙       🐌💤'
 ],
 [
  'vacant',
  3,
  8,
  '🪙        🪙        🪙        🪙      🐌💤'
 ],
 [
  'vacant',
  3,
  13,
  '🪙        🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  3,
  14,
  '🪙        🪙        🪙        🪙🐌💤'
 ],
 [
  'vacant',
  3,
  15,
  '🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  3,
  22,
  '🪙        🪙        🪙  🐌💤'
 ],
 [
  'vacant',
  3,
  23,
  '🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  3,
  29,
  '🪙        🪙     🐌💤'
 ],
 [
  'vacant',
  3,
  36,
  '🪙        🐌💤'
 ],
 [
  'vacant',
  3,
  37,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  3,
  38,
  '🪙      🐌💤'
 ],
 [
  'vacant',
  3,
  77,
  '🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  7,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌💤'
 ],
 [
  'vacant',
  7,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  7,
  5,
  '🪙        🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  7,
  6,
  '🪙        🪙        🪙        🪙        🐌💤'
 ],
 [
  'vacant',
  7,
  7,
  '🪙        🪙        🪙        🪙       🐌💤'
 ],
 [
  'vacant',
  7,
  8,
  '🪙        🪙        🪙        🪙      🐌💤'
 ],
 [
  'vacant',
  7,
  13,
  '🪙        🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  7,
  14,
  '🪙        🪙        🪙        🪙🐌💤'
 ],
 [
  'vacant',
  7,
  15,
  '🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  7,
  22,
  '🪙        🪙        🪙  🐌💤'
 ],
 [
  'vacant',
  7,
  23,
  '🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  7,
  29,
  '🪙        🪙     🐌💤'
 ],
 [
  'vacant',
  7,
  36,
  '🪙        🐌💤'
 ],
 [
  'vacant',
  7,
  37,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  7,
  38,
  '🪙      🐌💤'
 ],
 [
  'vacant',
  7,
  77,
  '🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  12,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌💤'
 ],
 [
  'vacant',
  12,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  12,
  5,
  '🪙        🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  12,
  6,
  '🪙        🪙        🪙        🪙        🐌💤'
 ],
 [
  'vacant',
  12,
  7,
  '🪙        🪙        🪙        🪙       🐌💤'
 ],
 [
  'vacant',
  12,
  8,
  '🪙        🪙        🪙        🪙      🐌💤'
 ],
 [
  'vacant',
  12,
  13,
  '🪙        🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  12,
  14,
  '🪙        🪙        🪙        🪙🐌💤'
 ],
 [
  'vacant',
  12,
  15,
  '🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  12,
  22,
  '🪙        🪙        🪙  🐌💤'
 ],
 [
  'vacant',
  12,
  23,
  '🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  12,
  29,
  '🪙        🪙     🐌💤'
 ],
 [
  'vacant',
  12,
  36,
  '🪙        🐌💤'
 ],
 [
  'vacant',
  12,
  37,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  12,
  38,
  '🪙      🐌💤'
 ],
 [
  'vacant',
  12,
  77,
  '🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  16,
  0,
  '🪙        🪙        🪙        🪙        🪙    🐌💤'
 ],
 [
  'vacant',
  16,
  1,
  '🪙        🪙        🪙        🪙        🪙   🐌💤'
 ],
 [
  'vacant',
  16,
  5,
  '🪙        🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  16,
  6,
  '🪙        🪙        🪙        🪙        🐌💤'
 ],
 [
  'vacant',
  16,
  7,
  '🪙        🪙        🪙        🪙       🐌💤'
 ],
 [
  'vacant',
  16,
  8,
  '🪙        🪙        🪙        🪙      🐌💤'
 ],
 [
  'vacant',
  16,
  13,
  '🪙        🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  16,
  14,
  '🪙        🪙        🪙        🪙🐌💤'
 ],
 [
  'vacant',
  16,
  15,
  '🪙        🪙        🪙         🐌💤'
 ],
 [
  'vacant',
  16,
  22,
  '🪙        🪙        🪙  🐌💤'
 ],
 [
  'vacant',
  16,
  23,
  '🪙        🪙        🪙 🐌💤'
 ],
 [
  'vacant',
  16,
  29,
  '🪙        🪙     🐌💤'
 ],
 [
  'vacant',
  16,
  36,
  '🪙        🐌💤'
 ],
 [
  'vacant',
  16,
  37,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  16,
  38,
  '🪙      🐌💤'
 ],
 [
  'vacant',
  16,
  77,
  '🪙        🪙   🐌💤'
 ]
]

const COLUMNS: readonly (readonly [number, number])[] = [[0, 46], [1, 45], [2, 44], [3, 43], [4, 42], [5, 41], [6, 40], [7, 39], [8, 38], [9, 37], [10, 36], [11, 35], [12, 34], [13, 33], [14, 32], [15, 31], [16, 30], [17, 29], [18, 28], [19, 27], [20, 26], [21, 25], [22, 24], [23, 23], [24, 22], [25, 21], [26, 20], [27, 19], [28, 18], [29, 17], [30, 16], [31, 15], [32, 14], [33, 13], [34, 12], [35, 11], [36, 10], [37, 9], [38, 8], [39, 7], [40, 6], [41, 5], [42, 4], [43, 3], [44, 2], [45, 0], [46, 46], [47, 45], [48, 44], [49, 43], [50, 42], [51, 41], [52, 40], [53, 39], [54, 38], [55, 37], [56, 36], [57, 35], [58, 34], [59, 33], [60, 32], [61, 31], [62, 30], [63, 29], [64, 28], [65, 27], [66, 26], [67, 25], [68, 24], [69, 23], [70, 22], [71, 21], [72, 20], [73, 19], [74, 18], [75, 17], [76, 16], [77, 15], [78, 14], [79, 13], [80, 12], [81, 11], [82, 10], [83, 9], [84, 8], [85, 7], [86, 6], [87, 5], [88, 4], [89, 3], [90, 2], [91, 0], [92, 46], [93, 45], [94, 44], [95, 43]]

test('draws the line meter.py draws', async () => {
  for (const [phase, level, dist, line] of LINES) {
    expect(render(phase, level, dist)).toBe(line)
  }
})

test('puts the animal where meter.py puts it', async () => {
  for (const [dist, column] of COLUMNS) {
    expect(animalColumn(dist)).toBe(column)
  }
  expect(animalColumn(12.9)).toBe(animalColumn(12))
})

test('picks the animal by speed level', async () => {
  const levels = Array.from({ length: 17 }, (_, level) => level)
  expect(levels.map(animal).join('')).toBe('🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅')
  expect(animal(99)).toBe('🦅')
  expect(animal(-1)).toBe('🐌')
})

test('reads what meter.py leaves and refuses anything else', async () => {
  expect(parseLive('run 7')).toEqual({ phase: 'run', level: 7, mark: '' })
  expect(parseLive('vacant 0\n')).toEqual({ phase: 'vacant', level: 0, mark: '' })
  expect(parseLive('run 7 gust\n')).toEqual({ phase: 'run', level: 7, mark: 'gust' })
  expect(parseLive('run 16 fire\n')).toEqual({ phase: 'run', level: 16, mark: 'fire' })
  expect(parseLive('halt 3\n')).toEqual({ phase: 'halt', level: 3, mark: '' })
  expect(parseLive('vacant 0 home\n')).toEqual({ phase: 'vacant', level: 0, mark: 'home' })
  expect(parseLive('run 7 sparkle')).toEqual({ phase: 'run', level: 7, mark: '' })
  expect(parseLive('')).toBeUndefined()
  expect(parseLive('gallop 3')).toBeUndefined()
  expect(parseLive('run fast')).toBeUndefined()
})

// A machine by what each program name answers to the probe: its output, its
// exit status when it fails, or nothing when it is not there.
function machine(programs: Record<string, string | number>): { run: Run; tried: string[] } {
  const tried: string[] = []
  const run: Run = async argv => {
    const name = argv[0] ?? ''
    tried.push(name)
    const answer = programs[name]
    if (answer === undefined) {
      throw new Error(`failed to start: ENOENT: ${name}`)
    }

    return typeof answer === 'number'
      ? { exitCode: answer, stdout: '' }
      : { exitCode: 0, stdout: answer }
  }

  return { run, tried }
}

test('takes the first Python that is new enough, by the path it gives', async () => {
  const system = machine({ '/usr/bin/python3': '3 12 /usr/bin/python3\n' })
  expect(await findPython(system.run)).toEqual({ path: '/usr/bin/python3' })
  expect(system.tried).toEqual(['/usr/bin/python3'])

  // Not at /usr/bin: the one on PATH, by its real path and not the shim's name.
  const shim = machine({ python3: '3 10 /opt/py 3.10/bin/python3.10\n' })
  expect(await findPython(shim.run)).toEqual({ path: '/opt/py 3.10/bin/python3.10' })
  expect(shim.tried).toEqual(['/usr/bin/python3', 'python3'])

  const bare = machine({ python: '3 7 \n' })
  expect(await findPython(bare.run)).toEqual({ path: 'python' })
})

test('passes over a Python that is too old or is not Python 3', async () => {
  const mixed = machine({ '/usr/bin/python3': '3 6 /usr/bin/python3\n', python3: '3 13 /usr/local/bin/python3\n' })
  expect(await findPython(mixed.run)).toEqual({ path: '/usr/local/bin/python3' })

  // Python 2 does not know -I and exits with 2.
  const two = machine({ python: 2, python3: '3 8 /usr/bin/python3.8\n' })
  expect(await findPython(two.run, ['python', 'python3'])).toEqual({ path: '/usr/bin/python3.8' })
})

test('says what is missing when no Python will do', async () => {
  expect(await findPython(machine({}).run)).toEqual({
    problem: 'taxi-horse needs Python 3.7 or newer: python3 not found',
  })
  expect(await findPython(machine({ python: 2 }).run)).toEqual({
    problem: 'taxi-horse needs Python 3.7 or newer: python3 not found',
  })
  expect(await findPython(machine({ '/usr/bin/python3': '3 6 /usr/bin/python3\n', python3: '3 5 /x\n' }).run)).toEqual({
    problem: 'taxi-horse needs Python 3.7 or newer: found 3.6',
  })
})

test('reads the probe answer and the last line of an error', async () => {
  expect(parseProbe('3 12 /usr/bin/python3\n')).toEqual({ major: 3, minor: 12, path: '/usr/bin/python3' })
  expect(parseProbe('3 9 \n')).toEqual({ major: 3, minor: 9, path: '' })
  expect(parseProbe('')).toBeUndefined()
  expect(parseProbe('Python 3.12.3')).toBeUndefined()
  expect(lastLine('Traceback (most recent call last):\n  File "x"\nValueError: bad\n')).toBe('ValueError: bad')
  expect(lastLine('')).toBe('')
})

// The same as LINES, with something behind the animal: generated from
// meter.render(..., mark=...).
const MARKED: readonly (readonly [Phase, number, number, Mark, string])[] = [
  ['run', 0, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🐌💨'],
  ['run', 0, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🐌💨'],
  ['run', 0, 5, 'gust', '🪙        🪙        🪙        🪙         🐌💨'],
  ['run', 0, 6, 'gust', '🪙        🪙        🪙        🪙        🐌💨'],
  ['run', 0, 7, 'gust', '🪙        🪙        🪙        🪙       🐌💨'],
  ['run', 0, 13, 'gust', '🪙        🪙        🪙        🪙 🐌💨'],
  ['run', 0, 14, 'gust', '🪙        🪙        🪙        🪙🐌💨'],
  ['run', 0, 22, 'gust', '🪙        🪙        🪙  🐌💨'],
  ['run', 0, 30, 'gust', '🪙        🪙    🐌💨'],
  ['run', 0, 36, 'gust', '🪙        🐌💨'],
  ['run', 0, 37, 'gust', '🪙       🐌💨'],
  ['run', 0, 38, 'gust', '🪙      🐌💨'],
  ['run', 0, 39, 'gust', '🪙     🐌💨'],
  ['run', 0, 77, 'gust', '🪙        🪙   🐌💨'],
  ['run', 7, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🐘💨'],
  ['run', 7, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🐘💨'],
  ['run', 7, 5, 'gust', '🪙        🪙        🪙        🪙         🐘💨'],
  ['run', 7, 6, 'gust', '🪙        🪙        🪙        🪙        🐘💨'],
  ['run', 7, 7, 'gust', '🪙        🪙        🪙        🪙       🐘💨'],
  ['run', 7, 13, 'gust', '🪙        🪙        🪙        🪙 🐘💨'],
  ['run', 7, 14, 'gust', '🪙        🪙        🪙        🪙🐘💨'],
  ['run', 7, 22, 'gust', '🪙        🪙        🪙  🐘💨'],
  ['run', 7, 30, 'gust', '🪙        🪙    🐘💨'],
  ['run', 7, 36, 'gust', '🪙        🐘💨'],
  ['run', 7, 37, 'gust', '🪙       🐘💨'],
  ['run', 7, 38, 'gust', '🪙      🐘💨'],
  ['run', 7, 39, 'gust', '🪙     🐘💨'],
  ['run', 7, 77, 'gust', '🪙        🪙   🐘💨'],
  ['run', 16, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🦅💨'],
  ['run', 16, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🦅💨'],
  ['run', 16, 5, 'gust', '🪙        🪙        🪙        🪙         🦅💨'],
  ['run', 16, 6, 'gust', '🪙        🪙        🪙        🪙        🦅💨'],
  ['run', 16, 7, 'gust', '🪙        🪙        🪙        🪙       🦅💨'],
  ['run', 16, 13, 'gust', '🪙        🪙        🪙        🪙 🦅💨'],
  ['run', 16, 14, 'gust', '🪙        🪙        🪙        🪙🦅💨'],
  ['run', 16, 22, 'gust', '🪙        🪙        🪙  🦅💨'],
  ['run', 16, 30, 'gust', '🪙        🪙    🦅💨'],
  ['run', 16, 36, 'gust', '🪙        🦅💨'],
  ['run', 16, 37, 'gust', '🪙       🦅💨'],
  ['run', 16, 38, 'gust', '🪙      🦅💨'],
  ['run', 16, 39, 'gust', '🪙     🦅💨'],
  ['run', 16, 77, 'gust', '🪙        🪙   🦅💨'],
  ['run', 0, 0, 'fire', '🪙        🪙        🪙        🪙        🪙    🐌🔥'],
  ['run', 0, 1, 'fire', '🪙        🪙        🪙        🪙        🪙   🐌🔥'],
  ['run', 0, 5, 'fire', '🪙        🪙        🪙        🪙         🐌🔥'],
  ['run', 0, 6, 'fire', '🪙        🪙        🪙        🪙        🐌🔥'],
  ['run', 0, 7, 'fire', '🪙        🪙        🪙        🪙       🐌🔥'],
  ['run', 0, 13, 'fire', '🪙        🪙        🪙        🪙 🐌🔥'],
  ['run', 0, 14, 'fire', '🪙        🪙        🪙        🪙🐌🔥'],
  ['run', 0, 22, 'fire', '🪙        🪙        🪙  🐌🔥'],
  ['run', 0, 30, 'fire', '🪙        🪙    🐌🔥'],
  ['run', 0, 36, 'fire', '🪙        🐌🔥'],
  ['run', 0, 37, 'fire', '🪙       🐌🔥'],
  ['run', 0, 38, 'fire', '🪙      🐌🔥'],
  ['run', 0, 39, 'fire', '🪙     🐌🔥'],
  ['run', 0, 77, 'fire', '🪙        🪙   🐌🔥'],
  ['run', 7, 0, 'fire', '🪙        🪙        🪙        🪙        🪙    🐘🔥'],
  ['run', 7, 1, 'fire', '🪙        🪙        🪙        🪙        🪙   🐘🔥'],
  ['run', 7, 5, 'fire', '🪙        🪙        🪙        🪙         🐘🔥'],
  ['run', 7, 6, 'fire', '🪙        🪙        🪙        🪙        🐘🔥'],
  ['run', 7, 7, 'fire', '🪙        🪙        🪙        🪙       🐘🔥'],
  ['run', 7, 13, 'fire', '🪙        🪙        🪙        🪙 🐘🔥'],
  ['run', 7, 14, 'fire', '🪙        🪙        🪙        🪙🐘🔥'],
  ['run', 7, 22, 'fire', '🪙        🪙        🪙  🐘🔥'],
  ['run', 7, 30, 'fire', '🪙        🪙    🐘🔥'],
  ['run', 7, 36, 'fire', '🪙        🐘🔥'],
  ['run', 7, 37, 'fire', '🪙       🐘🔥'],
  ['run', 7, 38, 'fire', '🪙      🐘🔥'],
  ['run', 7, 39, 'fire', '🪙     🐘🔥'],
  ['run', 7, 77, 'fire', '🪙        🪙   🐘🔥'],
  ['run', 16, 0, 'fire', '🪙        🪙        🪙        🪙        🪙    🦅🔥'],
  ['run', 16, 1, 'fire', '🪙        🪙        🪙        🪙        🪙   🦅🔥'],
  ['run', 16, 5, 'fire', '🪙        🪙        🪙        🪙         🦅🔥'],
  ['run', 16, 6, 'fire', '🪙        🪙        🪙        🪙        🦅🔥'],
  ['run', 16, 7, 'fire', '🪙        🪙        🪙        🪙       🦅🔥'],
  ['run', 16, 13, 'fire', '🪙        🪙        🪙        🪙 🦅🔥'],
  ['run', 16, 14, 'fire', '🪙        🪙        🪙        🪙🦅🔥'],
  ['run', 16, 22, 'fire', '🪙        🪙        🪙  🦅🔥'],
  ['run', 16, 30, 'fire', '🪙        🪙    🦅🔥'],
  ['run', 16, 36, 'fire', '🪙        🦅🔥'],
  ['run', 16, 37, 'fire', '🪙       🦅🔥'],
  ['run', 16, 38, 'fire', '🪙      🦅🔥'],
  ['run', 16, 39, 'fire', '🪙     🦅🔥'],
  ['run', 16, 77, 'fire', '🪙        🪙   🦅🔥'],
  ['halt', 0, 30, '', '🪙        🪙    🐌🔧'],
  ['halt', 0, 39, '', '🪙     🐌🔧'],
  ['halt', 7, 30, '', '🪙        🪙    🐘🔧'],
  ['halt', 7, 39, '', '🪙     🐘🔧'],
  ['halt', 16, 30, '', '🪙        🪙    🦅🔧'],
  ['halt', 16, 39, '', '🪙     🦅🔧'],
  ['vacant', 0, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🐌💤'],
  ['vacant', 0, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🐌💤'],
  ['vacant', 0, 5, 'gust', '🪙        🪙        🪙        🪙         🐌💤'],
  ['vacant', 0, 6, 'gust', '🪙        🪙        🪙        🪙        🐌💤'],
  ['vacant', 0, 7, 'gust', '🪙        🪙        🪙        🪙       🐌💤'],
  ['vacant', 0, 13, 'gust', '🪙        🪙        🪙        🪙 🐌💤'],
  ['vacant', 0, 14, 'gust', '🪙        🪙        🪙        🪙🐌💤'],
  ['vacant', 0, 22, 'gust', '🪙        🪙        🪙  🐌💤'],
  ['vacant', 0, 30, 'gust', '🪙        🪙    🐌💤'],
  ['vacant', 0, 36, 'gust', '🪙        🐌💤'],
  ['vacant', 0, 37, 'gust', '🪙       🐌💤'],
  ['vacant', 0, 38, 'gust', '🪙      🐌💤'],
  ['vacant', 0, 39, 'gust', '🪙     🐌💤'],
  ['vacant', 0, 77, 'gust', '🪙        🪙   🐌💤'],
  ['vacant', 7, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🐌💤'],
  ['vacant', 7, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🐌💤'],
  ['vacant', 7, 5, 'gust', '🪙        🪙        🪙        🪙         🐌💤'],
  ['vacant', 7, 6, 'gust', '🪙        🪙        🪙        🪙        🐌💤'],
  ['vacant', 7, 7, 'gust', '🪙        🪙        🪙        🪙       🐌💤'],
  ['vacant', 7, 13, 'gust', '🪙        🪙        🪙        🪙 🐌💤'],
  ['vacant', 7, 14, 'gust', '🪙        🪙        🪙        🪙🐌💤'],
  ['vacant', 7, 22, 'gust', '🪙        🪙        🪙  🐌💤'],
  ['vacant', 7, 30, 'gust', '🪙        🪙    🐌💤'],
  ['vacant', 7, 36, 'gust', '🪙        🐌💤'],
  ['vacant', 7, 37, 'gust', '🪙       🐌💤'],
  ['vacant', 7, 38, 'gust', '🪙      🐌💤'],
  ['vacant', 7, 39, 'gust', '🪙     🐌💤'],
  ['vacant', 7, 77, 'gust', '🪙        🪙   🐌💤'],
  ['vacant', 16, 0, 'gust', '🪙        🪙        🪙        🪙        🪙    🐌💤'],
  ['vacant', 16, 1, 'gust', '🪙        🪙        🪙        🪙        🪙   🐌💤'],
  ['vacant', 16, 5, 'gust', '🪙        🪙        🪙        🪙         🐌💤'],
  ['vacant', 16, 6, 'gust', '🪙        🪙        🪙        🪙        🐌💤'],
  ['vacant', 16, 7, 'gust', '🪙        🪙        🪙        🪙       🐌💤'],
  ['vacant', 16, 13, 'gust', '🪙        🪙        🪙        🪙 🐌💤'],
  ['vacant', 16, 14, 'gust', '🪙        🪙        🪙        🪙🐌💤'],
  ['vacant', 16, 22, 'gust', '🪙        🪙        🪙  🐌💤'],
  ['vacant', 16, 30, 'gust', '🪙        🪙    🐌💤'],
  ['vacant', 16, 36, 'gust', '🪙        🐌💤'],
  ['vacant', 16, 37, 'gust', '🪙       🐌💤'],
  ['vacant', 16, 38, 'gust', '🪙      🐌💤'],
  ['vacant', 16, 39, 'gust', '🪙     🐌💤'],
  ['vacant', 16, 77, 'gust', '🪙        🪙   🐌💤'],
  ['vacant', 0, 0, 'home', '🪙        🪙        🪙        🪙        🪙    🏠💤'],
  ['vacant', 0, 1, 'home', '🪙        🪙        🪙        🪙        🪙   🏠💤'],
  ['vacant', 0, 5, 'home', '🪙        🪙        🪙        🪙         🏠💤'],
  ['vacant', 0, 6, 'home', '🪙        🪙        🪙        🪙        🏠💤'],
  ['vacant', 0, 7, 'home', '🪙        🪙        🪙        🪙       🏠💤'],
  ['vacant', 0, 13, 'home', '🪙        🪙        🪙        🪙 🏠💤'],
  ['vacant', 0, 14, 'home', '🪙        🪙        🪙        🪙🏠💤'],
  ['vacant', 0, 22, 'home', '🪙        🪙        🪙  🏠💤'],
  ['vacant', 0, 30, 'home', '🪙        🪙    🏠💤'],
  ['vacant', 0, 36, 'home', '🪙        🏠💤'],
  ['vacant', 0, 37, 'home', '🪙       🏠💤'],
  ['vacant', 0, 38, 'home', '🪙      🏠💤'],
  ['vacant', 0, 39, 'home', '🪙     🏠💤'],
  ['vacant', 0, 77, 'home', '🪙        🪙   🏠💤'],
  ['vacant', 7, 0, 'home', '🪙        🪙        🪙        🪙        🪙    🏠💤'],
  ['vacant', 7, 1, 'home', '🪙        🪙        🪙        🪙        🪙   🏠💤'],
  ['vacant', 7, 5, 'home', '🪙        🪙        🪙        🪙         🏠💤'],
  ['vacant', 7, 6, 'home', '🪙        🪙        🪙        🪙        🏠💤'],
  ['vacant', 7, 7, 'home', '🪙        🪙        🪙        🪙       🏠💤'],
  ['vacant', 7, 13, 'home', '🪙        🪙        🪙        🪙 🏠💤'],
  ['vacant', 7, 14, 'home', '🪙        🪙        🪙        🪙🏠💤'],
  ['vacant', 7, 22, 'home', '🪙        🪙        🪙  🏠💤'],
  ['vacant', 7, 30, 'home', '🪙        🪙    🏠💤'],
  ['vacant', 7, 36, 'home', '🪙        🏠💤'],
  ['vacant', 7, 37, 'home', '🪙       🏠💤'],
  ['vacant', 7, 38, 'home', '🪙      🏠💤'],
  ['vacant', 7, 39, 'home', '🪙     🏠💤'],
  ['vacant', 7, 77, 'home', '🪙        🪙   🏠💤'],
  ['vacant', 16, 0, 'home', '🪙        🪙        🪙        🪙        🪙    🏠💤'],
  ['vacant', 16, 1, 'home', '🪙        🪙        🪙        🪙        🪙   🏠💤'],
  ['vacant', 16, 5, 'home', '🪙        🪙        🪙        🪙         🏠💤'],
  ['vacant', 16, 6, 'home', '🪙        🪙        🪙        🪙        🏠💤'],
  ['vacant', 16, 7, 'home', '🪙        🪙        🪙        🪙       🏠💤'],
  ['vacant', 16, 13, 'home', '🪙        🪙        🪙        🪙 🏠💤'],
  ['vacant', 16, 14, 'home', '🪙        🪙        🪙        🪙🏠💤'],
  ['vacant', 16, 22, 'home', '🪙        🪙        🪙  🏠💤'],
  ['vacant', 16, 30, 'home', '🪙        🪙    🏠💤'],
  ['vacant', 16, 36, 'home', '🪙        🏠💤'],
  ['vacant', 16, 37, 'home', '🪙       🏠💤'],
  ['vacant', 16, 38, 'home', '🪙      🏠💤'],
  ['vacant', 16, 39, 'home', '🪙     🏠💤'],
  ['vacant', 16, 77, 'home', '🪙        🪙   🏠💤'],
]

test('draws wind, fire, the wrench, zzz and the house as meter.py does', async () => {
  for (const [phase, level, dist, mark, line] of MARKED) {
    expect(render(phase, level, dist, mark)).toBe(line)
  }
  expect(render('vacant', 9, 13, 'home')).toContain('🏠💤')
  expect(render('vacant', 9, 13, 'home')).not.toContain(animal(0))
  expect(render('run', 7, 13, 'gust')).toContain('🐘💨')
  expect(render('run', 7, 13, 'fire')).toContain('🐘🔥')
  // Standing, it has its wrench as the animal it is: it is not asleep.
  expect(render('halt', 7, 13)).toContain('🐘🔧')
  expect(render('halt', 0, 13)).toContain('🐌🔧')
  expect(render('halt', 0, 13)).not.toContain('💤')
  expect(render('run', 7, 13)).not.toContain('🔧')
  expect(render('vacant', 7, 13)).not.toContain('🔧')
})

test('draws a poof in place of an animal that is changing', async () => {
  const before = render('run', 7, 13, 'gust')
  const during = render('run', 7, 13, 'gust', 48, true)
  expect(during).toContain('💥')
  expect(during).not.toContain('🐘')
  expect(during).not.toContain('💨')
  // The poof stands where the animal stood, and the coins stay.
  expect([...during].indexOf('💥')).toBe([...before].indexOf('🐘'))
  expect(during.replace('💥', '🐘')).toBe(render('run', 7, 13))
  expect(animalShown('vacant', 7)).toBe('🐌')
  expect(animalShown('halt', 7)).toBe('🐘')
})

test('poofs when the animal changes or wakes up, not when it falls asleep', async () => {
  expect(poofs(undefined, 'run', 7)).toBe(false)
  // Another animal while awake, whether it runs or stands.
  expect(poofs({ phase: 'run', level: 7, mark: '' }, 'run', 8)).toBe(true)
  expect(poofs({ phase: 'run', level: 7, mark: 'gust' }, 'halt', 6)).toBe(true)
  expect(poofs({ phase: 'run', level: 7, mark: '' }, 'halt', 7)).toBe(false)
  expect(poofs({ phase: 'halt', level: 7, mark: '' }, 'run', 7)).toBe(false)
  // A tool that runs on until the average is 0: the animal becomes a snail.
  expect(poofs({ phase: 'halt', level: 3, mark: '' }, 'halt', 0)).toBe(true)
  // Waking up, even as the snail it slept as, and coming out of the house.
  expect(poofs({ phase: 'vacant', level: 0, mark: '' }, 'run', 0)).toBe(true)
  expect(poofs({ phase: 'vacant', level: 9, mark: '' }, 'run', 9)).toBe(true)
  expect(poofs({ phase: 'vacant', level: 0, mark: 'home' }, 'run', 0)).toBe(true)
  // Falling asleep, going home, and whatever happens to the speed meanwhile.
  expect(poofs({ phase: 'run', level: 7, mark: '' }, 'vacant', 7)).toBe(false)
  expect(poofs({ phase: 'halt', level: 7, mark: '' }, 'vacant', 0)).toBe(false)
  expect(poofs({ phase: 'vacant', level: 7, mark: '' }, 'vacant', 3)).toBe(false)
  expect(poofs({ phase: 'vacant', level: 3, mark: '' }, 'vacant', 0, 'home')).toBe(false)
})

// The same again with what the animal has left, behind it on this lap and
// ahead of it on the lap before: generated from
// meter.render(..., stamps={0: 1.5, 10: 1.4, 20: 1.31, 30: 1.12, 40: 1.07}).
const STAMPS: ReadonlyMap<number, number> = new Map([[0, 1.5], [10, 1.4], [20, 1.31], [30, 1.12], [40, 1.07]])
const STAMPED: readonly (readonly [Phase, number, number, Mark, string])[] = [
  ['run', 7, 0, '', '💲1.50    💲1.40    💲1.31    💲1.12    🪙    🐘'],
  ['run', 7, 1, '', '💲1.50    💲1.40    💲1.31    🪙        🪙   🐘'],
  ['run', 7, 2, '', '💲1.50    💲1.40    💲1.31    🪙        🪙  🐘'],
  ['run', 7, 3, '', '💲1.50    💲1.40    💲1.31    🪙        🪙 🐘'],
  ['run', 7, 4, '', '💲1.50    💲1.40    💲1.31    🪙        🪙🐘'],
  ['run', 7, 5, '', '💲1.50    💲1.40    💲1.31    🪙         🐘'],
  ['run', 7, 6, '', '💲1.50    💲1.40    💲1.31    🪙        🐘'],
  ['run', 7, 7, '', '💲1.50    💲1.40    💲1.31    🪙       🐘'],
  ['run', 7, 8, '', '💲1.50    💲1.40    💲1.31    🪙      🐘💲1.07'],
  ['run', 7, 9, '', '💲1.50    💲1.40    💲1.31    🪙     🐘 💲1.07'],
  ['run', 7, 10, '', '💲1.50    💲1.40    💲1.31    🪙    🐘  💲1.07'],
  ['run', 7, 11, '', '💲1.50    💲1.40    🪙        🪙   🐘   💲1.07'],
  ['run', 7, 12, '', '💲1.50    💲1.40    🪙        🪙  🐘    💲1.07'],
  ['run', 7, 13, '', '💲1.50    💲1.40    🪙        🪙 🐘     💲1.07'],
  ['run', 7, 14, '', '💲1.50    💲1.40    🪙        🪙🐘      💲1.07'],
  ['run', 7, 15, '', '💲1.50    💲1.40    🪙         🐘       💲1.07'],
  ['run', 7, 16, '', '💲1.50    💲1.40    🪙        🐘        💲1.07'],
  ['run', 7, 17, '', '💲1.50    💲1.40    🪙       🐘         💲1.07'],
  ['run', 7, 18, '', '💲1.50    💲1.40    🪙      🐘💲1.12    💲1.07'],
  ['run', 7, 19, '', '💲1.50    💲1.40    🪙     🐘 💲1.12    💲1.07'],
  ['run', 7, 20, '', '💲1.50    💲1.40    🪙    🐘  💲1.12    💲1.07'],
  ['run', 7, 21, '', '💲1.50    🪙        🪙   🐘   💲1.12    💲1.07'],
  ['run', 7, 22, '', '💲1.50    🪙        🪙  🐘    💲1.12    💲1.07'],
  ['run', 7, 23, '', '💲1.50    🪙        🪙 🐘     💲1.12    💲1.07'],
  ['run', 7, 24, '', '💲1.50    🪙        🪙🐘      💲1.12    💲1.07'],
  ['run', 7, 25, '', '💲1.50    🪙         🐘       💲1.12    💲1.07'],
  ['run', 7, 26, '', '💲1.50    🪙        🐘        💲1.12    💲1.07'],
  ['run', 7, 27, '', '💲1.50    🪙       🐘         💲1.12    💲1.07'],
  ['run', 7, 28, '', '💲1.50    🪙      🐘💲1.31    💲1.12    💲1.07'],
  ['run', 7, 29, '', '💲1.50    🪙     🐘 💲1.31    💲1.12    💲1.07'],
  ['run', 7, 30, '', '💲1.50    🪙    🐘  💲1.31    💲1.12    💲1.07'],
  ['run', 7, 31, '', '🪙        🪙   🐘   💲1.31    💲1.12    💲1.07'],
  ['run', 7, 32, '', '🪙        🪙  🐘    💲1.31    💲1.12    💲1.07'],
  ['run', 7, 33, '', '🪙        🪙 🐘     💲1.31    💲1.12    💲1.07'],
  ['run', 7, 34, '', '🪙        🪙🐘      💲1.31    💲1.12    💲1.07'],
  ['run', 7, 35, '', '🪙         🐘       💲1.31    💲1.12    💲1.07'],
  ['run', 7, 36, '', '🪙        🐘        💲1.31    💲1.12    💲1.07'],
  ['run', 7, 37, '', '🪙       🐘         💲1.31    💲1.12    💲1.07'],
  ['run', 7, 38, '', '🪙      🐘💲1.40    💲1.31    💲1.12    💲1.07'],
  ['run', 13, 0, 'gust', '💲1.50    💲1.40    💲1.31    💲1.12    🪙    🐎💨'],
  ['run', 13, 1, 'gust', '💲1.50    💲1.40    💲1.31    🪙        🪙   🐎💨'],
  ['run', 13, 2, 'gust', '💲1.50    💲1.40    💲1.31    🪙        🪙  🐎💨'],
  ['run', 13, 3, 'gust', '💲1.50    💲1.40    💲1.31    🪙        🪙 🐎💨'],
  ['run', 13, 4, 'gust', '💲1.50    💲1.40    💲1.31    🪙        🪙🐎💨'],
  ['run', 13, 5, 'gust', '💲1.50    💲1.40    💲1.31    🪙         🐎💨'],
  ['run', 13, 6, 'gust', '💲1.50    💲1.40    💲1.31    🪙        🐎💨'],
  ['run', 13, 7, 'gust', '💲1.50    💲1.40    💲1.31    🪙       🐎💨'],
  ['run', 13, 8, 'gust', '💲1.50    💲1.40    💲1.31    🪙      🐎💨'],
  ['run', 13, 9, 'gust', '💲1.50    💲1.40    💲1.31    🪙     🐎💨'],
  ['run', 13, 10, 'gust', '💲1.50    💲1.40    💲1.31    🪙    🐎💨💲1.07'],
  ['run', 13, 11, 'gust', '💲1.50    💲1.40    🪙        🪙   🐎💨 💲1.07'],
  ['run', 13, 12, 'gust', '💲1.50    💲1.40    🪙        🪙  🐎💨  💲1.07'],
  ['run', 13, 13, 'gust', '💲1.50    💲1.40    🪙        🪙 🐎💨   💲1.07'],
  ['run', 13, 14, 'gust', '💲1.50    💲1.40    🪙        🪙🐎💨    💲1.07'],
  ['run', 13, 15, 'gust', '💲1.50    💲1.40    🪙         🐎💨     💲1.07'],
  ['run', 13, 16, 'gust', '💲1.50    💲1.40    🪙        🐎💨      💲1.07'],
  ['run', 13, 17, 'gust', '💲1.50    💲1.40    🪙       🐎💨       💲1.07'],
  ['run', 13, 18, 'gust', '💲1.50    💲1.40    🪙      🐎💨        💲1.07'],
  ['run', 13, 19, 'gust', '💲1.50    💲1.40    🪙     🐎💨         💲1.07'],
  ['run', 13, 20, 'gust', '💲1.50    💲1.40    🪙    🐎💨💲1.12    💲1.07'],
  ['run', 13, 21, 'gust', '💲1.50    🪙        🪙   🐎💨 💲1.12    💲1.07'],
  ['run', 13, 22, 'gust', '💲1.50    🪙        🪙  🐎💨  💲1.12    💲1.07'],
  ['run', 13, 23, 'gust', '💲1.50    🪙        🪙 🐎💨   💲1.12    💲1.07'],
  ['run', 13, 24, 'gust', '💲1.50    🪙        🪙🐎💨    💲1.12    💲1.07'],
  ['run', 13, 25, 'gust', '💲1.50    🪙         🐎💨     💲1.12    💲1.07'],
  ['run', 13, 26, 'gust', '💲1.50    🪙        🐎💨      💲1.12    💲1.07'],
  ['run', 13, 27, 'gust', '💲1.50    🪙       🐎💨       💲1.12    💲1.07'],
  ['run', 13, 28, 'gust', '💲1.50    🪙      🐎💨        💲1.12    💲1.07'],
  ['run', 13, 29, 'gust', '💲1.50    🪙     🐎💨         💲1.12    💲1.07'],
  ['run', 13, 30, 'gust', '💲1.50    🪙    🐎💨💲1.31    💲1.12    💲1.07'],
  ['run', 13, 31, 'gust', '🪙        🪙   🐎💨 💲1.31    💲1.12    💲1.07'],
  ['run', 13, 32, 'gust', '🪙        🪙  🐎💨  💲1.31    💲1.12    💲1.07'],
  ['run', 13, 33, 'gust', '🪙        🪙 🐎💨   💲1.31    💲1.12    💲1.07'],
  ['run', 13, 34, 'gust', '🪙        🪙🐎💨    💲1.31    💲1.12    💲1.07'],
  ['run', 13, 35, 'gust', '🪙         🐎💨     💲1.31    💲1.12    💲1.07'],
  ['run', 13, 36, 'gust', '🪙        🐎💨      💲1.31    💲1.12    💲1.07'],
  ['run', 13, 37, 'gust', '🪙       🐎💨       💲1.31    💲1.12    💲1.07'],
  ['run', 13, 38, 'gust', '🪙      🐎💨        💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 0, '', '💲1.50    💲1.40    💲1.31    💲1.12    🪙    🐘🔧'],
  ['halt', 7, 1, '', '💲1.50    💲1.40    💲1.31    🪙        🪙   🐘🔧'],
  ['halt', 7, 2, '', '💲1.50    💲1.40    💲1.31    🪙        🪙  🐘🔧'],
  ['halt', 7, 3, '', '💲1.50    💲1.40    💲1.31    🪙        🪙 🐘🔧'],
  ['halt', 7, 4, '', '💲1.50    💲1.40    💲1.31    🪙        🪙🐘🔧'],
  ['halt', 7, 5, '', '💲1.50    💲1.40    💲1.31    🪙         🐘🔧'],
  ['halt', 7, 6, '', '💲1.50    💲1.40    💲1.31    🪙        🐘🔧'],
  ['halt', 7, 7, '', '💲1.50    💲1.40    💲1.31    🪙       🐘🔧'],
  ['halt', 7, 8, '', '💲1.50    💲1.40    💲1.31    🪙      🐘🔧'],
  ['halt', 7, 9, '', '💲1.50    💲1.40    💲1.31    🪙     🐘🔧'],
  ['halt', 7, 10, '', '💲1.50    💲1.40    💲1.31    🪙    🐘🔧💲1.07'],
  ['halt', 7, 11, '', '💲1.50    💲1.40    🪙        🪙   🐘🔧 💲1.07'],
  ['halt', 7, 12, '', '💲1.50    💲1.40    🪙        🪙  🐘🔧  💲1.07'],
  ['halt', 7, 13, '', '💲1.50    💲1.40    🪙        🪙 🐘🔧   💲1.07'],
  ['halt', 7, 14, '', '💲1.50    💲1.40    🪙        🪙🐘🔧    💲1.07'],
  ['halt', 7, 15, '', '💲1.50    💲1.40    🪙         🐘🔧     💲1.07'],
  ['halt', 7, 16, '', '💲1.50    💲1.40    🪙        🐘🔧      💲1.07'],
  ['halt', 7, 17, '', '💲1.50    💲1.40    🪙       🐘🔧       💲1.07'],
  ['halt', 7, 18, '', '💲1.50    💲1.40    🪙      🐘🔧        💲1.07'],
  ['halt', 7, 19, '', '💲1.50    💲1.40    🪙     🐘🔧         💲1.07'],
  ['halt', 7, 20, '', '💲1.50    💲1.40    🪙    🐘🔧💲1.12    💲1.07'],
  ['halt', 7, 21, '', '💲1.50    🪙        🪙   🐘🔧 💲1.12    💲1.07'],
  ['halt', 7, 22, '', '💲1.50    🪙        🪙  🐘🔧  💲1.12    💲1.07'],
  ['halt', 7, 23, '', '💲1.50    🪙        🪙 🐘🔧   💲1.12    💲1.07'],
  ['halt', 7, 24, '', '💲1.50    🪙        🪙🐘🔧    💲1.12    💲1.07'],
  ['halt', 7, 25, '', '💲1.50    🪙         🐘🔧     💲1.12    💲1.07'],
  ['halt', 7, 26, '', '💲1.50    🪙        🐘🔧      💲1.12    💲1.07'],
  ['halt', 7, 27, '', '💲1.50    🪙       🐘🔧       💲1.12    💲1.07'],
  ['halt', 7, 28, '', '💲1.50    🪙      🐘🔧        💲1.12    💲1.07'],
  ['halt', 7, 29, '', '💲1.50    🪙     🐘🔧         💲1.12    💲1.07'],
  ['halt', 7, 30, '', '💲1.50    🪙    🐘🔧💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 31, '', '🪙        🪙   🐘🔧 💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 32, '', '🪙        🪙  🐘🔧  💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 33, '', '🪙        🪙 🐘🔧   💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 34, '', '🪙        🪙🐘🔧    💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 35, '', '🪙         🐘🔧     💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 36, '', '🪙        🐘🔧      💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 37, '', '🪙       🐘🔧       💲1.31    💲1.12    💲1.07'],
  ['halt', 7, 38, '', '🪙      🐘🔧        💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 0, '', '💲1.50    💲1.40    💲1.31    💲1.12    🪙    🐌💤'],
  ['vacant', 7, 1, '', '💲1.50    💲1.40    💲1.31    🪙        🪙   🐌💤'],
  ['vacant', 7, 2, '', '💲1.50    💲1.40    💲1.31    🪙        🪙  🐌💤'],
  ['vacant', 7, 3, '', '💲1.50    💲1.40    💲1.31    🪙        🪙 🐌💤'],
  ['vacant', 7, 4, '', '💲1.50    💲1.40    💲1.31    🪙        🪙🐌💤'],
  ['vacant', 7, 5, '', '💲1.50    💲1.40    💲1.31    🪙         🐌💤'],
  ['vacant', 7, 6, '', '💲1.50    💲1.40    💲1.31    🪙        🐌💤'],
  ['vacant', 7, 7, '', '💲1.50    💲1.40    💲1.31    🪙       🐌💤'],
  ['vacant', 7, 8, '', '💲1.50    💲1.40    💲1.31    🪙      🐌💤'],
  ['vacant', 7, 9, '', '💲1.50    💲1.40    💲1.31    🪙     🐌💤'],
  ['vacant', 7, 10, '', '💲1.50    💲1.40    💲1.31    🪙    🐌💤💲1.07'],
  ['vacant', 7, 11, '', '💲1.50    💲1.40    🪙        🪙   🐌💤 💲1.07'],
  ['vacant', 7, 12, '', '💲1.50    💲1.40    🪙        🪙  🐌💤  💲1.07'],
  ['vacant', 7, 13, '', '💲1.50    💲1.40    🪙        🪙 🐌💤   💲1.07'],
  ['vacant', 7, 14, '', '💲1.50    💲1.40    🪙        🪙🐌💤    💲1.07'],
  ['vacant', 7, 15, '', '💲1.50    💲1.40    🪙         🐌💤     💲1.07'],
  ['vacant', 7, 16, '', '💲1.50    💲1.40    🪙        🐌💤      💲1.07'],
  ['vacant', 7, 17, '', '💲1.50    💲1.40    🪙       🐌💤       💲1.07'],
  ['vacant', 7, 18, '', '💲1.50    💲1.40    🪙      🐌💤        💲1.07'],
  ['vacant', 7, 19, '', '💲1.50    💲1.40    🪙     🐌💤         💲1.07'],
  ['vacant', 7, 20, '', '💲1.50    💲1.40    🪙    🐌💤💲1.12    💲1.07'],
  ['vacant', 7, 21, '', '💲1.50    🪙        🪙   🐌💤 💲1.12    💲1.07'],
  ['vacant', 7, 22, '', '💲1.50    🪙        🪙  🐌💤  💲1.12    💲1.07'],
  ['vacant', 7, 23, '', '💲1.50    🪙        🪙 🐌💤   💲1.12    💲1.07'],
  ['vacant', 7, 24, '', '💲1.50    🪙        🪙🐌💤    💲1.12    💲1.07'],
  ['vacant', 7, 25, '', '💲1.50    🪙         🐌💤     💲1.12    💲1.07'],
  ['vacant', 7, 26, '', '💲1.50    🪙        🐌💤      💲1.12    💲1.07'],
  ['vacant', 7, 27, '', '💲1.50    🪙       🐌💤       💲1.12    💲1.07'],
  ['vacant', 7, 28, '', '💲1.50    🪙      🐌💤        💲1.12    💲1.07'],
  ['vacant', 7, 29, '', '💲1.50    🪙     🐌💤         💲1.12    💲1.07'],
  ['vacant', 7, 30, '', '💲1.50    🪙    🐌💤💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 31, '', '🪙        🪙   🐌💤 💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 32, '', '🪙        🪙  🐌💤  💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 33, '', '🪙        🪙 🐌💤   💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 34, '', '🪙        🪙🐌💤    💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 35, '', '🪙         🐌💤     💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 36, '', '🪙        🐌💤      💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 37, '', '🪙       🐌💤       💲1.31    💲1.12    💲1.07'],
  ['vacant', 7, 38, '', '🪙      🐌💤        💲1.31    💲1.12    💲1.07'],
]

// What meter.fare() makes of a cost.
const FARES: readonly (readonly [number, string])[] = [[0, ''], [0.004, ''], [0.0049, ''], [0.005, '0.01'], [0.006, '0.01'], [0.05, '0.05'], [0.1, '0.10'], [0.125, '0.13'], [0.995, '1.00'], [1, '1.00'], [1.005, '1.00'], [1.239, '1.24'], [2.675, '2.68'], [9.999, '10.00'], [12.3, '12.30'], [12.345, '12.35'], [99.99, '99.99'], [99.994, '99.99'], [99.995, '100.0'], [99.999, '100.0'], [100, '100.0'], [123.44, '123.4'], [123.45, '123.5'], [999.94, '999.9'], [999.95, '1000'], [999.96, '1000'], [1000, '1000'], [1234.4, '1234'], [1234.5, '1235'], [99999.4, '99999'], [99999.5, '100000'], [100000, '100000'], [1234567.8, '1234568']]

// A lap and the start of the next, a column at a time, the cost 1 + dist / 100:
// what meter.render() draws with the stamps meter.stamped() has made by then.
const WALKED: readonly (readonly [number, string])[] = [
  [5, '🪙        🪙        🪙        🪙         🐘'],
  [6, '🪙        🪙        🪙        🪙        🐘'],
  [8, '🪙        🪙        🪙        🪙      🐘💲0.05'],
  [16, '🪙        🪙        🪙        🐘        💲0.05'],
  [18, '🪙        🪙        🪙      🐘💲0.10    💲0.05'],
  [36, '🪙        🐘        💲0.10    💲0.10    💲0.05'],
  [38, '🪙      🐘💲0.10    💲0.10    💲0.10    💲0.05'],
  [44, '🪙🐘      💲0.10    💲0.10    💲0.10    💲0.05'],
  [45, '🐘        💲0.10    💲0.10    💲0.10    💲0.05'],
  [46, '💲0.09    💲0.10    💲0.10    💲0.10    🪙    🐘'],
  [51, '💲0.09    💲0.10    💲0.10    🪙         🐘'],
  [52, '💲0.09    💲0.10    💲0.10    🪙        🐘'],
  [54, '💲0.09    💲0.10    💲0.10    🪙      🐘💲0.07'],
]

// The same with a cost of dist / 2500: a twenty-fifth of a cent a column.
const CREPT: readonly (readonly [number, string])[] = [
  [8, '🪙        🪙        🪙        🪙      🐘🐾'],
  [18, '🪙        🪙        🪙      🐘💲0.01    🐾'],
  [28, '🪙        🪙      🐘🐾        💲0.01    🐾'],
  [38, '🪙      🐘💲0.01    🐾        💲0.01    🐾'],
  [45, '🐘        💲0.01    🐾        💲0.01    🐾'],
]

test('writes a cost as meter.py does', async () => {
  for (const [usd, text] of FARES) {
    expect(fare(usd)).toBe(text)
  }
})

test('draws the fare behind a dollar sign as meter.py does', async () => {
  for (const [phase, level, dist, mark, line] of STAMPED) {
    expect(render(phase, level, dist, mark, 48, false, STAMPS)).toBe(line)
  }
  // A fare that does not fit is left out with its dollar sign. An amount
  // under half a cent leaves paw prints. An eaten coin without a stamp leaves
  // nothing.
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 100000], [30, 99999]]))).toBe('🪙        🪙   🐘             💲99999')
  expect(render('run', 7, 31, '', 48, false, new Map([[30, 0.75]]))).toBe('🪙        🪙   🐘             💲0.75')
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 0], [30, 0.004], [20, 0.05]]))).toBe('🪙        🪙   🐘   💲0.05    🐾        🐾')
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 0]]))).toBe('🪙        🪙   🐘                       🐾')
  expect(render('run', 7, 31)).toBe('🪙        🪙   🐘')
  // A track of 15 columns has three columns behind its last coin, at column 10.
  expect(render('run', 7, 9, '', 15, false, new Map([[10, 0.05]]))).toBe('🪙  🐘')
  expect(render('run', 7, 9, '', 15, false, new Map([[10, 0]]))).toBe('🪙  🐘    🐾')
  expect(render('run', 7, 9, '', 16, false, new Map([[10, 0.05]]))).toBe('🪙   🐘   💲0.05')
  for (let dist = 0; dist < 100; dist += 1) {
    const eaten = [10, 20, 30, 40].filter(c => c >= animalColumn(dist))
    for (const mark of ['', 'gust'] as const) {
      const paid = render('run', 7, dist, mark, 48, false, new Map(eaten.map(c => [c, 0.05])))
      const cents = render('run', 7, dist, mark, 48, false, new Map(eaten.map(c => [c, 0])))
      // The paw prints give way to the animal and its wind, as a dollar sign does.
      expect(cents).toBe(paid.replaceAll('💲0.05', '🐾    ').trimEnd())
      // Blank the fares out and the picture is the one without stamps.
      expect(paid.replaceAll('💲0.05', '      ').trimEnd()).toBe(render('run', 7, dist, mark))
    }
  }
  // The fares stay while the animal changes.
  expect(render('run', 7, 31, '', 48, true, STAMPS)).toBe(render('run', 7, 31, '', 48, false, STAMPS).replace('🐘', '💥'))
})

// What a lap has left, and the line at each distance from its end to the end
// of the next lap, on which nothing new is left: generated from meter.render().
const LEFT: ReadonlyMap<number, number> = new Map([[40, 0.05], [30, 0.002], [20, 0.19], [10, 1.2], [0, 0.03]])
const NEXT_LAP: readonly (readonly [number, string])[] = [
  [45, '🐘        💲1.20    💲0.19    🐾        💲0.05'],
  [46, '💲0.03    💲1.20    💲0.19    🐾        🪙    🐘'],
  [47, '💲0.03    💲1.20    💲0.19    🪙        🪙   🐘'],
  [48, '💲0.03    💲1.20    💲0.19    🪙        🪙  🐘'],
  [49, '💲0.03    💲1.20    💲0.19    🪙        🪙 🐘'],
  [50, '💲0.03    💲1.20    💲0.19    🪙        🪙🐘'],
  [51, '💲0.03    💲1.20    💲0.19    🪙         🐘'],
  [52, '💲0.03    💲1.20    💲0.19    🪙        🐘'],
  [53, '💲0.03    💲1.20    💲0.19    🪙       🐘'],
  [54, '💲0.03    💲1.20    💲0.19    🪙      🐘'],
  [55, '💲0.03    💲1.20    💲0.19    🪙     🐘'],
  [56, '💲0.03    💲1.20    💲0.19    🪙    🐘'],
  [57, '💲0.03    💲1.20    🪙        🪙   🐘'],
  [58, '💲0.03    💲1.20    🪙        🪙  🐘'],
  [59, '💲0.03    💲1.20    🪙        🪙 🐘'],
  [60, '💲0.03    💲1.20    🪙        🪙🐘'],
  [61, '💲0.03    💲1.20    🪙         🐘'],
  [62, '💲0.03    💲1.20    🪙        🐘'],
  [63, '💲0.03    💲1.20    🪙       🐘'],
  [64, '💲0.03    💲1.20    🪙      🐘'],
  [65, '💲0.03    💲1.20    🪙     🐘'],
  [66, '💲0.03    💲1.20    🪙    🐘'],
  [67, '💲0.03    🪙        🪙   🐘'],
  [68, '💲0.03    🪙        🪙  🐘'],
  [69, '💲0.03    🪙        🪙 🐘'],
  [70, '💲0.03    🪙        🪙🐘'],
  [71, '💲0.03    🪙         🐘'],
  [72, '💲0.03    🪙        🐘'],
  [73, '💲0.03    🪙       🐘'],
  [74, '💲0.03    🪙      🐘'],
  [75, '💲0.03    🪙     🐘'],
  [76, '💲0.03    🪙    🐘'],
  [77, '🪙        🪙   🐘'],
  [78, '🪙        🪙  🐘'],
  [79, '🪙        🪙 🐘'],
  [80, '🪙        🪙🐘'],
  [81, '🪙         🐘'],
  [82, '🪙        🐘'],
  [83, '🪙       🐘'],
  [84, '🪙      🐘'],
  [85, '🪙     🐘'],
  [86, '🪙    🐘'],
  [87, '🪙   🐘'],
  [88, '🪙  🐘'],
  [89, '🪙 🐘'],
  [90, '🪙🐘'],
  [91, '🐘'],
]

test('turns the lap before back into coins one coin at a time, as meter.py does', async () => {
  for (const [dist, line] of NEXT_LAP) {
    const x = animalColumn(dist)
    // On the next lap the stamp of a coin goes when the animal reaches it.
    const stamps = dist === 45 ? LEFT : new Map([...LEFT].filter(([c]) => c < x))
    expect(render('run', 7, dist, '', 48, false, stamps)).toBe(line)
  }
  // The lap starts: only the coin ahead of the animal is back.
  expect(render('run', 7, 45, '', 48, false, LEFT)).toBe('🐘        💲1.20    💲0.19    🐾        💲0.05')
  expect(render('run', 7, 46, '', 48, false, LEFT)).toBe('💲0.03    💲1.20    💲0.19    🐾        🪙    🐘')
  // Each of the others comes back when the animal is a coin and a half away:
  // halfway between two coins, so not as it eats one.
  for (const [mark, dist] of [['🐾', 47], ['💲0.19', 57], ['💲1.20', 67], ['💲0.03', 77]] as const) {
    expect(animalColumn(dist) % 10).toBe(5)
    expect(render('run', 7, dist - 1, '', 48, false, LEFT)).toContain(mark)
    expect(render('run', 7, dist, '', 48, false, LEFT)).not.toContain(mark)
  }
})

// Runs the animal a column at a time and keeps what is drawn at each distance.
function walk(cost: (dist: number) => number | undefined, upTo: number): { fares: Fares; drawn: Map<number, string> } {
  let fares: Fares = { stamps: new Map(), billed: undefined }
  const drawn = new Map<number, string>()
  for (let dist = 1; dist <= upTo; dist += 1) {
    fares = stamped(fares, animalColumn(dist - 1), animalColumn(dist), cost(dist))
    drawn.set(dist, render('run', 7, dist, '', 48, false, fares.stamps))
  }

  return { fares, drawn }
}

test('stamps a coin with what was spent since the fare before it, as meter.py does', async () => {
  const fast = walk(dist => 1 + dist / 100, 54)
  for (const [dist, line] of WALKED) {
    expect(fast.drawn.get(dist)).toBe(line)
  }
  expect(fast.fares.billed).toBe(1 + 52 / 100)
  // An amount under half a cent leaves paw prints and goes into the next fare.
  const slow = walk(dist => dist / 2500, 45)
  for (const [dist, line] of CREPT) {
    expect(slow.drawn.get(dist)).toBe(line)
  }
  expect(slow.fares.billed).toBe(36 / 2500)
  // No cost, no fare.
  const blind = walk(() => undefined, 45)
  expect(blind.fares.stamps.size).toBe(0)
  expect(blind.fares.billed).toBeUndefined()
  expect(blind.drawn.get(45)).toBe(render('run', 7, 45))
})

test('stamps a coin once, and only when the animal reaches it', async () => {
  const first = stamped({ stamps: new Map(), billed: 1 }, 41, 40, 1.5)
  expect([...first.stamps]).toEqual([[40, 0.5]])
  expect(first.billed).toBe(1.5)
  // Past that coin, and short of the next.
  for (const [before, x] of [[40, 39], [38, 36]] as const) {
    const on = stamped(first, before, x, 9)
    expect([...on.stamps]).toEqual([[40, 0.5]])
    expect(on.billed).toBe(1.5)
  }
  // The next coin has what was spent since, not the cost so far.
  const next = stamped(first, 31, 30, 2)
  expect([...next.stamps]).toEqual([[40, 0.5], [30, 0.5]])
  expect(next.billed).toBe(2)
  // The left end is stamped as the others: what it leaves shows on the next lap.
  const end = stamped(first, 2, 0, 3)
  expect([...end.stamps]).toEqual([[40, 0.5], [0, 1.5]])
  expect(end.billed).toBe(3)
  // The fares count from the first reading: nothing spent since.
  const start = stamped({ stamps: new Map(), billed: undefined }, 41, 40, 7)
  expect([...start.stamps]).toEqual([[40, 0]])
  expect(start.billed).toBe(7)
  expect(stamped({ stamps: new Map(), billed: undefined }, 38, 37, 7).stamps.size).toBe(0)
  // While the cost is not known, nothing is stamped.
  const unknown = stamped(first, 31, 30, undefined)
  expect([...unknown.stamps]).toEqual([[40, 0.5]])
  expect(unknown.billed).toBe(1.5)
  // A cost that has started over is counted from there: no fare below zero.
  const over = stamped(first, 31, 30, 0.2)
  expect([...over.stamps]).toEqual([[40, 0.5], [30, 0]])
  expect(over.billed).toBe(0.2)
  // A fare that does not fit is not billed. A track of 15 columns has three
  // columns behind its last coin, at column 10.
  const short = stamped({ stamps: new Map(), billed: 1 }, 11, 10, 1.05, 15)
  expect(short.stamps.size).toBe(0)
  expect(short.billed).toBe(1)
  const wide = stamped({ stamps: new Map(), billed: 1 }, 11, 10, 1.05, 16)
  expect(fareAt(wide.stamps.get(10) ?? 0, 10, 16)).toBe('0.05')
  expect(wide.billed).toBe(1.05)
  expect(fareAt(0.05, 10, 15)).toBe('')
  expect(fareAt(0.004, 40)).toBe('')
  expect(fareAt(100000, 40)).toBe('')
  expect(fareAt(99999, 40)).toBe('99999')
})

test('drops the stamp of the lap before when the animal reaches its coin again', async () => {
  const old: Fares = { stamps: new Map([[40, 0.5], [30, 0.5]]), billed: 2 }
  const sorted = (fares: Fares): [number, number][] => [...fares.stamps].sort((a, b) => b[0] - a[0])
  // A new lap keeps what the last one left, until the animal is there.
  for (const [before, x] of [[0, 46], [42, 41]] as const) {
    const kept = stamped(old, before, x, 4)
    expect(sorted(kept)).toEqual([[40, 0.5], [30, 0.5]])
    expect(kept.billed).toBe(2)
  }
  // A fare takes its place, or paw prints, or nothing: the cost is not known,
  // or the fare does not fit.
  const paid = stamped(old, 41, 40, 2.25)
  expect(sorted(paid)).toEqual([[40, 0.25], [30, 0.5]])
  expect(paid.billed).toBe(2.25)
  const prints = stamped(old, 41, 40, 2)
  expect(sorted(prints)).toEqual([[40, 0], [30, 0.5]])
  expect(prints.billed).toBe(2)
  for (const usd of [undefined, 100002]) {
    const gone = stamped(old, 41, 40, usd)
    expect(sorted(gone)).toEqual([[30, 0.5]])
    expect(gone.billed).toBe(2)
  }
  // The stamps handed in are left alone.
  expect(sorted(old)).toEqual([[40, 0.5], [30, 0.5]])
})

test('blinks the wrench and every zzz and leaves their place empty meanwhile', async () => {
  // A second there, a second gone.
  expect([0, 999, 1000, 1999, 2000].map(blinkShows)).toEqual([true, true, false, false, true])
  for (let dist = 0; dist < 100; dist += 1) {
    for (const [phase, mark, glyph] of [['vacant', '', '💤'], ['vacant', 'home', '💤'], ['halt', '', '🔧']] as const) {
      const there = render(phase, 7, dist, mark, 48, false, STAMPS)
      expect(there).toContain(glyph)
      // Nothing else moves, and what it hides does not come back.
      expect(render(phase, 7, dist, mark, 48, false, STAMPS, false)).toBe(there.replace(glyph, '  ').trimEnd())
    }
    // The wind and the fire of a running animal stay.
    for (const [phase, mark] of [['run', ''], ['run', 'gust'], ['run', 'fire']] as const) {
      const there = render(phase, 7, dist, mark, 48, false, STAMPS)
      expect(render(phase, 7, dist, mark, 48, false, STAMPS, false)).toBe(there)
    }
  }
  // As meter.py draws it, with blink=False.
  expect(render('vacant', 7, 11, '', 48, false, new Map(), false)).toBe('🪙        🪙        🪙        🪙   🐌')
  expect(render('halt', 7, 11, '', 48, false, new Map(), false)).toBe('🪙        🪙        🪙        🪙   🐘')
  expect(render('vacant', 7, 11, 'home', 48, false, new Map(), false)).toBe('🪙        🪙        🪙        🪙   🏠')
})
