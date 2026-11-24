import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// The taxi_horse line, drawn by the session itself on a row of its own under
// the input box.
//
// meter.py counts the tokens. Once a second this mod runs "taxi-horse --state"
// with the session id and the transcript path, and gets back "<state> <level>"
// and, when the animal has a mark, "gust", "fire" or "home".
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
// The picture is meter.py's render(): keep the two the same. Two things are
// this mod's alone. When the animal changes into another, or wakes up, a poof
// is drawn in its place for POOF_MS. Falling asleep and going home have none.
// A status line, redrawn once a second, has no frame that short.
//
// The other is the hourglass. When a turn ends, the engine says what the
// session still waits for: background work in flight, and wakeups it has
// scheduled. While there is any, an hourglass stands in place of the zzz
// between turns. meter.py reads the transcript alone and draws the zzz.
// The engine says it once, so the session keeps the answer ($.state): a copy
// of this mod that a reload has just loaded reads it there.
//
// The wrench of a standing animal, the hourglass and every zzz blink:
// BLINK_MS there, BLINK_MS gone.
//
// The fare behind a dollar sign is what the session has cost, in US dollars,
// since the fare before it. A stretch of less than half a cent leaves paw
// prints in the coin's place. The mod asks the session for its cost once a second:
// meter.py has it only from a status line's input.

const TRACK = 48
const COIN = '🪙'
// What stands in an eaten coin's place, in front of its fare.
const EATEN = '💲'
// What stands there when the stretch has cost less than half a cent.
const PRINTS = '🐾'
const COIN_GAP = 10
// Columns ahead of the animal at which what it left turns back into a coin.
const REFILL = (COIN_GAP * 3) / 2
// Characters of a fare at most: it ends well before the next coin.
const FARE_MAX = 5
const NO_STAMPS: ReadonlyMap<number, number> = new Map()
// One animal for each speed level, 0 to 16, slowest first.
const ANIMALS: readonly string[] = [...'🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅']
// What a mark draws right behind a running animal: wind when it has just sped
// up, fire when that is to a great speed.
const BEHIND = { gust: '💨', fire: '🔥' } as const
// What stands right behind an animal that stands while its tools run: it is
// not asleep, a tool is at work.
const TOOL = '🔧'
// What stands in place of the zzz between turns while the session waits for
// something.
const WAIT = '⏳'
// What stands in place of an animal that is at home: no turn is on and the
// average speed is 0 too.
const HOUSE = '🏠'
// What is drawn in place of the animal while it changes into another or wakes
// up.
const POOF = '💥'
const POOF_MS = 400
// The shortest wait between two redraws.
const MIN_WAIT_MS = 20
const POLL_MS = 1000
const IDLE_MS = 1000
// How long the wrench, the hourglass or a zzz is there, and how long it is
// gone, as it blinks.
const BLINK_MS = 1000
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

// What the meter says, and "wait": between turns, with something to wait for.
export type Phase = 'run' | 'halt' | 'vacant' | 'wait'

// Whether the session waits for something, as the engine said when the last
// turn of the main loop ended. Kept in the session, not in this module: a
// reload starts the module's own variables over.
const waiting = atom({ plugin: 'taxi-horse', key: 'isWaiting' } as const, false)
export type Mark = '' | keyof typeof BEHIND | 'home'

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

// The animal drawn for a state: whatever it was, it sleeps as a snail, and
// waits as one.
export function animalShown(phase: Phase, level: number): string {
  return animal(phase === 'vacant' || phase === 'wait' ? 0 : level)
}

// Asleep: between turns, or at home. An animal that waits is asleep as well:
// only what stands behind it differs.
export function isAsleep(phase: Phase, mark: Mark): boolean {
  return phase === 'vacant' || phase === 'wait' || mark === 'home'
}

// Does the session wait for something as a turn ends: background work still
// in flight, or a wakeup it has scheduled. From what the engine says at Stop.
export function waits(stop: { background_tasks?: readonly unknown[]; session_crons?: readonly unknown[] }): boolean {
  return (stop.background_tasks?.length ?? 0) + (stop.session_crons?.length ?? 0) > 0
}

// The state drawn for what the meter says: between turns, a session with
// something to wait for waits.
export function drawnPhase(phase: Phase, isWaiting: boolean): Phase {
  return phase === 'vacant' && isWaiting ? 'wait' : phase
}

// Does going from what was drawn to this state take a poof: waking up, and
// changing into another animal while awake. Falling asleep and going home do
// not, and neither does the first picture.
export function poofs(
  before: { phase: Phase; level: number; mark: Mark } | undefined,
  phase: Phase,
  level: number,
  mark: Mark = '',
): boolean {
  if (before === undefined || isAsleep(phase, mark)) {
    return false
  }

  return isAsleep(before.phase, before.mark) || animal(before.level) !== animal(level)
}

