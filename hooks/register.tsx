import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// The taxi_horse line, drawn by the session itself on a row of its own under
// the input box.
//
// meter.py counts the tokens. Once a second this mod runs "taxi-horse --state"
// with the session id and the transcript path, and gets back "<state> <level>"
// and, when the animal has a mark, "gust", "fire" or "home".
// The session names its transcript. A build older than $.session.info() does
// not: there the path is the one the last classic hook event of the main loop
// carried for this session, and before the first one the meter answers from
// what it has kept.
// It finds the Python to run it with by itself, and when there is none the row
// says so: a plugin has nothing that runs when it is installed, so this is
// where a missing prerequisite shows.
// Between two answers it only moves the animal: one column a redraw, and as
// many redraws a second as the speed level, so the animal never jumps. A
// statusLine command could not do that: its row is redrawn once a second at
// most. The meter is asked beside the redraws, not in their way, and the steps
// keep an even beat: one that comes late shortens the wait for the next. A
// change of speed level takes the animal to its new pace over a few steps.
//
// The row is this mod's tree at the hint line. The terminal draws it under the
// permission-mode line, which no mod can draw above. $.ui.status would pin the
// line as a notice instead, which the terminal marks with a "!".
//
// The row is drawn by row.tsx, a Client, which says what the hooks cannot
// know: whether its window has the focus, and whether the viewer asked for
// less motion. Every redraw of a session's row makes the terminal's window
// redraw, and the desktop with it, so a window without the focus is redrawn
// once a second at most, and only while its session works: there the animal
// runs a column a second, the wrench and the hourglass blink, and the zzz
// stands still, with no poof. With less motion asked for the animal runs a
// column a second, and nothing blinks or poofs.
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
// Going home starts the line over, as in a new session: the house stands at
// the right end and every coin is back. The fares count on.
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
// What stands right behind an animal asleep.
const ZZZ = '💤'
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
// version manager's shim in front of it. py is the launcher of Windows: the
// installer from python.org puts it on PATH and leaves python off by default,
// and there python3 and python may be the Store's stand-ins, which answer
// with exit status 9009.
const PYTHONS: readonly string[] = ['/usr/bin/python3', 'python3', 'python', 'py']
// The same on Windows: the launcher first, and the names a stand-in may have
// last.
const PYTHONS_WINDOWS: readonly string[] = ['py', 'python', 'python3']
// The oldest Python 3 the meter's tests pass with: 3.7. With 3.6 it counts
// nothing.
const PYTHON_MIN = 7
// Python 2 refuses -I, so it never answers this.
const PROBE = 'import sys; print(sys.version_info[0], sys.version_info[1], sys.executable)'
// How long to wait before looking for Python again when there was none.
const RETRY_MS = 30000
// How many answers in a row may be missing before the row says so.
const FAILURES_SHOWN = 3
// The key of the row's Client.
const ROW = 'taxi-horse'

// What the meter says, and "wait": between turns, with something to wait for.
export type Phase = 'run' | 'halt' | 'vacant' | 'wait'

// Whether the session waits for something, as the engine said when the last
// turn of the main loop ended. Kept in the session, not in this module: a
// reload starts the module's own variables over.
const waiting = atom({ plugin: 'taxi-horse', key: 'isWaiting' } as const, false)
export type Mark = '' | keyof typeof BEHIND | 'home'

// What the meter says: the state, the speed level and the mark.
export type Live = { phase: Phase; level: number; mark: Mark }

// What row.tsx says of where the row is drawn: whether its window has the
// focus, and whether the viewer asked for less motion.
export type Sight = { isFocused: boolean; isMotionReduced: boolean }

// How much the picture may move. full: as it always has. less: the viewer
// asked for less motion, so the animal runs a column a second, and nothing
// blinks or poofs. away: the window has not the focus, so the line is redrawn
// once a second at most, and only while the session works: the animal runs a
// column a second, the wrench and the hourglass blink, and the zzz stands
// still, with no poof. It still moves: one that stood still would look as if
// nothing were going on.
export type Motion = 'full' | 'less' | 'away'

// What the row posted, when it is a Sight: it came from code, so it is read,
// not trusted.
export function sightOf(data: unknown): Sight | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }
  const { isFocused, isMotionReduced } = data as Record<string, unknown>
  if (typeof isFocused !== 'boolean' || typeof isMotionReduced !== 'boolean') {
    return undefined
  }

  return { isFocused, isMotionReduced }
}

