import type { Register } from 'claude-code'

// The taxi_horse line, drawn by the session itself on a row of its own under
// the input box.
//
// meter.py counts the tokens. Once a second this mod runs "taxi-horse --state"
// with the session id and the transcript path, and gets back "<state> <level>".
// It finds the Python to run it with by itself, and when there is none the row
// says so: a plugin has nothing that runs when it is installed, so this is
// where a missing prerequisite shows.
// Between two answers it only moves the animal: one column a redraw, and as
// many redraws a second as the speed level, so the animal never jumps. A
// statusLine command could not do that: its row is redrawn once a second at
// most.
//
// The row is this mod's tree at the hint line. The terminal draws it under the
// permission-mode line, which no mod can draw above. $.ui.status would pin the
// line as a notice instead, which the terminal marks with a "!".
//
// The picture is meter.py's render(): keep the two the same.

const TRACK = 40
const COIN = '🪙'
// What a coin turns into once the animal has passed it.
const EATEN = '💲'
const COIN_GAP = 8
// One animal for each speed level, 0 to 16, slowest first.
const ANIMALS: readonly string[] = [...'🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅']
const POLL_MS = 1000
const IDLE_MS = 1000
// How long a sign of life of another copy of this mod counts for.
const TWIN_FRESH_MS = 2500
// Where Python may be, in the order tried. The system's comes first: it has no
// version manager's shim in front of it.
const PYTHONS: readonly string[] = ['/usr/bin/python3', 'python3', 'python']
// The oldest Python 3 the meter's tests pass with: 3.7. With 3.6 it counts
// nothing.
const PYTHON_MIN = 7
// Python 2 refuses -I, so it never answers this.
const PROBE = 'import sys; print(sys.version_info[0], sys.version_info[1], sys.executable)'
// How long to wait before looking for Python again when there was none.
const RETRY_MS = 30000
// How many answers in a row may be missing before the row says so.
const FAILURES_SHOWN = 3

export type Phase = 'run' | 'halt' | 'vacant'

export function animal(level: number): string {
  const index = Math.min(ANIMALS.length - 1, Math.max(0, Math.floor(level)))

  return ANIMALS[index] ?? '🐌'
}

// Left column of the animal: from width-2 down to 2, then 0, onto the last coin.
export function animalColumn(dist: number, width: number = TRACK): number {
  const lap = width - 2
  const pos = Math.floor(dist) % lap

  return pos === lap - 1 ? 0 : width - 2 - pos
}

export function render(
  phase: Phase,
  level: number,
  dist: number,
  width: number = TRACK,
): string {
  const x = animalColumn(dist, width)
  // Two-column glyphs by their left column. The animal and its zzz come first:
  // a coin or a dollar sign they would overlap is left out. Whatever it was,
  // the animal sleeps as a snail.
  const glyphs = new Map<number, string>([[x, animal(phase === 'vacant' ? 0 : level)]])
  if (phase === 'vacant') {
    glyphs.set(x + 2, '💤')
  }
  const taken = [...glyphs.keys()]
  for (let c = 0; c < width - 4; c += COIN_GAP) {
    if (!taken.some(col => Math.abs(c - col) < 2)) {
      glyphs.set(c, c < x ? COIN : EATEN)
    }
  }
  const end = Math.max(width, Math.max(...glyphs.keys()) + 2)
  let line = ''
  for (let col = 0; col < end; ) {
    const glyph = glyphs.get(col)
    line += glyph ?? ' '
    col += glyph === undefined ? 1 : 2
  }

  return line.replace(/ +$/, '')
}

export function parseLive(text: string): { phase: Phase; level: number } | undefined {
  const [phase, level] = text.trim().split(' ')
  const n = Number(level)
  if ((phase !== 'run' && phase !== 'halt' && phase !== 'vacant') || !Number.isInteger(n)) {
    return undefined
  }

  return { phase, level: n }
}

// Runs a program and resolves with what it wrote and its exit status; rejects
// when the program does not start.
export type Run = (argv: readonly string[]) => Promise<{ exitCode: number; stdout: string }>

export function parseProbe(text: string): { major: number; minor: number; path: string } | undefined {
  const [major, minor, ...path] = text.trim().split(' ')
  const version = [Number(major), Number(minor)]
  if (major === undefined || minor === undefined || !version.every(Number.isInteger)) {
    return undefined
  }

  return { major: Number(major), minor: Number(minor), path: path.join(' ') }
}