// An amount as the digits behind a dollar sign: as many decimals, two at most,
// as fit in FARE_MAX characters. Halves round up, as in meter.py. An amount
// of less than half a cent has no fare.
export function fare(usd: number): string {
  if (Math.floor(usd * 100 + 0.5) < 1) {
    return ''
  }
  let text = ''
  for (const digits of [2, 1, 0]) {
    const unit = 10 ** digits
    const n = Math.floor(usd * unit + 0.5)
    text = digits === 0 ? `${n}` : `${Math.floor(n / unit)}.${String(n % unit).padStart(digits, '0')}`
    if (text.length <= FARE_MAX) {
      break
    }
  }

  return text
}

// The fare drawn for an amount behind a dollar sign at column c: none when the
// amount has none, or it does not fit before the next dollar sign and on the
// track.
export function fareAt(usd: number, c: number, width: number = TRACK): string {
  const text = fare(usd)

  return text.length <= Math.min(FARE_MAX, width - c - 2) ? text : ''
}

// Left column of every coin of a lap.
function coinColumns(width: number): number[] {
  const columns: number[] = []
  for (let c = 0; c < width - 4; c += COIN_GAP) {
    columns.push(c)
  }

  return columns
}

export type Fares = {
  // What the animal has left in the place of each coin, the amount by coin
  // column: behind it on this lap, ahead of it on the lap before.
  stamps: ReadonlyMap<number, number>
  // The cost up to which fares have been stamped. Undefined before the first
  // reading of it.
  billed: number | undefined
}

// The fares after the animal has moved from column before to column x. usd is
// the session's cost so far, undefined when it is not known.
//
// A coin the animal has reached on the way loses the stamp of the lap before
// and is stamped with what the session has cost since billed. When that makes
// a fare that is drawn, it is billed. An amount that makes none stays unbilled
// and goes into the next fare: one of less than half a cent is still stamped,
// for its paw prints, and one whose fare does not fit is not. The coin at the left
// end is stamped as the others: the lap ends on it, so what it leaves shows on
// the next lap.
export function stamped(
  fares: Fares,
  before: number,
  x: number,
  usd: number | undefined,
  width: number = TRACK,
): Fares {
  let stamps = fares.stamps
  let billed = fares.billed
  if (usd !== undefined && (billed === undefined || usd < billed)) {
    // The first reading, or the cost has started over.
    billed = usd
  }
  for (const c of coinColumns(width).reverse()) {
    if (!(x <= c && c < before)) {
      continue
    }
    const next = new Map(stamps)
    next.delete(c)
    stamps = next
    if (usd === undefined || billed === undefined) {
      continue
    }
    const amount = usd - billed
    if (fareAt(amount, c, width) !== '') {
      next.set(c, amount)
      billed = usd
    } else if (fare(amount) === '') {
      next.set(c, amount)
    }
  }

  return { stamps, billed }
}

// Is what blinks behind the animal, its wrench, its hourglass or its zzz,
// there at this time, or gone.
export function blinkShows(now: number): boolean {
  return Math.floor(now / BLINK_MS) % 2 === 0
}

// stamps: an eaten coin at such a column leaves a dollar sign and the fare of
// that amount (see fareAt()), or paw prints when the amount is less than half
// a cent. Any other eaten coin leaves nothing.
//
// A stamp ahead of the animal is what it left there on the lap before. It
// stays in the coin's place until the animal is REFILL columns away, so the
// lap before turns back into coins one coin at a time. That is halfway between
// two coins: nothing else on the line changes at that moment.
//
// hasBlink: false while the wrench, the hourglass or the zzz is gone, as it
// blinks. Its place stays empty: what it hides does not come back meanwhile.
export function render(
  phase: Phase,
  level: number,
  dist: number,
  mark: Mark = '',
  width: number = TRACK,
  isChanging: boolean = false,
  stamps: ReadonlyMap<number, number> = NO_STAMPS,
  hasBlink: boolean = true,
): string {
  const x = animalColumn(dist, width)
  // Two-column glyphs by their left column. The animal and what is right
  // behind it come first: a coin or a fare they would overlap is left out.
  // While the animal changes there is only the poof.
  const standing = mark === 'home' ? HOUSE : animalShown(phase, level)
  const glyphs = new Map<number, string>([[x, isChanging ? POOF : standing]])
  // Asleep its zzz, waiting its hourglass, standing its wrench, running the
  // wind or fire of its mark.
  const behind =
    phase === 'vacant'
      ? '💤'
      : phase === 'wait'
        ? WAIT
        : phase === 'halt'
          ? TOOL
          : mark === '' || mark === 'home'
            ? undefined
            : BEHIND[mark]
  if (behind !== undefined && !isChanging) {
    glyphs.set(x + 2, hasBlink || phase === 'run' ? behind : '  ')
  }
  const taken = [...glyphs.keys()]
  // One-column characters by their first column.
  const fares = new Map<number, string>()
  for (const c of coinColumns(width)) {
    if (taken.some(col => Math.abs(c - col) < 2)) {
      continue
    }
    const usd = stamps.get(c)
    if (c < x && !(usd !== undefined && x > c + REFILL)) {
      glyphs.set(c, COIN)
      continue
    }
    const text = usd === undefined ? '' : fareAt(usd, c, width)
    if (text !== '') {
      glyphs.set(c, EATEN)
      fares.set(c + 2, text)
    } else if (usd !== undefined && fare(usd) === '') {
      glyphs.set(c, PRINTS)
    }
  }
  const end = Math.max(width, Math.max(...glyphs.keys()) + 2)
  let line = ''
  for (let col = 0; col < end; ) {
    const glyph = glyphs.get(col)
    const text = glyph === undefined ? fares.get(col) : undefined
    line += glyph ?? text ?? ' '
    col += glyph !== undefined ? 2 : (text?.length ?? 1)
  }

  return line.replace(/ +$/, '')
}