// The motion for what the row last said: full before it has said anything,
// and where it cannot.
export function motionOf(sight: Sight | undefined): Motion {
  if (sight === undefined) {
    return 'full'
  }

  return sight.isMotionReduced ? 'less' : sight.isFocused ? 'full' : 'away'
}

// Does what stands behind the animal blink in this state, with this motion:
// all of it with full motion, none with less, and away only the signs of
// work, the wrench and the hourglass.
function blinks(phase: Phase, motion: Motion): boolean {
  switch (motion) {
    case 'full':
      return phase !== 'run'
    case 'less':
      return false
    case 'away':
      return phase === 'halt' || phase === 'wait'
  }
}

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
  before: Live | undefined,
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

// The fares of an animal that has gone home. The line starts over, as in a new
// session: the animal at the right end, distance 0, and every coin back.
// billed stays, so what was spent since the last fare goes into the next one.
export function homeFares(fares: Fares): Fares {
  return { stamps: NO_STAMPS, billed: fares.billed }
}

// Is what blinks behind the animal, its wrench, its hourglass or its zzz,
// there at this time, or gone.
export function blinkShows(now: number): boolean {
  return Math.floor(now / BLINK_MS) % 2 === 0
}

// What stands right behind the animal: asleep its zzz, waiting its hourglass,
// standing its wrench, running the wind or fire of its mark.
function behindOf(phase: Phase, mark: Mark): string | undefined {
  switch (phase) {
    case 'vacant':
      return ZZZ
    case 'wait':
      return WAIT
    case 'halt':
      return TOOL
    case 'run':
      return mark === 'gust' || mark === 'fire' ? BEHIND[mark] : undefined
  }
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
  const behind = behindOf(phase, mark)
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

// The picture between two answers of the meter: how far the animal has run,
// when it may move its next column and how long it takes over one now, the
// state last drawn and until when the poof of its change stays, and what it
// has left in the place of the coins.
export type Picture = {
  dist: number
  stepAt: number
  pace: number | undefined
  drawn: Live | undefined
  poofUntil: number
  fares: Fares
}

export const NEW_PICTURE: Picture = {
  dist: 0,
  stepAt: 0,
  pace: undefined,
  drawn: undefined,
  poofUntil: 0,
  fares: { stamps: NO_STAMPS, billed: undefined },
}

// The time a running animal takes over a column: a second divided by its
// speed level, at least 1. With less motion, and away, a second.
export function stepMs(level: number, motion: Motion): number {
  return motion === 'full' ? Math.round(1000 / Math.max(1, level)) : 1000
}

// The pace after one more step: the step time of the speed level, reached by
// halves from the pace before it, so that a new level, or the window's focus
// coming back, speeds the animal up or slows it down over a few steps rather
// than at once. A first step, and one with less motion or away, takes the
// step time as it is.
export function paceAfter(pace: number | undefined, target: number, motion: Motion): number {
  if (pace === undefined || motion !== 'full' || Math.abs(target - pace) < 1) {
    return target
  }

  return pace + (target - pace) / 2
}

// One redraw at time now, for what the meter said last: the picture after it,
// the line, and how long to wait for the next redraw. usd is what the session
// has cost so far, undefined when the engine does not say. motion: how much
// the picture may move (see Motion).
//
// A running animal moves one column a redraw, at its pace. The steps keep an
// even beat: one that comes late shortens the wait for the next, unless it
// came later than a whole step. A redraw that comes early, for a poof, moves
// nothing. The wrench, the hourglass and a zzz are redrawn as they come and go.
export function frame(
  picture: Picture,
  live: Live,
  usd: number | undefined,
  isWaiting: boolean,
  now: number,
  motion: Motion = 'full',
): { picture: Picture; line: string; wait: number } {
  const { level, mark } = live
  const phase = drawnPhase(live.phase, isWaiting)
  const isFull = motion === 'full'
  let { dist, stepAt, pace, poofUntil, fares } = picture
  if (mark === 'home') {
    dist = 0
    fares = homeFares(fares)
  }
  let wait = IDLE_MS
  if (phase !== 'run') {
    // A pace is the run's: the next run starts at its own.
    pace = undefined
  } else {
    if (now >= stepAt - MIN_WAIT_MS) {
      const before = animalColumn(dist)
      dist += 1
      fares = stamped(fares, before, animalColumn(dist), usd)
      pace = paceAfter(pace, stepMs(level, motion), motion)
      stepAt = stepAt + pace > now ? stepAt + pace : now + pace
    }
    wait = stepAt - now
  }
  if (isFull && poofs(picture.drawn, phase, level, mark)) {
    poofUntil = now + POOF_MS
  }
  // Falling asleep cuts a poof short, and so does less motion or away.
  const isChanging = isFull && !isAsleep(phase, mark) && now < poofUntil
  if (isChanging) {
    wait = Math.min(wait, poofUntil - now)
  }
  // What does not blink stands still, there.
  const isBlinking = blinks(phase, motion)
  if (isBlinking) {
    wait = Math.min(wait, BLINK_MS - (now % BLINK_MS))
  }
  const hasBlink = isBlinking ? blinkShows(now) : true
  const line = render(phase, level, dist, mark, TRACK, isChanging, fares.stamps, hasBlink)

  return {
    picture: { dist, stepAt, pace, drawn: { phase, level, mark }, poofUntil, fares },
    line,
    wait: Math.max(MIN_WAIT_MS, Math.round(wait)),
  }
}

export function parseLive(text: string): Live | undefined {
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

// The folder of the sign of life, as meter.py's state_dir() has it:
// $XDG_RUNTIME_DIR/taxi-horse, or on Windows %TEMP%/taxi-horse. Elsewhere,
// without $XDG_RUNTIME_DIR, there is none: the meter names its folder by a uid
// that the mod cannot read.
export function signDir(
  runtime: string | undefined,
  isWindows: boolean,
  temp: string | undefined,
): string | undefined {
  const base = runtime ?? (isWindows ? temp : undefined)

  return base === undefined ? undefined : `${base}/taxi-horse`
}

// Does the engine run on Windows: as the session says, or, on a build too old
// to say, as Windows itself sets OS.
export function isWindows(platform: string | undefined, os: string | undefined): boolean {
  return platform === 'windows' || os === 'Windows_NT'
}

// Where to look for Python, in the order tried.
export function pythonsFor(isWindows: boolean): readonly string[] {
  return isWindows ? PYTHONS_WINDOWS : PYTHONS
}

// A session's transcript, as a classic hook event named it.
export type Seen = { session: string; transcript: string }

// What a classic hook event says of its session's transcript: nothing when it
// comes from a subagent, whose transcript is not the session's.
export function seenIn(e: { session_id?: string; transcript_path?: string; agent_id?: string }): Seen | undefined {
  if (e.agent_id !== undefined || !e.session_id || !e.transcript_path) {
    return undefined
  }

  return { session: e.session_id, transcript: e.transcript_path }
}

// The transcript to hand the meter: the one the session names, or, where the
// build cannot name it, the one a classic event named for this same session.
// A path seen for another session, before a /clear or a resume, is not this
// one's.
export function transcriptFor(session: string, named: string | undefined, seen: Seen | undefined): string | undefined {
  if (named !== undefined) {
    return named
  }

  return seen?.session === session ? seen.transcript : undefined
}

// What the row says when the meter could not be asked: the error's first line.
export function errorLine(error: unknown): string {
  return String(error).trim().split('\n')[0]?.trim() ?? ''
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
  // The transcript the last classic event of the main loop named.
  let seen: Seen | undefined
  const see = (e: Parameters<typeof seenIn>[0]): void => {
    seen = seenIn(e) ?? seen
  }
  // What the row's Client last said of where it is drawn. Undefined until it
  // has said it, and after it failed: the row is plain text from then on.
  let sight: Sight | undefined
  let isClientBroken = false
  // A redraw now, in place of the one waited for, once the session draws.
  let redrawNow = (): void => {}

  // Named one by one, not as classic.*: that would bring every tool call's
  // PreToolUse and PostToolUse here too.
  on('classic.SessionStart', async ($, e, next) => {
    see(e)

    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    see(e)

    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    see(e)
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

  on('ui.message', async ($, e, next) => {
    const told = e.element === ROW ? sightOf(e.data) : undefined
    if (told !== undefined && !isClientBroken) {
      sight = told
      redrawNow()
    }

    return next(e)
  })

  on('ui.fault', async ($, e, next) => {
    if (e.element === ROW && !isClientBroken) {
      isClientBroken = true
      sight = undefined
      $.ui.invalidate('ui.render')
      redrawNow()
    }

    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    if (shown === undefined) {
      return hint
    }
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    // A surface or a build without Client, or one whose Client failed, draws
    // plain text.
    const Client = 'Client' in elements ? elements.Client : undefined
    const row =
      Client === undefined || isClientBroken ? (
        <Text>{shown}</Text>
      ) : (
        <Client key={ROW} module="./row.tsx" props={{ line: shown }} />
      )

    return (
      <Box flexDirection="column">
        {row}
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
    let platform: string | undefined
    try {
      platform = (await $.session.info()).platform
    } catch {
      // A build without $.session.info(): OS says it.
    }
    const windows = isWindows(platform, await $.env.get('OS'))
    const pythons = pythonsFor(windows)
    const signs = signDir(await $.env.get('XDG_RUNTIME_DIR'), windows, await $.env.get('TEMP'))
    const self = Math.floor(Math.random() * 1e9)
    // What the meter said last. Undefined while there is no picture to draw:
    // before its first answer, after a failed one, and while a twin draws.
    let live: Live | undefined
    let picture = NEW_PICTURE
    // What the session has cost so far, when the engine says.
    let usd: number | undefined
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
      try {
        const session = await $.session.id()
        if (signs !== undefined && (await standsBack(`${signs}/${session}.mod`, now))) {
          live = undefined
          problem = undefined

          return
        }
        if (python === undefined) {
          if (now - probedAt < RETRY_MS) {
            return
          }
          probedAt = now
          const found = await findPython(argv => $.process.run([...argv], { timeoutMs: 5000 }), pythons)
          if ('problem' in found) {
            live = undefined
            problem = found.problem

            return
          }
          python = found.path
        }
        let named: string | undefined
        try {
          named = (await $.session.info()).transcriptPath
        } catch {
          // A build without $.session.info(): the classic events name it.
        }
        // The launcher is run by the Python found, not through its first line:
        // that one takes whatever python3 is first on PATH.
        const { exitCode, stdout, stderr } = await $.process.run([python, '-IS', meter, '--state'], {
          stdin: JSON.stringify({ session_id: session, transcript_path: transcriptFor(session, named, seen) }),
          timeoutMs: 5000,
        })
        const answer = exitCode === 0 ? parseLive(stdout) : undefined
        if (answer === undefined) {
          live = undefined
          failures += 1
          if (failures >= FAILURES_SHOWN) {
            problem = `taxi-horse: ${lastLine(stderr) || `the meter exited with status ${exitCode}`}`
          }

          return
        }
        failures = 0
        problem = undefined
        usd = await costSoFar()
        live = answer
      } catch (error) {
        // The meter did not start or did not finish, or the engine lacks a
        // call made here. After a few times in a row the row says why, and
        // the mod looks for Python again: it may have moved.
        live = undefined
        failures += 1
        if (failures >= FAILURES_SHOWN) {
          failures = 0
          python = undefined
          problem = `taxi-horse: ${errorLine(error)}`
        }
      }
    }

    // The redraws, one after the other: each draws the picture of its moment
    // and waits as long as it says. A redraw asked for meanwhile takes the
    // place of the one waited for: beat counts them, and an older one stops.
    let beat = 0
    const tick = async (mine: number): Promise<void> => {
      let wait = IDLE_MS
      try {
        const now = await $.clock.now()
        if (mine !== beat) {
          return
        }
        let line = problem
        if (live !== undefined) {
          const redraw = frame(picture, live, usd, isWaiting, now, motionOf(sight))
          picture = redraw.picture
          line = redraw.line
          wait = redraw.wait
        }
        if (line !== shown) {
          shown = line
          $.ui.invalidate('ui.render')
        }
      } finally {
        if (mine === beat) {
          $.clock.after(wait, () => void tick(mine))
        }
      }
    }
    redrawNow = () => {
      beat += 1
      void tick(beat)
    }

    // The meter is asked once a second beside the redraws: none of them waits
    // for its answer. The answer is drawn as it comes.
    const ask = async (): Promise<void> => {
      try {
        await poll(await $.clock.now())
        redrawNow()
      } finally {
        $.clock.after(POLL_MS, () => void ask())
      }
    }

    redrawNow()
    void ask()

    return started
  })
}