// The Python to run the meter with: the first of the candidates that is
// Python 3.7 or newer, by the path it gives for itself. Without one, the line
// to show instead of the picture.
export async function findPython(
  run: Run,
  candidates: readonly string[] = PYTHONS,
): Promise<{ path: string } | { problem: string }> {
  let old: string | undefined
  for (const candidate of candidates) {
    let answer: ReturnType<typeof parseProbe>
    try {
      const { exitCode, stdout } = await run([candidate, '-IS', '-c', PROBE])
      answer = exitCode === 0 ? parseProbe(stdout) : undefined
    } catch {
      continue
    }
    if (answer === undefined) {
      continue
    }
    if (answer.major === 3 && answer.minor >= PYTHON_MIN) {
      return { path: answer.path === '' ? candidate : answer.path }
    }
    old ??= `${answer.major}.${answer.minor}`
  }
  const found = old === undefined ? 'python3 not found' : `found ${old}`

  return { problem: `taxi-horse needs Python 3.${PYTHON_MIN} or newer: ${found}` }
}

// The last line of what a failed meter wrote: the error, under its traceback.
export function lastLine(text: string): string {
  return text.trim().split('\n').pop()?.trim() ?? ''
}

export const register: Register = on => {
  // What is drawn now: the picture, or why there is none. Undefined until the
  // meter has answered.
  let shown: string | undefined

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    if (shown === undefined) {
      return hint
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>{shown}</Text>
        {hint}
      </Box>
    )
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (!e.isInteractive) {
      return started
    }

    const meter = `${$.plugin.root}/taxi-horse`
    const runtime = await $.env.get('XDG_RUNTIME_DIR')
    const self = Math.floor(Math.random() * 1e9)
    let phase: Phase = 'vacant'
    let level = 0
    let dist = 0
    let polledAt = 0
    let isDrawing = false
    // The Python found, and what the row says when the picture cannot be drawn.
    let python: string | undefined
    let problem: string | undefined
    let probedAt = -RETRY_MS
    let failures = 0

    // The sign of life: <session>.mod, signed with this copy's number. A
    // statusLine command of taxi-horse prints nothing while it is fresh, and
    // of two copies of this mod the one with the larger number stands back.
    const standsBack = async (sign: string, now: number): Promise<boolean> => {
      try {
        const [at, other] = (await $.fs.read(sign)).split(' ').map(Number)
        if (at !== undefined && other !== undefined && other < self && now - at < TWIN_FRESH_MS) {
          return true
        }
      } catch {
        // no sign yet
      }
      await $.fs.write(sign, `${now} ${self}`)

      return false
    }

    const poll = async (now: number): Promise<void> => {
      polledAt = now
      try {
        const session = await $.session.id()
        if (runtime !== undefined && (await standsBack(`${runtime}/taxi-horse/${session}.mod`, now))) {
          isDrawing = false
          problem = undefined

          return
        }
        if (python === undefined) {
          if (now - probedAt < RETRY_MS) {
            return
          }
          probedAt = now
          const found = await findPython(argv => $.process.run([...argv], { timeoutMs: 5000 }))
          if ('problem' in found) {
            isDrawing = false
            problem = found.problem

            return
          }
          python = found.path
        }
        const { transcriptPath } = await $.session.info()
        // The launcher is run by the Python found, not through its first line:
        // that one takes whatever python3 is first on PATH.
        const { exitCode, stdout, stderr } = await $.process.run([python, '-IS', meter, '--state'], {
          stdin: JSON.stringify({ session_id: session, transcript_path: transcriptPath }),
          timeoutMs: 5000,
        })
        const live = exitCode === 0 ? parseLive(stdout) : undefined
        if (live === undefined) {
          isDrawing = false
          failures += 1
          if (failures >= FAILURES_SHOWN) {
            problem = `taxi-horse: ${lastLine(stderr) || `the meter exited with status ${exitCode}`}`
          }

          return
        }
        failures = 0
        problem = undefined
        phase = live.phase
        level = live.level
        isDrawing = true
      } catch {
        // The meter did not start or did not finish. After a few times in a
        // row, look for Python again: it may have moved.
        isDrawing = false
        failures += 1
        if (failures >= FAILURES_SHOWN) {
          failures = 0
          python = undefined
        }
      }
    }

    const tick = async (): Promise<void> => {
      let wait = IDLE_MS
      try {
        const now = await $.clock.now()
        if (now - polledAt >= POLL_MS) {
          await poll(now)
        }
        if (isDrawing && phase === 'run') {
          dist += 1
          wait = Math.round(1000 / Math.max(1, level))
        }
        const line = isDrawing ? render(phase, level, dist) : problem
        if (line !== shown) {
          shown = line
          $.ui.invalidate('ui.render')
        }
      } finally {
        $.clock.after(wait, () => void tick())
      }
    }

    void tick()

    return started
  })
}
