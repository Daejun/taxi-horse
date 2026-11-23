import type { Register } from 'claude-code'

// The taxi_horse line, drawn under the prompt by the session itself.
//
// meter.py, the statusLine command, counts the tokens: once a second it leaves
// "<state> <level>" in <session>.live. The status line cannot be redrawn more
// than once a second, so this mod does the drawing instead: the animal moves
// one column a redraw, and it is redrawn as many times a second as its speed
// level. While this mod's <session>.mod file is fresh, meter.py prints nothing.
//
// The line goes at the end of the hint line under the prompt. $.ui.status would
// pin it as a notice, which the terminal marks with a "!".
//
// The picture is meter.py's render(): keep the two the same.

const TRACK = 40
const COIN = '🪙'
const COIN_GAP = 8
// One animal for each speed level, 0 to 16, slowest first.
const ANIMALS: readonly string[] = [...'🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅']
const POLL_MS = 1000
const IDLE_MS = 1000
// Two copies of this mod can be loaded in one session (the installed one and
// one under development). Each signs <session>.mod with its own number, and
// the one with the larger number leaves the drawing to the other.
const TWIN_FRESH_MS = 2500

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
  const cells: string[] = new Array<string>(width).fill(' ')
  const x = animalColumn(dist, width)
  for (let c = 0; c < width - 4; c += COIN_GAP) {
    if (c + 1 < x) {
      cells[c] = COIN
      cells[c + 1] = ''
    }
  }
  cells[x] = animal(level)
  cells[x + 1] = ''
  if (phase === 'vacant') {
    cells[x + 2] = '💤'
    cells[x + 3] = ''
  }

  return cells.join('').replace(/ +$/, '')
}

export function parseLive(text: string): { phase: Phase; level: number } | undefined {
  const [phase, level] = text.trim().split(' ')
  const n = Number(level)
  if ((phase !== 'run' && phase !== 'halt' && phase !== 'vacant') || !Number.isInteger(n)) {
    return undefined
  }

  return { phase, level: n }
}

export const register: Register = on => {
  // What is drawn now; undefined while meter.py draws the line itself.
  let shown: string | undefined

  on('ui.render', { component: 'PromptHint' }, ($, e, next) =>
    shown === undefined ? next(e) : next({ ...e, props: { ...e.props, tail: `  ${shown}` } }),
  )

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const runtime = await $.env.get('XDG_RUNTIME_DIR')
    if (!e.isInteractive || runtime === undefined) {
      return started
    }

    // An earlier version of this mod pinned the line with $.ui.status.
    $.ui.status(undefined)

    const base = `${runtime}/taxi-horse/${await $.session.id()}`
    let phase: Phase = 'vacant'
    let level = 0
    let dist = 0
    let polledAt = 0
    let isDrawing = false
    const self = Math.floor(Math.random() * 1e9)

    const hasSmallerTwin = async (now: number): Promise<boolean> => {
      try {
        const [at, other] = (await $.fs.read(`${base}.mod`)).split(' ').map(Number)

        return (
          at !== undefined && other !== undefined && other < self && now - at < TWIN_FRESH_MS
        )
      } catch {
        return false
      }
    }

    try {
      // Go on from where meter.py's animal stands.
      dist = Number((await $.fs.read(`${base}.run`)).split(' ')[0]) || 0
    } catch {
      dist = 0
    }

    const poll = async (now: number): Promise<void> => {
      polledAt = now
      try {
        const live = parseLive(await $.fs.read(`${base}.live`))
        if (live === undefined) throw new Error('unreadable')
        phase = live.phase
        level = live.level
        if (await hasSmallerTwin(now)) {
          isDrawing = false

          return
        }
        await $.fs.write(`${base}.mod`, `${now} ${self}`)
        isDrawing = true
      } catch {
        // No meter in this session, or no way to tell it this mod is drawing:
        // leave the line to meter.py.
        isDrawing = false
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
        const line = isDrawing ? render(phase, level, dist) : undefined
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
