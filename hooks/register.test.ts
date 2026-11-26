import { expect, test } from 'claude-code/testing'

import {
  animal,
  animalColumn,
  animalShown,
  blinkShows,
  drawnPhase,
  errorLine,
  fare,
  fareAt,
  findPython,
  frame,
  homeFares,
  isWindows,
  lastLine,
  motionOf,
  NEW_PICTURE,
  parseLive,
  parseProbe,
  poofs,
  pythonsFor,
  render,
  seenIn,
  sightOf,
  signDir,
  stamped,
  transcriptFor,
  waits,
} from './register'
import type { Fares, Live, Motion, Picture, Run } from './register'
import { COLUMNS, CREPT, FARES, LEFT, LINES, MARKED, NEXT_LAP, STAMPED, STAMPS, WALKED } from './pictures'

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

test('finds Python on Windows through the launcher py', async () => {
  // python3 and python are the Store's stand-ins: they answer 9009, not the probe.
  const windows = machine({
    python3: 9009,
    python: 9009,
    py: '3 12 C:\\Users\\me\\AppData\\Local\\Programs\\Python\\Python312\\python.exe\r\n',
  })
  expect(await findPython(windows.run)).toEqual({
    path: 'C:\\Users\\me\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  })
  expect(windows.tried).toEqual(['/usr/bin/python3', 'python3', 'python', 'py'])

  // Known to be Windows, the launcher is tried first: the stand-ins are not
  // asked at all.
  const known = machine({
    python3: 9009,
    python: 9009,
    py: '3 12 C:\\Python312\\python.exe\r\n',
  })
  expect(await findPython(known.run, pythonsFor(true))).toEqual({ path: 'C:\\Python312\\python.exe' })
  expect(known.tried).toEqual(['py'])
  // Without the launcher, a real python or python3 still does.
  const plain = machine({ python3: '3 11 C:\\Python311\\python3.exe\r\n' })
  expect(await findPython(plain.run, pythonsFor(true))).toEqual({ path: 'C:\\Python311\\python3.exe' })
  expect(plain.tried).toEqual(['py', 'python', 'python3'])
})

test('looks for Python in the order of the system it runs on', () => {
  expect(pythonsFor(false)).toEqual(['/usr/bin/python3', 'python3', 'python', 'py'])
  expect(pythonsFor(true)).toEqual(['py', 'python', 'python3'])
})

test('knows Windows from the session, or from OS on a build that cannot say', () => {
  expect(isWindows('windows', undefined)).toBe(true)
  expect(isWindows(undefined, 'Windows_NT')).toBe(true)
  expect(isWindows('windows', 'Windows_NT')).toBe(true)
  expect(isWindows(undefined, undefined)).toBe(false)
  expect(isWindows('linux', undefined)).toBe(false)
  // WSL runs Linux: it has no OS of Windows.
  expect(isWindows('wsl', undefined)).toBe(false)
})

test('puts the sign of life where meter.py looks for it', () => {
  expect(signDir('/run/user/1000', false, undefined)).toBe('/run/user/1000/taxi-horse')
  expect(signDir(undefined, true, 'C:\\Users\\me\\AppData\\Local\\Temp')).toBe(
    'C:\\Users\\me\\AppData\\Local\\Temp/taxi-horse',
  )
  expect(signDir('/x', true, 'C:\\Temp')).toBe('/x/taxi-horse')
  // The meter's folder there is named by a uid: no sign.
  expect(signDir(undefined, false, '/tmp')).toBeUndefined()
})

test('hands the meter the transcript of this session, from the session or a classic event', () => {
  const main = { session_id: 's1', transcript_path: '/p/s1.jsonl' }
  expect(seenIn(main)).toEqual({ session: 's1', transcript: '/p/s1.jsonl' })
  // A subagent's event names its own transcript, not the session's.
  expect(seenIn({ ...main, agent_id: 'a1', transcript_path: '/p/s1/subagents/agent-a1.jsonl' })).toBeUndefined()
  expect(seenIn({ session_id: 's1', transcript_path: '' })).toBeUndefined()
  expect(seenIn({ transcript_path: '/p/s1.jsonl' })).toBeUndefined()

  const seen = seenIn(main)
  // What the session names comes first.
  expect(transcriptFor('s1', '/q/s1.jsonl', seen)).toBe('/q/s1.jsonl')
  // A build without $.session.info(): the path the event named.
  expect(transcriptFor('s1', undefined, seen)).toBe('/p/s1.jsonl')
  // After a /clear or a resume, until an event names the new one: none.
  expect(transcriptFor('s2', undefined, seen)).toBeUndefined()
  // Before the first event: none.
  expect(transcriptFor('s1', undefined, undefined)).toBeUndefined()
})

test('says on the row what went wrong, on one line', () => {
  const missing = new TypeError("$.session.info is not a function. (In '$.session.info()', '$.session.info' is undefined)")
  expect(errorLine(missing)).toBe(
    "TypeError: $.session.info is not a function. (In '$.session.info()', '$.session.info' is undefined)",
  )
  expect(errorLine(new Error('first\nsecond'))).toBe('Error: first')
  expect(errorLine('timed out')).toBe('timed out')
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
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 100000], [30, 99999]]))).toBe('🟡        🟡   🐘             💲99999')
  expect(render('run', 7, 31, '', 48, false, new Map([[30, 0.75]]))).toBe('🟡        🟡   🐘             💲0.75')
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 0], [30, 0.004], [20, 0.05]]))).toBe('🟡        🟡   🐘   💲0.05    🐾        🐾')
  expect(render('run', 7, 31, '', 48, false, new Map([[40, 0]]))).toBe('🟡        🟡   🐘                       🐾')
  expect(render('run', 7, 31)).toBe('🟡        🟡   🐘')
  // A track of 15 columns has three columns behind its last coin, at column 10.
  expect(render('run', 7, 9, '', 15, false, new Map([[10, 0.05]]))).toBe('🟡  🐘')
  expect(render('run', 7, 9, '', 15, false, new Map([[10, 0]]))).toBe('🟡  🐘    🐾')
  expect(render('run', 7, 9, '', 16, false, new Map([[10, 0.05]]))).toBe('🟡   🐘   💲0.05')
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

