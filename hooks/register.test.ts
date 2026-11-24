import { expect, test } from 'claude-code/testing'

import { animal, animalColumn, animalShown, findPython, lastLine, parseLive, parseProbe, poofs, render } from './register'
import type { Mark, Phase, Run } from './register'

// What meter.py draws for the same state, level and distance: generated from
// meter.render() and meter.animal_column(). The two must stay the same picture.
const LINES: readonly (readonly [Phase, number, number, string])[] = [
 [
  'run',
  0,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌'
 ],
 [
  'run',
  0,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌'
 ],
 [
  'run',
  0,
  5,
  '🪙      🪙      🪙      🪙       🐌'
 ],
 [
  'run',
  0,
  6,
  '🪙      🪙      🪙      🪙      🐌'
 ],
 [
  'run',
  0,
  7,
  '🪙      🪙      🪙      🪙     🐌'
 ],
 [
  'run',
  0,
  8,
  '🪙      🪙      🪙      🪙    🐌💲'
 ],
 [
  'run',
  0,
  13,
  '🪙      🪙      🪙       🐌     💲'
 ],
 [
  'run',
  0,
  14,
  '🪙      🪙      🪙      🐌      💲'
 ],
 [
  'run',
  0,
  15,
  '🪙      🪙      🪙     🐌       💲'
 ],
 [
  'run',
  0,
  22,
  '🪙      🪙      🐌      💲      💲'
 ],
 [
  'run',
  0,
  23,
  '🪙      🪙     🐌       💲      💲'
 ],
 [
  'run',
  0,
  29,
  '🪙       🐌     💲      💲      💲'
 ],
 [
  'run',
  0,
  36,
  '🪙🐌    💲      💲      💲      💲'
 ],
 [
  'run',
  0,
  37,
  '🐌      💲      💲      💲      💲'
 ],
 [
  'run',
  0,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌'
 ],
 [
  'run',
  0,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌'
 ],
 [
  'run',
  3,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐁'
 ],
 [
  'run',
  3,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐁'
 ],
 [
  'run',
  3,
  5,
  '🪙      🪙      🪙      🪙       🐁'
 ],
 [
  'run',
  3,
  6,
  '🪙      🪙      🪙      🪙      🐁'
 ],
 [
  'run',
  3,
  7,
  '🪙      🪙      🪙      🪙     🐁'
 ],
 [
  'run',
  3,
  8,
  '🪙      🪙      🪙      🪙    🐁💲'
 ],
 [
  'run',
  3,
  13,
  '🪙      🪙      🪙       🐁     💲'
 ],
 [
  'run',
  3,
  14,
  '🪙      🪙      🪙      🐁      💲'
 ],
 [
  'run',
  3,
  15,
  '🪙      🪙      🪙     🐁       💲'
 ],
 [
  'run',
  3,
  22,
  '🪙      🪙      🐁      💲      💲'
 ],
 [
  'run',
  3,
  23,
  '🪙      🪙     🐁       💲      💲'
 ],
 [
  'run',
  3,
  29,
  '🪙       🐁     💲      💲      💲'
 ],
 [
  'run',
  3,
  36,
  '🪙🐁    💲      💲      💲      💲'
 ],
 [
  'run',
  3,
  37,
  '🐁      💲      💲      💲      💲'
 ],
 [
  'run',
  3,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐁'
 ],
 [
  'run',
  3,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐁'
 ],
 [
  'run',
  7,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐘'
 ],
 [
  'run',
  7,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐘'
 ],
 [
  'run',
  7,
  5,
  '🪙      🪙      🪙      🪙       🐘'
 ],
 [
  'run',
  7,
  6,
  '🪙      🪙      🪙      🪙      🐘'
 ],
 [
  'run',
  7,
  7,
  '🪙      🪙      🪙      🪙     🐘'
 ],
 [
  'run',
  7,
  8,
  '🪙      🪙      🪙      🪙    🐘💲'
 ],
 [
  'run',
  7,
  13,
  '🪙      🪙      🪙       🐘     💲'
 ],
 [
  'run',
  7,
  14,
  '🪙      🪙      🪙      🐘      💲'
 ],
 [
  'run',
  7,
  15,
  '🪙      🪙      🪙     🐘       💲'
 ],
 [
  'run',
  7,
  22,
  '🪙      🪙      🐘      💲      💲'
 ],
 [
  'run',
  7,
  23,
  '🪙      🪙     🐘       💲      💲'
 ],
 [
  'run',
  7,
  29,
  '🪙       🐘     💲      💲      💲'
 ],
 [
  'run',
  7,
  36,
  '🪙🐘    💲      💲      💲      💲'
 ],
 [
  'run',
  7,
  37,
  '🐘      💲      💲      💲      💲'
 ],
 [
  'run',
  7,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐘'
 ],
 [
  'run',
  7,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐘'
 ],
 [
  'run',
  12,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦌'
 ],
 [
  'run',
  12,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦌'
 ],
 [
  'run',
  12,
  5,
  '🪙      🪙      🪙      🪙       🦌'
 ],
 [
  'run',
  12,
  6,
  '🪙      🪙      🪙      🪙      🦌'
 ],
 [
  'run',
  12,
  7,
  '🪙      🪙      🪙      🪙     🦌'
 ],
 [
  'run',
  12,
  8,
  '🪙      🪙      🪙      🪙    🦌💲'
 ],
 [
  'run',
  12,
  13,
  '🪙      🪙      🪙       🦌     💲'
 ],
 [
  'run',
  12,
  14,
  '🪙      🪙      🪙      🦌      💲'
 ],
 [
  'run',
  12,
  15,
  '🪙      🪙      🪙     🦌       💲'
 ],
 [
  'run',
  12,
  22,
  '🪙      🪙      🦌      💲      💲'
 ],
 [
  'run',
  12,
  23,
  '🪙      🪙     🦌       💲      💲'
 ],
 [
  'run',
  12,
  29,
  '🪙       🦌     💲      💲      💲'
 ],
 [
  'run',
  12,
  36,
  '🪙🦌    💲      💲      💲      💲'
 ],
 [
  'run',
  12,
  37,
  '🦌      💲      💲      💲      💲'
 ],
 [
  'run',
  12,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦌'
 ],
 [
  'run',
  12,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦌'
 ],
 [
  'run',
  16,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦅'
 ],
 [
  'run',
  16,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦅'
 ],
 [
  'run',
  16,
  5,
  '🪙      🪙      🪙      🪙       🦅'
 ],
 [
  'run',
  16,
  6,
  '🪙      🪙      🪙      🪙      🦅'
 ],
 [
  'run',
  16,
  7,
  '🪙      🪙      🪙      🪙     🦅'
 ],
 [
  'run',
  16,
  8,
  '🪙      🪙      🪙      🪙    🦅💲'
 ],
 [
  'run',
  16,
  13,
  '🪙      🪙      🪙       🦅     💲'
 ],
 [
  'run',
  16,
  14,
  '🪙      🪙      🪙      🦅      💲'
 ],
 [
  'run',
  16,
  15,
  '🪙      🪙      🪙     🦅       💲'
 ],
 [
  'run',
  16,
  22,
  '🪙      🪙      🦅      💲      💲'
 ],
 [
  'run',
  16,
  23,
  '🪙      🪙     🦅       💲      💲'
 ],
 [
  'run',
  16,
  29,
  '🪙       🦅     💲      💲      💲'
 ],
 [
  'run',
  16,
  36,
  '🪙🦅    💲      💲      💲      💲'
 ],
 [
  'run',
  16,
  37,
  '🦅      💲      💲      💲      💲'
 ],
 [
  'run',
  16,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦅'
 ],
 [
  'run',
  16,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦅'
 ],
 [
  'halt',
  0,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌'
 ],
 [
  'halt',
  0,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌'
 ],
 [
  'halt',
  0,
  5,
  '🪙      🪙      🪙      🪙       🐌'
 ],
 [
  'halt',
  0,
  6,
  '🪙      🪙      🪙      🪙      🐌'
 ],
 [
  'halt',
  0,
  7,
  '🪙      🪙      🪙      🪙     🐌'
 ],
 [
  'halt',
  0,
  8,
  '🪙      🪙      🪙      🪙    🐌💲'
 ],
 [
  'halt',
  0,
  13,
  '🪙      🪙      🪙       🐌     💲'
 ],
 [
  'halt',
  0,
  14,
  '🪙      🪙      🪙      🐌      💲'
 ],
 [
  'halt',
  0,
  15,
  '🪙      🪙      🪙     🐌       💲'
 ],
 [
  'halt',
  0,
  22,
  '🪙      🪙      🐌      💲      💲'
 ],
 [
  'halt',
  0,
  23,
  '🪙      🪙     🐌       💲      💲'
 ],
 [
  'halt',
  0,
  29,
  '🪙       🐌     💲      💲      💲'
 ],
 [
  'halt',
  0,
  36,
  '🪙🐌    💲      💲      💲      💲'
 ],
 [
  'halt',
  0,
  37,
  '🐌      💲      💲      💲      💲'
 ],
 [
  'halt',
  0,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌'
 ],
 [
  'halt',
  0,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌'
 ],
 [
  'halt',
  3,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐁'
 ],
 [
  'halt',
  3,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐁'
 ],
 [
  'halt',
  3,
  5,
  '🪙      🪙      🪙      🪙       🐁'
 ],
 [
  'halt',
  3,
  6,
  '🪙      🪙      🪙      🪙      🐁'
 ],
 [
  'halt',
  3,
  7,
  '🪙      🪙      🪙      🪙     🐁'
 ],
 [
  'halt',
  3,
  8,
  '🪙      🪙      🪙      🪙    🐁💲'
 ],
 [
  'halt',
  3,
  13,
  '🪙      🪙      🪙       🐁     💲'
 ],
 [
  'halt',
  3,
  14,
  '🪙      🪙      🪙      🐁      💲'
 ],
 [
  'halt',
  3,
  15,
  '🪙      🪙      🪙     🐁       💲'
 ],
 [
  'halt',
  3,
  22,
  '🪙      🪙      🐁      💲      💲'
 ],
 [
  'halt',
  3,
  23,
  '🪙      🪙     🐁       💲      💲'
 ],
 [
  'halt',
  3,
  29,
  '🪙       🐁     💲      💲      💲'
 ],
 [
  'halt',
  3,
  36,
  '🪙🐁    💲      💲      💲      💲'
 ],
 [
  'halt',
  3,
  37,
  '🐁      💲      💲      💲      💲'
 ],
 [
  'halt',
  3,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐁'
 ],
 [
  'halt',
  3,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐁'
 ],
 [
  'halt',
  7,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐘'
 ],
 [
  'halt',
  7,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐘'
 ],
 [
  'halt',
  7,
  5,
  '🪙      🪙      🪙      🪙       🐘'
 ],
 [
  'halt',
  7,
  6,
  '🪙      🪙      🪙      🪙      🐘'
 ],
 [
  'halt',
  7,
  7,
  '🪙      🪙      🪙      🪙     🐘'
 ],
 [
  'halt',
  7,
  8,
  '🪙      🪙      🪙      🪙    🐘💲'
 ],
 [
  'halt',
  7,
  13,
  '🪙      🪙      🪙       🐘     💲'
 ],
 [
  'halt',
  7,
  14,
  '🪙      🪙      🪙      🐘      💲'
 ],
 [
  'halt',
  7,
  15,
  '🪙      🪙      🪙     🐘       💲'
 ],
 [
  'halt',
  7,
  22,
  '🪙      🪙      🐘      💲      💲'
 ],
 [
  'halt',
  7,
  23,
  '🪙      🪙     🐘       💲      💲'
 ],
 [
  'halt',
  7,
  29,
  '🪙       🐘     💲      💲      💲'
 ],
 [
  'halt',
  7,
  36,
  '🪙🐘    💲      💲      💲      💲'
 ],
 [
  'halt',
  7,
  37,
  '🐘      💲      💲      💲      💲'
 ],
 [
  'halt',
  7,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐘'
 ],
 [
  'halt',
  7,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐘'
 ],
 [
  'halt',
  12,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦌'
 ],
 [
  'halt',
  12,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦌'
 ],
 [
  'halt',
  12,
  5,
  '🪙      🪙      🪙      🪙       🦌'
 ],
 [
  'halt',
  12,
  6,
  '🪙      🪙      🪙      🪙      🦌'
 ],
 [
  'halt',
  12,
  7,
  '🪙      🪙      🪙      🪙     🦌'
 ],
 [
  'halt',
  12,
  8,
  '🪙      🪙      🪙      🪙    🦌💲'
 ],
 [
  'halt',
  12,
  13,
  '🪙      🪙      🪙       🦌     💲'
 ],
 [
  'halt',
  12,
  14,
  '🪙      🪙      🪙      🦌      💲'
 ],
 [
  'halt',
  12,
  15,
  '🪙      🪙      🪙     🦌       💲'
 ],
 [
  'halt',
  12,
  22,
  '🪙      🪙      🦌      💲      💲'
 ],
 [
  'halt',
  12,
  23,
  '🪙      🪙     🦌       💲      💲'
 ],
 [
  'halt',
  12,
  29,
  '🪙       🦌     💲      💲      💲'
 ],
 [
  'halt',
  12,
  36,
  '🪙🦌    💲      💲      💲      💲'
 ],
 [
  'halt',
  12,
  37,
  '🦌      💲      💲      💲      💲'
 ],
 [
  'halt',
  12,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦌'
 ],
 [
  'halt',
  12,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦌'
 ],
 [
  'halt',
  16,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦅'
 ],
 [
  'halt',
  16,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦅'
 ],
 [
  'halt',
  16,
  5,
  '🪙      🪙      🪙      🪙       🦅'
 ],
 [
  'halt',
  16,
  6,
  '🪙      🪙      🪙      🪙      🦅'
 ],
 [
  'halt',
  16,
  7,
  '🪙      🪙      🪙      🪙     🦅'
 ],
 [
  'halt',
  16,
  8,
  '🪙      🪙      🪙      🪙    🦅💲'
 ],
 [
  'halt',
  16,
  13,
  '🪙      🪙      🪙       🦅     💲'
 ],
 [
  'halt',
  16,
  14,
  '🪙      🪙      🪙      🦅      💲'
 ],
 [
  'halt',
  16,
  15,
  '🪙      🪙      🪙     🦅       💲'
 ],
 [
  'halt',
  16,
  22,
  '🪙      🪙      🦅      💲      💲'
 ],
 [
  'halt',
  16,
  23,
  '🪙      🪙     🦅       💲      💲'
 ],
 [
  'halt',
  16,
  29,
  '🪙       🦅     💲      💲      💲'
 ],
 [
  'halt',
  16,
  36,
  '🪙🦅    💲      💲      💲      💲'
 ],
 [
  'halt',
  16,
  37,
  '🦅      💲      💲      💲      💲'
 ],
 [
  'halt',
  16,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦅'
 ],
 [
  'halt',
  16,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦅'
 ],
 [
  'vacant',
  0,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  0,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  0,
  5,
  '🪙      🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  0,
  6,
  '🪙      🪙      🪙      🪙      🐌💤'
 ],
 [
  'vacant',
  0,
  7,
  '🪙      🪙      🪙      🪙     🐌💤'
 ],
 [
  'vacant',
  0,
  8,
  '🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  0,
  13,
  '🪙      🪙      🪙       🐌💤   💲'
 ],
 [
  'vacant',
  0,
  14,
  '🪙      🪙      🪙      🐌💤    💲'
 ],
 [
  'vacant',
  0,
  15,
  '🪙      🪙      🪙     🐌💤     💲'
 ],
 [
  'vacant',
  0,
  22,
  '🪙      🪙      🐌💤    💲      💲'
 ],
 [
  'vacant',
  0,
  23,
  '🪙      🪙     🐌💤     💲      💲'
 ],
 [
  'vacant',
  0,
  29,
  '🪙       🐌💤   💲      💲      💲'
 ],
 [
  'vacant',
  0,
  36,
  '🪙🐌💤  💲      💲      💲      💲'
 ],
 [
  'vacant',
  0,
  37,
  '🐌💤    💲      💲      💲      💲'
 ],
 [
  'vacant',
  0,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  0,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  3,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  3,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  3,
  5,
  '🪙      🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  3,
  6,
  '🪙      🪙      🪙      🪙      🐌💤'
 ],
 [
  'vacant',
  3,
  7,
  '🪙      🪙      🪙      🪙     🐌💤'
 ],
 [
  'vacant',
  3,
  8,
  '🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  3,
  13,
  '🪙      🪙      🪙       🐌💤   💲'
 ],
 [
  'vacant',
  3,
  14,
  '🪙      🪙      🪙      🐌💤    💲'
 ],
 [
  'vacant',
  3,
  15,
  '🪙      🪙      🪙     🐌💤     💲'
 ],
 [
  'vacant',
  3,
  22,
  '🪙      🪙      🐌💤    💲      💲'
 ],
 [
  'vacant',
  3,
  23,
  '🪙      🪙     🐌💤     💲      💲'
 ],
 [
  'vacant',
  3,
  29,
  '🪙       🐌💤   💲      💲      💲'
 ],
 [
  'vacant',
  3,
  36,
  '🪙🐌💤  💲      💲      💲      💲'
 ],
 [
  'vacant',
  3,
  37,
  '🐌💤    💲      💲      💲      💲'
 ],
 [
  'vacant',
  3,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  3,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  7,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  7,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  7,
  5,
  '🪙      🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  7,
  6,
  '🪙      🪙      🪙      🪙      🐌💤'
 ],
 [
  'vacant',
  7,
  7,
  '🪙      🪙      🪙      🪙     🐌💤'
 ],
 [
  'vacant',
  7,
  8,
  '🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  7,
  13,
  '🪙      🪙      🪙       🐌💤   💲'
 ],
 [
  'vacant',
  7,
  14,
  '🪙      🪙      🪙      🐌💤    💲'
 ],
 [
  'vacant',
  7,
  15,
  '🪙      🪙      🪙     🐌💤     💲'
 ],
 [
  'vacant',
  7,
  22,
  '🪙      🪙      🐌💤    💲      💲'
 ],
 [
  'vacant',
  7,
  23,
  '🪙      🪙     🐌💤     💲      💲'
 ],
 [
  'vacant',
  7,
  29,
  '🪙       🐌💤   💲      💲      💲'
 ],
 [
  'vacant',
  7,
  36,
  '🪙🐌💤  💲      💲      💲      💲'
 ],
 [
  'vacant',
  7,
  37,
  '🐌💤    💲      💲      💲      💲'
 ],
 [
  'vacant',
  7,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  7,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  12,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  12,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  12,
  5,
  '🪙      🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  12,
  6,
  '🪙      🪙      🪙      🪙      🐌💤'
 ],
 [
  'vacant',
  12,
  7,
  '🪙      🪙      🪙      🪙     🐌💤'
 ],
 [
  'vacant',
  12,
  8,
  '🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  12,
  13,
  '🪙      🪙      🪙       🐌💤   💲'
 ],
 [
  'vacant',
  12,
  14,
  '🪙      🪙      🪙      🐌💤    💲'
 ],
 [
  'vacant',
  12,
  15,
  '🪙      🪙      🪙     🐌💤     💲'
 ],
 [
  'vacant',
  12,
  22,
  '🪙      🪙      🐌💤    💲      💲'
 ],
 [
  'vacant',
  12,
  23,
  '🪙      🪙     🐌💤     💲      💲'
 ],
 [
  'vacant',
  12,
  29,
  '🪙       🐌💤   💲      💲      💲'
 ],
 [
  'vacant',
  12,
  36,
  '🪙🐌💤  💲      💲      💲      💲'
 ],
 [
  'vacant',
  12,
  37,
  '🐌💤    💲      💲      💲      💲'
 ],
 [
  'vacant',
  12,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  12,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  16,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  16,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ],
 [
  'vacant',
  16,
  5,
  '🪙      🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  16,
  6,
  '🪙      🪙      🪙      🪙      🐌💤'
 ],
 [
  'vacant',
  16,
  7,
  '🪙      🪙      🪙      🪙     🐌💤'
 ],
 [
  'vacant',
  16,
  8,
  '🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  16,
  13,
  '🪙      🪙      🪙       🐌💤   💲'
 ],
 [
  'vacant',
  16,
  14,
  '🪙      🪙      🪙      🐌💤    💲'
 ],
 [
  'vacant',
  16,
  15,
  '🪙      🪙      🪙     🐌💤     💲'
 ],
 [
  'vacant',
  16,
  22,
  '🪙      🪙      🐌💤    💲      💲'
 ],
 [
  'vacant',
  16,
  23,
  '🪙      🪙     🐌💤     💲      💲'
 ],
 [
  'vacant',
  16,
  29,
  '🪙       🐌💤   💲      💲      💲'
 ],
 [
  'vacant',
  16,
  36,
  '🪙🐌💤  💲      💲      💲      💲'
 ],
 [
  'vacant',
  16,
  37,
  '🐌💤    💲      💲      💲      💲'
 ],
 [
  'vacant',
  16,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐌💤'
 ],
 [
  'vacant',
  16,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐌💤'
 ]
]