export function parseLive(text: string): { phase: Phase; level: number; mark: Mark } | undefined {
  const [phase, level, mark] = text.trim().split(' ')
  const n = Number(level)
  if ((phase !== 'run' && phase !== 'halt' && phase !== 'vacant') || !Number.isInteger(n)) {
    return undefined
  }

  // A mark this copy does not know is left out, not refused.
  const known = mark === 'gust' || mark === 'fire' || mark === 'home'

  return { phase, level: n, mark: known ? mark : '' }
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
  // What the session keeps as "waiting", as this copy last wrote or read it.
  // It stands until the next turn ends.
  let isWaiting = false

  on('classic.Stop', async ($, e, next) => {
    if (e.agent_id === undefined) {
      isWaiting = waits(e)
      try {
        await update($, waiting, () => isWaiting)
      } catch {
        // An engine that keeps no state: this copy alone knows.
      }
    }

    return next(e)
  })

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

    try {
      // What a copy before this one was told, when a reload has loaded this one.
      isWaiting = await read($, waiting)
    } catch {
      // nothing kept
    }
    const meter = `${$.plugin.root}/taxi-horse`
    const runtime = await $.env.get('XDG_RUNTIME_DIR')
    const self = Math.floor(Math.random() * 1e9)
    let phase: Phase = 'vacant'
    let level = 0
    let mark: Mark = ''
    let dist = 0
    // When the animal may move its next column, the state last drawn, and
    // until when the poof of its change stays.
    let stepAt = 0
    let drawn: { phase: Phase; level: number; mark: Mark } | undefined
    let poofUntil = 0
    // What the session has cost so far, when the engine says, and what the
    // animal has left in the place of the coins.
    let usd: number | undefined
    let fares: Fares = { stamps: NO_STAMPS, billed: undefined }
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

    // The cost as /cost totals it. An engine that keeps no such figure, or is
    // too old to be asked, leaves no dollar sign.
    const costSoFar = async (): Promise<number | undefined> => {
      try {
        const cost = (await $.session.usage()).cost?.usd

        return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined
      } catch {
        return undefined
      }
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
        mark = live.mark
        usd = await costSoFar()
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
          // A redraw that comes early, for a poof, moves nothing.
          if (now >= stepAt - MIN_WAIT_MS) {
            const before = animalColumn(dist)
            dist += 1
            fares = stamped(fares, before, animalColumn(dist), usd)
            stepAt = now + Math.round(1000 / Math.max(1, level))
          }
          wait = stepAt - now
        }
        const seen = drawnPhase(phase, isWaiting)
        if (isDrawing) {
          if (poofs(drawn, seen, level, mark)) {
            poofUntil = now + POOF_MS
          }
          drawn = { phase: seen, level, mark }
        }
        // Falling asleep cuts a poof short.
        const isChanging = isDrawing && !isAsleep(seen, mark) && now < poofUntil
        if (isChanging) {
          wait = Math.min(wait, poofUntil - now)
        }
        // The wrench, the hourglass and a zzz are redrawn as they come and go.
        const hasBlink = blinkShows(now)
        if (isDrawing && seen !== 'run') {
          wait = Math.min(wait, BLINK_MS - (now % BLINK_MS))
        }
        wait = Math.max(MIN_WAIT_MS, wait)
        const line = isDrawing
          ? render(seen, level, dist, mark, TRACK, isChanging, fares.stamps, hasBlink)
          : problem
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