test('turns the lap before back into coins one coin at a time, as meter.py does', async () => {
  for (const [dist, line] of NEXT_LAP) {
    const x = animalColumn(dist)
    // On the next lap the stamp of a coin goes when the animal reaches it.
    const stamps = dist === 45 ? LEFT : new Map([...LEFT].filter(([c]) => c < x))
    expect(render('run', 7, dist, '', 48, false, stamps)).toBe(line)
  }
  // The lap starts: only the coin ahead of the animal is back.
  expect(render('run', 7, 45, '', 48, false, LEFT)).toBe('🐘        💲1.20    💲0.19    🐾        💲0.05')
  expect(render('run', 7, 46, '', 48, false, LEFT)).toBe('💲0.03    💲1.20    💲0.19    🐾        🟡    🐘')
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

test('starts the line over at home, and the fares count on', async () => {
  const ran = walk(dist => 2 + dist / 100, 20)
  expect([...ran.fares.stamps].map(([c, usd]) => [c, fare(usd)])).toEqual([[40, '0.05'], [30, '0.10']])
  expect(ran.fares.billed).toBe(2.16)
  const home = homeFares(ran.fares)
  // The picture a new session starts with, as meter.py draws it.
  expect(render('vacant', 0, 0, 'home', 48, false, home.stamps)).toBe('🟡        🟡        🟡        🟡        🟡    🏠💤')
  // What was spent since the last fare is not lost: it goes into the next one.
  expect(home.billed).toBe(ran.fares.billed)
  const next = stamped(home, animalColumn(5), animalColumn(6), 3)
  expect(fareAt(next.stamps.get(40) ?? 0, 40)).toBe('0.84')
  // The fares handed in are left alone.
  expect(ran.fares.stamps.size).toBe(2)
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
  expect(render('vacant', 7, 11, '', 48, false, new Map(), false)).toBe('🟡        🟡        🟡        🟡   🐌')
  expect(render('halt', 7, 11, '', 48, false, new Map(), false)).toBe('🟡        🟡        🟡        🟡   🐘')
  expect(render('vacant', 7, 11, 'home', 48, false, new Map(), false)).toBe('🟡        🟡        🟡        🟡   🏠')
})

test('draws an hourglass in place of the zzz while the session waits', async () => {
  // Background work still in flight, or a wakeup scheduled, as the turn ended.
  expect(waits({})).toBe(false)
  expect(waits({ background_tasks: [], session_crons: [] })).toBe(false)
  expect(waits({ background_tasks: [{ id: 'b1', type: 'shell' }] })).toBe(true)
  expect(waits({ background_tasks: [], session_crons: [{ id: 'c1' }] })).toBe(true)
  // Only between turns: a running or a standing animal is drawn as it is.
  expect(drawnPhase('vacant', true)).toBe('wait')
  expect(drawnPhase('vacant', false)).toBe('vacant')
  expect(drawnPhase('run', true)).toBe('run')
  expect(drawnPhase('halt', true)).toBe('halt')
  for (let dist = 0; dist < 100; dist += 1) {
    for (const mark of ['', 'home'] as const) {
      const asleep = render('vacant', 7, dist, mark, 48, false, STAMPS)
      const waiting = render('wait', 7, dist, mark, 48, false, STAMPS)
      // Nothing else differs: the snail, the house, the coins and the fares.
      expect(asleep).toContain('💤')
      expect(waiting).toBe(asleep.replace('💤', '⏳'))
      // It blinks as the zzz does.
      expect(render('wait', 7, dist, mark, 48, false, STAMPS, false)).toBe(
        render('vacant', 7, dist, mark, 48, false, STAMPS, false),
      )
    }
  }
  expect(render('wait', 9, 13)).toContain('🐌⏳')
  expect(render('wait', 9, 13, 'home')).toContain('🏠⏳')
  expect(animalShown('wait', 9)).toBe('🐌')
  // Asleep either way: no poof between the two, and one on waking up.
  expect(poofs({ phase: 'vacant', level: 0, mark: '' }, 'wait', 0)).toBe(false)
  expect(poofs({ phase: 'wait', level: 0, mark: '' }, 'vacant', 0)).toBe(false)
  expect(poofs({ phase: 'run', level: 7, mark: '' }, 'wait', 7)).toBe(false)
  expect(poofs({ phase: 'wait', level: 7, mark: '' }, 'run', 7)).toBe(true)
  expect(poofs({ phase: 'wait', level: 0, mark: 'home' }, 'halt', 0)).toBe(true)
  // The meter never says it.
  expect(parseLive('wait 3')).toBeUndefined()
})

const RUN_7: Live = { phase: 'run', level: 7, mark: '' }
const ASLEEP: Live = { phase: 'vacant', level: 0, mark: '' }

test('moves a running animal one column a redraw, as many redraws a second as its level', async () => {
  for (const level of [0, 1, 4, 16]) {
    const interval = Math.round(1000 / Math.max(1, level))
    let picture: Picture = NEW_PICTURE
    let now = 10_000
    for (let dist = 1; dist <= 8; dist += 1) {
      const redraw = frame(picture, { phase: 'run', level, mark: '' }, undefined, false, now)
      picture = redraw.picture
      expect([picture.dist, redraw.wait]).toEqual([dist, interval])
      expect(redraw.line).toBe(render('run', level, dist))
      now += redraw.wait
    }
    // A redraw that comes early, for a poof, moves nothing.
    const early = frame(picture, { phase: 'run', level, mark: '' }, undefined, false, now - interval + 5)
    expect([early.picture.dist, early.wait]).toEqual([8, interval - 5])
  }
  // Standing or asleep, it stays where it stands.
  const ran = frame(NEW_PICTURE, RUN_7, undefined, false, 10_000).picture
  expect(frame(ran, { phase: 'halt', level: 7, mark: '' }, undefined, false, 11_000).picture.dist).toBe(1)
  expect(frame(ran, ASLEEP, undefined, false, 11_000).picture.dist).toBe(1)
})

test('poofs for a moment as the animal wakes up, and falling asleep cuts it short', async () => {
  const asleep = frame(NEW_PICTURE, ASLEEP, undefined, false, 10_000)
  const woken = frame(asleep.picture, RUN_7, undefined, false, 10_500)
  expect(woken.line).toBe(render('run', 7, 1, '', 48, true))
  // The next column comes before the poof is over.
  expect(woken.wait).toBe(143)
  expect(frame(woken.picture, RUN_7, undefined, false, 10_643).line).toContain('💥')
  expect(frame(woken.picture, RUN_7, undefined, false, 10_900).line).toBe(render('run', 7, 2))
  expect(frame(woken.picture, ASLEEP, undefined, false, 10_600).line).not.toContain('💥')
  // The first picture has none.
  expect(frame(NEW_PICTURE, RUN_7, undefined, false, 10_000).line).not.toContain('💥')
})

test('redraws a sleeping animal as its zzz or hourglass comes and goes', async () => {
  const shown = frame(NEW_PICTURE, ASLEEP, undefined, false, 10_250)
  expect([shown.line, shown.wait]).toEqual([render('vacant', 0, 0), 750])
  const gone = frame(shown.picture, ASLEEP, undefined, false, 11_000)
  expect([gone.line, gone.wait]).toEqual([render('vacant', 0, 0, '', 48, false, new Map(), false), 1000])
  expect(frame(gone.picture, ASLEEP, undefined, true, 12_000).line).toBe(render('wait', 0, 0))
})

test('stamps the coins as it runs, as meter.py does, and starts the line over at home', async () => {
  let picture: Picture = NEW_PICTURE
  let now = 10_000
  const drawn = new Map<number, string>()
  for (let dist = 1; dist <= 54; dist += 1) {
    const redraw = frame(picture, RUN_7, 1 + dist / 100, false, now)
    picture = redraw.picture
    drawn.set(picture.dist, redraw.line)
    now += redraw.wait
  }
  for (const [dist, line] of WALKED) {
    expect(drawn.get(dist)).toBe(line)
  }
  const home = frame(picture, { phase: 'vacant', level: 0, mark: 'home' }, 1.6, false, now)
  expect([home.picture.dist, home.picture.fares.stamps.size]).toEqual([0, 0])
  expect(home.picture.fares.billed).toBe(picture.fares.billed)
  expect(home.line).toBe(render('vacant', 0, 0, 'home', 48, false, new Map(), blinkShows(now)))
})

test('keeps an even beat: a step that comes late shortens the wait for the next', async () => {
  const run4: Live = { phase: 'run', level: 4, mark: '' }
  let redraw = frame(NEW_PICTURE, run4, undefined, false, 10_000)
  expect(redraw.wait).toBe(250)
  // Each redraw 15 ms late: the steps stay on the beat of 10 000 + 250 k.
  for (let k = 1; k <= 8; k += 1) {
    redraw = frame(redraw.picture, run4, undefined, false, 10_000 + 250 * k + 15)
    expect([redraw.picture.dist, redraw.wait]).toEqual([k + 1, 235])
  }
  // Later than a whole step: the beat starts again from then, and no step is
  // made up.
  const late = frame(redraw.picture, run4, undefined, false, 10_000 + 250 * 9 + 400)
  expect([late.picture.dist, late.wait]).toEqual([10, 250])
})

test('takes a new speed level over a few steps, and starts a run at its own', async () => {
  let redraw = frame(NEW_PICTURE, { phase: 'run', level: 4, mark: '' }, undefined, false, 10_000)
  const paces: (number | undefined)[] = []
  let now = 0
  for (let k = 0; k < 9; k += 1) {
    // On the beat. The redraws for the poof of the new animal move nothing.
    now = redraw.picture.stepAt
    redraw = frame(redraw.picture, { phase: 'run', level: 12, mark: '' }, undefined, false, now)
    paces.push(redraw.picture.pace)
  }
  // Halfway to 83 ms each step, and there within a few.
  expect(paces).toEqual([166.5, 124.75, 103.875, 93.4375, 88.21875, 85.609375, 84.3046875, 83.65234375, 83])
  expect(redraw.picture.dist).toBe(10)
  // A run after a sleep starts at its own pace.
  const asleep = frame(redraw.picture, ASLEEP, undefined, false, now + 5_000)
  expect(asleep.picture.pace).toBeUndefined()
  expect(frame(asleep.picture, { phase: 'run', level: 4, mark: '' }, undefined, false, now + 6_000).wait).toBe(250)
})

test('away from the focus runs a column a second, and only the signs of work blink', async () => {
  // A level 16 animal runs a column a second, on the beat, with no poof.
  const asleep = frame(NEW_PICTURE, ASLEEP, undefined, false, 10_000, 'away')
  let redraw = frame(asleep.picture, { phase: 'run', level: 16, mark: 'fire' }, undefined, false, 10_500, 'away')
  expect([redraw.picture.dist, redraw.wait, redraw.line]).toEqual([1, 1000, render('run', 16, 1, 'fire')])
  for (let dist = 2; dist <= 4; dist += 1) {
    redraw = frame(redraw.picture, { phase: 'run', level: 16, mark: 'fire' }, undefined, false, redraw.picture.stepAt, 'away')
    expect([redraw.picture.dist, redraw.wait]).toEqual([dist, 1000])
  }
  // Back in the focus it speeds up to its own pace over a few steps.
  const waits: number[] = []
  for (let k = 0; k < 10; k += 1) {
    redraw = frame(redraw.picture, { phase: 'run', level: 16, mark: 'fire' }, undefined, false, redraw.picture.stepAt)
    waits.push(redraw.wait)
  }
  expect(waits).toEqual([532, 297, 180, 122, 92, 78, 70, 67, 65, 64])
  // The wrench and the hourglass blink; the zzz stands still, there.
  const halt: Live = { phase: 'halt', level: 7, mark: '' }
  expect(frame(NEW_PICTURE, halt, undefined, false, 10_250, 'away')).toMatchObject({ line: render('halt', 7, 0), wait: 750 })
  expect(frame(NEW_PICTURE, halt, undefined, false, 11_000, 'away').line).toBe(render('halt', 7, 0, '', 48, false, new Map(), false))
  expect(frame(NEW_PICTURE, ASLEEP, undefined, true, 11_000, 'away').line).toBe(render('wait', 0, 0, '', 48, false, new Map(), false))
  for (const now of [10_250, 11_000]) {
    expect(frame(NEW_PICTURE, ASLEEP, undefined, false, now, 'away')).toMatchObject({ line: render('vacant', 0, 0), wait: 1000 })
  }
})

test('with less motion runs a column a second, and nothing blinks or poofs', async () => {
  let picture: Picture = frame(NEW_PICTURE, ASLEEP, undefined, false, 10_000, 'less').picture
  let now = 10_500
  for (let dist = 1; dist <= 4; dist += 1) {
    const redraw = frame(picture, { phase: 'run', level: 16, mark: 'gust' }, undefined, false, now, 'less')
    expect([redraw.picture.dist, redraw.wait, redraw.line]).toEqual([dist, 1000, render('run', 16, dist, 'gust')])
    picture = redraw.picture
    now += redraw.wait
  }
  for (const at of [11_000, 12_000]) {
    expect(frame(NEW_PICTURE, { phase: 'halt', level: 3, mark: '' }, undefined, false, at, 'less').line).toBe(
      render('halt', 3, 0),
    )
  }
})

test('reads what the row says of its window, and nothing else', async () => {
  expect(sightOf({ isFocused: false, isMotionReduced: false })).toEqual({ isFocused: false, isMotionReduced: false })
  expect(sightOf({ isFocused: true, isMotionReduced: true, extra: 1 })).toEqual({ isFocused: true, isMotionReduced: true })
  for (const data of [undefined, null, 'focused', [true, false], { isFocused: 1, isMotionReduced: false }, { isFocused: true }]) {
    expect(sightOf(data)).toBeUndefined()
  }
  const cases: readonly (readonly [Parameters<typeof motionOf>[0], Motion])[] = [
    [undefined, 'full'],
    [{ isFocused: true, isMotionReduced: false }, 'full'],
    [{ isFocused: true, isMotionReduced: true }, 'less'],
    [{ isFocused: false, isMotionReduced: false }, 'away'],
    [{ isFocused: false, isMotionReduced: true }, 'less'],
  ]
  for (const [sight, motion] of cases) {
    expect(motionOf(sight)).toBe(motion)
  }
})