const COLUMNS: readonly (readonly [number, number])[] = [[0, 38], [1, 37], [2, 36], [3, 35], [4, 34], [5, 33], [6, 32], [7, 31], [8, 30], [9, 29], [10, 28], [11, 27], [12, 26], [13, 25], [14, 24], [15, 23], [16, 22], [17, 21], [18, 20], [19, 19], [20, 18], [21, 17], [22, 16], [23, 15], [24, 14], [25, 13], [26, 12], [27, 11], [28, 10], [29, 9], [30, 8], [31, 7], [32, 6], [33, 5], [34, 4], [35, 3], [36, 2], [37, 0], [38, 38], [39, 37], [40, 36], [41, 35], [42, 34], [43, 33], [44, 32], [45, 31], [46, 30], [47, 29], [48, 28], [49, 27], [50, 26], [51, 25], [52, 24], [53, 23], [54, 22], [55, 21], [56, 20], [57, 19], [58, 18], [59, 17], [60, 16], [61, 15], [62, 14], [63, 13], [64, 12], [65, 11], [66, 10], [67, 9], [68, 8], [69, 7], [70, 6], [71, 5], [72, 4], [73, 3], [74, 2], [75, 0], [76, 38], [77, 37], [78, 36], [79, 35]]

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
  expect(parseLive('halt 3 doze\n')).toEqual({ phase: 'halt', level: 3, mark: 'doze' })
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
  ['run', 0, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💨'],
  ['run', 0, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💨'],
  ['run', 0, 5, 'gust', '🪙      🪙      🪙      🪙       🐌💨'],
  ['run', 0, 6, 'gust', '🪙      🪙      🪙      🪙      🐌💨'],
  ['run', 0, 7, 'gust', '🪙      🪙      🪙      🪙     🐌💨'],
  ['run', 0, 13, 'gust', '🪙      🪙      🪙       🐌💨   💲'],
  ['run', 0, 14, 'gust', '🪙      🪙      🪙      🐌💨    💲'],
  ['run', 0, 22, 'gust', '🪙      🪙      🐌💨    💲      💲'],
  ['run', 0, 30, 'gust', '🪙      🐌💨    💲      💲      💲'],
  ['run', 0, 36, 'gust', '🪙🐌💨  💲      💲      💲      💲'],
  ['run', 0, 37, 'gust', '🐌💨    💲      💲      💲      💲'],
  ['run', 0, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💨'],
  ['run', 0, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💨'],
  ['run', 0, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💨'],
  ['run', 7, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🐘💨'],
  ['run', 7, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🐘💨'],
  ['run', 7, 5, 'gust', '🪙      🪙      🪙      🪙       🐘💨'],
  ['run', 7, 6, 'gust', '🪙      🪙      🪙      🪙      🐘💨'],
  ['run', 7, 7, 'gust', '🪙      🪙      🪙      🪙     🐘💨'],
  ['run', 7, 13, 'gust', '🪙      🪙      🪙       🐘💨   💲'],
  ['run', 7, 14, 'gust', '🪙      🪙      🪙      🐘💨    💲'],
  ['run', 7, 22, 'gust', '🪙      🪙      🐘💨    💲      💲'],
  ['run', 7, 30, 'gust', '🪙      🐘💨    💲      💲      💲'],
  ['run', 7, 36, 'gust', '🪙🐘💨  💲      💲      💲      💲'],
  ['run', 7, 37, 'gust', '🐘💨    💲      💲      💲      💲'],
  ['run', 7, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🐘💨'],
  ['run', 7, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🐘💨'],
  ['run', 7, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🐘💨'],
  ['run', 16, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🦅💨'],
  ['run', 16, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🦅💨'],
  ['run', 16, 5, 'gust', '🪙      🪙      🪙      🪙       🦅💨'],
  ['run', 16, 6, 'gust', '🪙      🪙      🪙      🪙      🦅💨'],
  ['run', 16, 7, 'gust', '🪙      🪙      🪙      🪙     🦅💨'],
  ['run', 16, 13, 'gust', '🪙      🪙      🪙       🦅💨   💲'],
  ['run', 16, 14, 'gust', '🪙      🪙      🪙      🦅💨    💲'],
  ['run', 16, 22, 'gust', '🪙      🪙      🦅💨    💲      💲'],
  ['run', 16, 30, 'gust', '🪙      🦅💨    💲      💲      💲'],
  ['run', 16, 36, 'gust', '🪙🦅💨  💲      💲      💲      💲'],
  ['run', 16, 37, 'gust', '🦅💨    💲      💲      💲      💲'],
  ['run', 16, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🦅💨'],
  ['run', 16, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🦅💨'],
  ['run', 16, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🦅💨'],
  ['run', 0, 0, 'fire', '🪙      🪙      🪙      🪙      🪙    🐌🔥'],
  ['run', 0, 1, 'fire', '🪙      🪙      🪙      🪙      🪙   🐌🔥'],
  ['run', 0, 5, 'fire', '🪙      🪙      🪙      🪙       🐌🔥'],
  ['run', 0, 6, 'fire', '🪙      🪙      🪙      🪙      🐌🔥'],
  ['run', 0, 7, 'fire', '🪙      🪙      🪙      🪙     🐌🔥'],
  ['run', 0, 13, 'fire', '🪙      🪙      🪙       🐌🔥   💲'],
  ['run', 0, 14, 'fire', '🪙      🪙      🪙      🐌🔥    💲'],
  ['run', 0, 22, 'fire', '🪙      🪙      🐌🔥    💲      💲'],
  ['run', 0, 30, 'fire', '🪙      🐌🔥    💲      💲      💲'],
  ['run', 0, 36, 'fire', '🪙🐌🔥  💲      💲      💲      💲'],
  ['run', 0, 37, 'fire', '🐌🔥    💲      💲      💲      💲'],
  ['run', 0, 38, 'fire', '🪙      🪙      🪙      🪙      🪙    🐌🔥'],
  ['run', 0, 39, 'fire', '🪙      🪙      🪙      🪙      🪙   🐌🔥'],
  ['run', 0, 77, 'fire', '🪙      🪙      🪙      🪙      🪙   🐌🔥'],
  ['run', 7, 0, 'fire', '🪙      🪙      🪙      🪙      🪙    🐘🔥'],
  ['run', 7, 1, 'fire', '🪙      🪙      🪙      🪙      🪙   🐘🔥'],
  ['run', 7, 5, 'fire', '🪙      🪙      🪙      🪙       🐘🔥'],
  ['run', 7, 6, 'fire', '🪙      🪙      🪙      🪙      🐘🔥'],
  ['run', 7, 7, 'fire', '🪙      🪙      🪙      🪙     🐘🔥'],
  ['run', 7, 13, 'fire', '🪙      🪙      🪙       🐘🔥   💲'],
  ['run', 7, 14, 'fire', '🪙      🪙      🪙      🐘🔥    💲'],
  ['run', 7, 22, 'fire', '🪙      🪙      🐘🔥    💲      💲'],
  ['run', 7, 30, 'fire', '🪙      🐘🔥    💲      💲      💲'],
  ['run', 7, 36, 'fire', '🪙🐘🔥  💲      💲      💲      💲'],
  ['run', 7, 37, 'fire', '🐘🔥    💲      💲      💲      💲'],
  ['run', 7, 38, 'fire', '🪙      🪙      🪙      🪙      🪙    🐘🔥'],
  ['run', 7, 39, 'fire', '🪙      🪙      🪙      🪙      🪙   🐘🔥'],
  ['run', 7, 77, 'fire', '🪙      🪙      🪙      🪙      🪙   🐘🔥'],
  ['run', 16, 0, 'fire', '🪙      🪙      🪙      🪙      🪙    🦅🔥'],
  ['run', 16, 1, 'fire', '🪙      🪙      🪙      🪙      🪙   🦅🔥'],
  ['run', 16, 5, 'fire', '🪙      🪙      🪙      🪙       🦅🔥'],
  ['run', 16, 6, 'fire', '🪙      🪙      🪙      🪙      🦅🔥'],
  ['run', 16, 7, 'fire', '🪙      🪙      🪙      🪙     🦅🔥'],
  ['run', 16, 13, 'fire', '🪙      🪙      🪙       🦅🔥   💲'],
  ['run', 16, 14, 'fire', '🪙      🪙      🪙      🦅🔥    💲'],
  ['run', 16, 22, 'fire', '🪙      🪙      🦅🔥    💲      💲'],
  ['run', 16, 30, 'fire', '🪙      🦅🔥    💲      💲      💲'],
  ['run', 16, 36, 'fire', '🪙🦅🔥  💲      💲      💲      💲'],
  ['run', 16, 37, 'fire', '🦅🔥    💲      💲      💲      💲'],
  ['run', 16, 38, 'fire', '🪙      🪙      🪙      🪙      🪙    🦅🔥'],
  ['run', 16, 39, 'fire', '🪙      🪙      🪙      🪙      🪙   🦅🔥'],
  ['run', 16, 77, 'fire', '🪙      🪙      🪙      🪙      🪙   🦅🔥'],
  ['halt', 0, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['halt', 0, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['halt', 0, 5, 'doze', '🪙      🪙      🪙      🪙       🐌💤'],
  ['halt', 0, 6, 'doze', '🪙      🪙      🪙      🪙      🐌💤'],
  ['halt', 0, 7, 'doze', '🪙      🪙      🪙      🪙     🐌💤'],
  ['halt', 0, 13, 'doze', '🪙      🪙      🪙       🐌💤   💲'],
  ['halt', 0, 14, 'doze', '🪙      🪙      🪙      🐌💤    💲'],
  ['halt', 0, 22, 'doze', '🪙      🪙      🐌💤    💲      💲'],
  ['halt', 0, 30, 'doze', '🪙      🐌💤    💲      💲      💲'],
  ['halt', 0, 36, 'doze', '🪙🐌💤  💲      💲      💲      💲'],
  ['halt', 0, 37, 'doze', '🐌💤    💲      💲      💲      💲'],
  ['halt', 0, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['halt', 0, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['halt', 0, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['halt', 7, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🐘💤'],
  ['halt', 7, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🐘💤'],
  ['halt', 7, 5, 'doze', '🪙      🪙      🪙      🪙       🐘💤'],
  ['halt', 7, 6, 'doze', '🪙      🪙      🪙      🪙      🐘💤'],
  ['halt', 7, 7, 'doze', '🪙      🪙      🪙      🪙     🐘💤'],
  ['halt', 7, 13, 'doze', '🪙      🪙      🪙       🐘💤   💲'],
  ['halt', 7, 14, 'doze', '🪙      🪙      🪙      🐘💤    💲'],
  ['halt', 7, 22, 'doze', '🪙      🪙      🐘💤    💲      💲'],
  ['halt', 7, 30, 'doze', '🪙      🐘💤    💲      💲      💲'],
  ['halt', 7, 36, 'doze', '🪙🐘💤  💲      💲      💲      💲'],
  ['halt', 7, 37, 'doze', '🐘💤    💲      💲      💲      💲'],
  ['halt', 7, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🐘💤'],
  ['halt', 7, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🐘💤'],
  ['halt', 7, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🐘💤'],
  ['halt', 16, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🦅💤'],
  ['halt', 16, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🦅💤'],
  ['halt', 16, 5, 'doze', '🪙      🪙      🪙      🪙       🦅💤'],
  ['halt', 16, 6, 'doze', '🪙      🪙      🪙      🪙      🦅💤'],
  ['halt', 16, 7, 'doze', '🪙      🪙      🪙      🪙     🦅💤'],
  ['halt', 16, 13, 'doze', '🪙      🪙      🪙       🦅💤   💲'],
  ['halt', 16, 14, 'doze', '🪙      🪙      🪙      🦅💤    💲'],
  ['halt', 16, 22, 'doze', '🪙      🪙      🦅💤    💲      💲'],
  ['halt', 16, 30, 'doze', '🪙      🦅💤    💲      💲      💲'],
  ['halt', 16, 36, 'doze', '🪙🦅💤  💲      💲      💲      💲'],
  ['halt', 16, 37, 'doze', '🦅💤    💲      💲      💲      💲'],
  ['halt', 16, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🦅💤'],
  ['halt', 16, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🦅💤'],
  ['halt', 16, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🦅💤'],
  ['vacant', 0, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 0, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 0, 5, 'gust', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 0, 6, 'gust', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 0, 7, 'gust', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 0, 13, 'gust', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 0, 14, 'gust', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 0, 22, 'gust', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 0, 30, 'gust', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 0, 36, 'gust', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 0, 37, 'gust', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 0, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 0, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 0, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 7, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 5, 'gust', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 7, 6, 'gust', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 7, 7, 'gust', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 7, 13, 'gust', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 7, 14, 'gust', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 7, 22, 'gust', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 7, 30, 'gust', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 7, 36, 'gust', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 7, 37, 'gust', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 7, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 7, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 0, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 16, 1, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 5, 'gust', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 16, 6, 'gust', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 16, 7, 'gust', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 16, 13, 'gust', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 16, 14, 'gust', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 16, 22, 'gust', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 16, 30, 'gust', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 16, 36, 'gust', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 16, 37, 'gust', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 16, 38, 'gust', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 16, 39, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 77, 'gust', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 0, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 0, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 0, 5, 'doze', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 0, 6, 'doze', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 0, 7, 'doze', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 0, 13, 'doze', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 0, 14, 'doze', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 0, 22, 'doze', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 0, 30, 'doze', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 0, 36, 'doze', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 0, 37, 'doze', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 0, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 0, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 0, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 7, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 5, 'doze', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 7, 6, 'doze', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 7, 7, 'doze', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 7, 13, 'doze', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 7, 14, 'doze', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 7, 22, 'doze', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 7, 30, 'doze', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 7, 36, 'doze', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 7, 37, 'doze', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 7, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 7, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 7, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 0, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 16, 1, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 5, 'doze', '🪙      🪙      🪙      🪙       🐌💤'],
  ['vacant', 16, 6, 'doze', '🪙      🪙      🪙      🪙      🐌💤'],
  ['vacant', 16, 7, 'doze', '🪙      🪙      🪙      🪙     🐌💤'],
  ['vacant', 16, 13, 'doze', '🪙      🪙      🪙       🐌💤   💲'],
  ['vacant', 16, 14, 'doze', '🪙      🪙      🪙      🐌💤    💲'],
  ['vacant', 16, 22, 'doze', '🪙      🪙      🐌💤    💲      💲'],
  ['vacant', 16, 30, 'doze', '🪙      🐌💤    💲      💲      💲'],
  ['vacant', 16, 36, 'doze', '🪙🐌💤  💲      💲      💲      💲'],
  ['vacant', 16, 37, 'doze', '🐌💤    💲      💲      💲      💲'],
  ['vacant', 16, 38, 'doze', '🪙      🪙      🪙      🪙      🪙    🐌💤'],
  ['vacant', 16, 39, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
  ['vacant', 16, 77, 'doze', '🪙      🪙      🪙      🪙      🪙   🐌💤'],
]

test('draws wind, fire and zzz behind the animal as meter.py does', async () => {
  for (const [phase, level, dist, mark, line] of MARKED) {
    expect(render(phase, level, dist, mark)).toBe(line)
  }
  expect(render('run', 7, 13, 'gust')).toContain('🐘💨')
  expect(render('run', 7, 13, 'fire')).toContain('🐘🔥')
  expect(render('halt', 7, 13, 'doze')).toContain('🐘💤')
})

test('draws a poof in place of an animal that is changing', async () => {
  const before = render('run', 7, 13, 'gust')
  const during = render('run', 7, 13, 'gust', 40, true)
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
  expect(poofs({ phase: 'run', level: 7 }, 'run', 8)).toBe(true)
  expect(poofs({ phase: 'run', level: 7 }, 'halt', 6)).toBe(true)
  expect(poofs({ phase: 'run', level: 7 }, 'halt', 7)).toBe(false)
  expect(poofs({ phase: 'halt', level: 7 }, 'run', 7)).toBe(false)
  // Waking up, even as the snail it slept as.
  expect(poofs({ phase: 'vacant', level: 0 }, 'run', 0)).toBe(true)
  expect(poofs({ phase: 'vacant', level: 9 }, 'run', 9)).toBe(true)
  // Falling asleep, and whatever happens to the speed while asleep.
  expect(poofs({ phase: 'run', level: 7 }, 'vacant', 7)).toBe(false)
  expect(poofs({ phase: 'halt', level: 7 }, 'vacant', 0)).toBe(false)
  expect(poofs({ phase: 'vacant', level: 7 }, 'vacant', 3)).toBe(false)
})
