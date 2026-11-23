import { expect, test } from 'claude-code/testing'

import { animal, animalColumn, parseLive, render } from './register'
import type { Phase } from './register'

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
  13,
  '🪙      🪙      🪙       🐌'
 ],
 [
  'run',
  0,
  29,
  '🪙       🐌'
 ],
 [
  'run',
  0,
  36,
  '🪙🐌'
 ],
 [
  'run',
  0,
  37,
  '🐌'
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
  13,
  '🪙      🪙      🪙       🐁'
 ],
 [
  'run',
  3,
  29,
  '🪙       🐁'
 ],
 [
  'run',
  3,
  36,
  '🪙🐁'
 ],
 [
  'run',
  3,
  37,
  '🐁'
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
  13,
  '🪙      🪙      🪙       🐘'
 ],
 [
  'run',
  7,
  29,
  '🪙       🐘'
 ],
 [
  'run',
  7,
  36,
  '🪙🐘'
 ],
 [
  'run',
  7,
  37,
  '🐘'
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
  13,
  '🪙      🪙      🪙       🦌'
 ],
 [
  'run',
  12,
  29,
  '🪙       🦌'
 ],
 [
  'run',
  12,
  36,
  '🪙🦌'
 ],
 [
  'run',
  12,
  37,
  '🦌'
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
  13,
  '🪙      🪙      🪙       🦅'
 ],
 [
  'run',
  16,
  29,
  '🪙       🦅'
 ],
 [
  'run',
  16,
  36,
  '🪙🦅'
 ],
 [
  'run',
  16,
  37,
  '🦅'
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
  13,
  '🪙      🪙      🪙       🐌'
 ],
 [
  'halt',
  0,
  29,
  '🪙       🐌'
 ],
 [
  'halt',
  0,
  36,
  '🪙🐌'
 ],
 [
  'halt',
  0,
  37,
  '🐌'
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
  13,
  '🪙      🪙      🪙       🐁'
 ],
 [
  'halt',
  3,
  29,
  '🪙       🐁'
 ],
 [
  'halt',
  3,
  36,
  '🪙🐁'
 ],
 [
  'halt',
  3,
  37,
  '🐁'
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
  13,
  '🪙      🪙      🪙       🐘'
 ],
 [
  'halt',
  7,
  29,
  '🪙       🐘'
 ],
 [
  'halt',
  7,
  36,
  '🪙🐘'
 ],
 [
  'halt',
  7,
  37,
  '🐘'
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
  13,
  '🪙      🪙      🪙       🦌'
 ],
 [
  'halt',
  12,
  29,
  '🪙       🦌'
 ],
 [
  'halt',
  12,
  36,
  '🪙🦌'
 ],
 [
  'halt',
  12,
  37,
  '🦌'
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
  13,
  '🪙      🪙      🪙       🦅'
 ],
 [
  'halt',
  16,
  29,
  '🪙       🦅'
 ],
 [
  'halt',
  16,
  36,
  '🪙🦅'
 ],
 [
  'halt',
  16,
  37,
  '🦅'
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
  13,
  '🪙      🪙      🪙       🐌💤'
 ],
 [
  'vacant',
  0,
  29,
  '🪙       🐌💤'
 ],
 [
  'vacant',
  0,
  36,
  '🪙🐌💤'
 ],
 [
  'vacant',
  0,
  37,
  '🐌💤'
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
  '🪙      🪙      🪙      🪙      🪙    🐁💤'
 ],
 [
  'vacant',
  3,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐁💤'
 ],
 [
  'vacant',
  3,
  5,
  '🪙      🪙      🪙      🪙       🐁💤'
 ],
 [
  'vacant',
  3,
  6,
  '🪙      🪙      🪙      🪙      🐁💤'
 ],
 [
  'vacant',
  3,
  13,
  '🪙      🪙      🪙       🐁💤'
 ],
 [
  'vacant',
  3,
  29,
  '🪙       🐁💤'
 ],
 [
  'vacant',
  3,
  36,
  '🪙🐁💤'
 ],
 [
  'vacant',
  3,
  37,
  '🐁💤'
 ],
 [
  'vacant',
  3,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐁💤'
 ],
 [
  'vacant',
  3,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐁💤'
 ],
 [
  'vacant',
  7,
  0,
  '🪙      🪙      🪙      🪙      🪙    🐘💤'
 ],
 [
  'vacant',
  7,
  1,
  '🪙      🪙      🪙      🪙      🪙   🐘💤'
 ],
 [
  'vacant',
  7,
  5,
  '🪙      🪙      🪙      🪙       🐘💤'
 ],
 [
  'vacant',
  7,
  6,
  '🪙      🪙      🪙      🪙      🐘💤'
 ],
 [
  'vacant',
  7,
  13,
  '🪙      🪙      🪙       🐘💤'
 ],
 [
  'vacant',
  7,
  29,
  '🪙       🐘💤'
 ],
 [
  'vacant',
  7,
  36,
  '🪙🐘💤'
 ],
 [
  'vacant',
  7,
  37,
  '🐘💤'
 ],
 [
  'vacant',
  7,
  38,
  '🪙      🪙      🪙      🪙      🪙    🐘💤'
 ],
 [
  'vacant',
  7,
  77,
  '🪙      🪙      🪙      🪙      🪙   🐘💤'
 ],
 [
  'vacant',
  12,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦌💤'
 ],
 [
  'vacant',
  12,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦌💤'
 ],
 [
  'vacant',
  12,
  5,
  '🪙      🪙      🪙      🪙       🦌💤'
 ],
 [
  'vacant',
  12,
  6,
  '🪙      🪙      🪙      🪙      🦌💤'
 ],
 [
  'vacant',
  12,
  13,
  '🪙      🪙      🪙       🦌💤'
 ],
 [
  'vacant',
  12,
  29,
  '🪙       🦌💤'
 ],
 [
  'vacant',
  12,
  36,
  '🪙🦌💤'
 ],
 [
  'vacant',
  12,
  37,
  '🦌💤'
 ],
 [
  'vacant',
  12,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦌💤'
 ],
 [
  'vacant',
  12,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦌💤'
 ],
 [
  'vacant',
  16,
  0,
  '🪙      🪙      🪙      🪙      🪙    🦅💤'
 ],
 [
  'vacant',
  16,
  1,
  '🪙      🪙      🪙      🪙      🪙   🦅💤'
 ],
 [
  'vacant',
  16,
  5,
  '🪙      🪙      🪙      🪙       🦅💤'
 ],
 [
  'vacant',
  16,
  6,
  '🪙      🪙      🪙      🪙      🦅💤'
 ],
 [
  'vacant',
  16,
  13,
  '🪙      🪙      🪙       🦅💤'
 ],
 [
  'vacant',
  16,
  29,
  '🪙       🦅💤'
 ],
 [
  'vacant',
  16,
  36,
  '🪙🦅💤'
 ],
 [
  'vacant',
  16,
  37,
  '🦅💤'
 ],
 [
  'vacant',
  16,
  38,
  '🪙      🪙      🪙      🪙      🪙    🦅💤'
 ],
 [
  'vacant',
  16,
  77,
  '🪙      🪙      🪙      🪙      🪙   🦅💤'
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
  expect(parseLive('run 7')).toEqual({ phase: 'run', level: 7 })
  expect(parseLive('vacant 0\n')).toEqual({ phase: 'vacant', level: 0 })
  expect(parseLive('')).toBeUndefined()
  expect(parseLive('gallop 3')).toBeUndefined()
  expect(parseLive('run fast')).toBeUndefined()
})
