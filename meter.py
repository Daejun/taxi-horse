"""taxi_horse: shows how fast a Claude Code session burns tokens, as a running animal.

This is the counting half. There are two ways to run it.

With the mod (the plugin this file ships in): the mod runs
"taxi-horse --state" once a second, with the session id and the transcript
path as JSON on stdin, gets back "<state> <level>", with a third word when
something goes behind the animal ("gust", "fire" or "doze"), and draws the
line itself, on a row of its own under the input box. It redraws as often as the animal
moves a column, so the animal never jumps.

As the statusLine command, without the mod: this script draws the line too,
on the status line's row right under the input box. That row is redrawn once a
second at most.

    "statusLine": {"type": "command", "command": "/path/to/taxi-horse",
                   "refreshInterval": 1}

The line is an animal and the coins it runs for: the tokens. No text, no
number and no ground line.
    running    a request is out. The animal runs right to left and eats the
               coins on its way: an eaten coin turns into a dollar sign behind
               it. The faster tokens burn, the faster the animal:
               one for each of the 17 speed levels, from a snail to an eagle.
               After the last coin, at the left end, it starts again from the
               right with new coins laid out.
    standing   only tools are running
    asleep     between turns. Whatever it was, it sleeps as a snail.
The animal stops, sleeps and starts again where it stands.

The animal is the average speed. What goes behind it is the speed of the
moment, the last GUST_WINDOW seconds, against that average:
    wind       running, and the moment is GUST_FACTOR times the average or
               more: it has just sped up
    fire       the same, and the moment is FIRE_FACTOR times the speed the
               fastest animal starts at, or more
    zzz        standing, and no token for DOZE_AFTER seconds: it has just
               stopped. It dozes as the animal it is.
While a request is out there is no zzz, however long it takes: the tokens of
a response only show when it is complete (see below).

The speed is the number of tokens the meter registered in the last WINDOW
seconds, per second. The tokens counted are input + cache write + output
tokens. Cache reads are left out: they repeat the whole context on every
request and would bury the rest.

Which animal a speed gets is not fixed: plans, models and habits differ. The
meter keeps a history of the speeds this user has run at, in
$XDG_STATE_HOME/taxi-horse/rates.json, and the level of a speed is where it
stands among them. Each animal is therefore seen about as often as any other.

The status line input only carries the last response's token counts, so the
rate comes from the session transcript and its subagent transcripts. Each run
reads only what was appended since the previous run and keeps its progress in
a small state file under $XDG_RUNTIME_DIR.

Claude Code writes a response to the transcript when the response is complete,
not while it streams (on 2.1.330: about 0.2 s after its last content block,
once 55 s later). The rate therefore counts tokens from the moment the meter
sees them: every token shows up in the rate for exactly WINDOW seconds.

With both the mod and the statusLine setting, the mod draws and this script
prints nothing while the mod's <session>.mod file is fresh. Claude Code keeps
the status line's row even when it is empty, so use one or the other.

Install: see README.md.

Run by hand:
    taxi-horse --demo          draw every state
    taxi-horse --state         what the mod runs: prints "<state> <level>", and
                               "gust", "fire" or "doze" after them
    taxi-horse --levels        the speed at which each animal starts, for this user
    taxi-horse --learn         rebuild the history from recent transcripts
    taxi-horse < statusline.json

TAXI_HORSE_DEBUG=<file> appends one line per run: time, state, rate, what
goes behind the animal, and the last thing seen in each transcript.
"""
import json
import math
import os
import sys
import time

WINDOW = 120.0           # seconds the rate is averaged over
ACTIVE_MAX = 300.0       # a request seen longer ago than this no longer counts as running
HALT_MAX = 1800.0        # the same for a tool call without a result
LAG_MAX = 300.0          # lines older than this are history, not fresh burn
SCAN_BUDGET = 0.35       # seconds of transcript reading per run
IDS_MAX = 3000           # responses remembered for de-duplication
STATE_VERSION = 3
STATE_MAX_AGE = 2 * 86400

TRACK = 40               # length of the track in columns
STEP = 1.0               # columns a second. The status line is redrawn once a second
                         # at most, so anything faster would be a jump of several columns.
LEVEL_MAX = 16           # speed levels run from 0 to this
GUST_WINDOW = 10.0       # seconds the speed of the moment is taken over
GUST_FACTOR = 3.0        # a gust: the moment is this many times the average
FIRE_FACTOR = 3.0        # fire: a gust at this many times the speed the fastest animal starts at
DOZE_AFTER = 10.0        # seconds without a token before a standing animal dozes
# The level of a rate is the share of this user's earlier rates that were
# lower, cut into LEVEL_MAX + 1 equal parts. Until there is a history a guess
# stands in for it: rates spread evenly, on a log scale, from RATE_MIN to RATE_MAX.
RATE_MIN = 40.0
RATE_MAX = 4000.0
PRIOR = 120.0            # weight of that guess, in samples
HIST_PER_DECADE = 24     # buckets of the history for each factor of ten in tok/s
HIST_SIZE = 5 * HIST_PER_DECADE      # 1 to 100000 tok/s
HIST_CAP = 6000.0        # samples the history holds: older ones fade as new ones come
SAMPLE_EVERY = 5.0       # seconds between two samples of a session's rate
FLUSH_EVERY = 60.0       # seconds between two writes of a session's samples to the history

IN, CW, CR, OUT = range(4)
USAGE_KEYS = ("input_tokens", "cache_creation_input_tokens",
              "cache_read_input_tokens", "output_tokens")


def burned(u):
    return u[IN] + u[CW] + u[OUT]


def parse_ts(s):
    from datetime import datetime
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


# ---------------------------------------------------------------- state

def state_dir():
    base = os.environ.get("XDG_RUNTIME_DIR")
    if base and os.path.isdir(base):
        return os.path.join(base, "taxi-horse")
    base = "/dev/shm" if os.path.isdir("/dev/shm") else "/tmp"
    return os.path.join(base, "taxi-horse-%d" % os.getuid())


def new_state():
    # tot: tokens by kind; ids: usage already counted per response id;
    # ev: [time registered, tokens burned] for the rate window
    return {"v": STATE_VERSION, "files": {}, "tot": [0, 0, 0, 0], "ids": {}, "ev": []}


def load_state(path):
    try:
        with open(path) as f:
            st = json.load(f)
        if st.get("v") == STATE_VERSION:
            return st
    except (OSError, ValueError):
        pass
    return None


def save_state(path, st):
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w") as f:
        json.dump(st, f, separators=(",", ":"))
    os.replace(tmp, path)


def drop_old_states(directory, now):
    try:
        for e in os.scandir(directory):
            if now - e.stat().st_mtime > STATE_MAX_AGE:
                os.unlink(e.path)
    except OSError:
        pass


# ---------------------------------------------------------------- transcript

def transcript_files(transcript):
    """The session transcript and every sidechain transcript under it."""
    files = [("", transcript)]
    root = transcript[:-len(".jsonl")] if transcript.endswith(".jsonl") else transcript
    for dirpath, _dirs, names in os.walk(os.path.join(root, "subagents")):
        for name in sorted(names):
            if name.endswith(".jsonl"):
                full = os.path.join(dirpath, name)
                files.append((os.path.relpath(full, root), full))
    return files


def new_file_state():
    # off: bytes consumed; tail: "u" a request is out, "a" the model answered,
    # "x" interrupted, "" nothing yet; ts: when the meter saw that line;
    # pend: tool calls of the last response still without a result; cur: its id
    return {"off": 0, "tail": "", "ts": 0.0, "pend": 0, "cur": None}


def user_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text":
                return b.get("text") or ""
    return ""


def feed_line(st, fs, d, now, history):
    """Account for one parsed transcript line.

    history: the meter is reading a transcript it has not followed live, so
    lines keep their own timestamps and old burn stays out of the rate.
    """
    kind = d.get("type")
    if kind != "assistant" and kind != "user":
        return
    msg = d.get("message") or {}
    ts = parse_ts(d.get("timestamp"))
    if ts is None:
        return
    seen = ts if history or now - ts > LAG_MAX else now

    if kind == "assistant":
        mid = msg.get("id")
        usage = msg.get("usage")
        if mid and isinstance(usage, dict) and msg.get("model") != "<synthetic>":
            # One response is written as one line per content block, all with
            # the same id and usage. Count it once, at its largest.
            new = [int(usage.get(k) or 0) for k in USAGE_KEYS]
            old = st["ids"].get(mid) or [0, 0, 0, 0]
            top = [max(a, b) for a, b in zip(old, new)]
            for i in range(4):
                st["tot"][i] += top[i] - old[i]
            st["ids"][mid] = top
            delta = burned(top) - burned(old)
            if delta > 0:
                st["ev"].append([seen, delta])
        if fs["cur"] != mid:
            fs["cur"] = mid
            fs["pend"] = 0
        content = msg.get("content")
        if isinstance(content, list):
            fs["pend"] += sum(1 for b in content
                              if isinstance(b, dict) and b.get("type") == "tool_use")
        fs["tail"], fs["ts"] = "a", seen
        return

    if "toolUseResult" in d:
        fs["pend"] = max(0, fs["pend"] - 1)
        if fs["pend"] == 0:
            fs["tail"], fs["ts"] = "u", seen
        return
    if user_text(msg.get("content")).startswith("[Request interrupted"):
        fs["tail"], fs["ts"], fs["pend"] = "x", seen, 0
        return
    if "permissionMode" in d or "promptSource" in d:
        is_prompt = True
    elif d.get("isMeta") or d.get("isCompactSummary"):
        is_prompt = False
    else:
        # A skill command carries "origin"; a subagent's prompt carries nothing.
        # Output of a local command (/model, ! shell) in the main transcript
        # carries nothing either and starts no request.
        is_prompt = "origin" in d or bool(d.get("isSidechain"))
    if is_prompt:
        fs["tail"], fs["ts"], fs["pend"] = "u", seen, 0


def scan(st, transcript, now, history, deadline):
    """Read what was appended to the transcripts.

    Returns (changed, complete); changed is None if a file shrank and the
    state must be rebuilt.
    """
    changed = False
    for key, path in transcript_files(transcript):
        try:
            size = os.path.getsize(path)
        except OSError:
            continue
        fs = st["files"].get(key)
        if fs is None:
            fs = st["files"][key] = new_file_state()
            changed = True
        if size < fs["off"]:
            return None, False
        if size == fs["off"]:
            continue
        with open(path, "rb") as f:
            f.seek(fs["off"])
            while True:
                line = f.readline()
                if not line.endswith(b"\n"):
                    break                # end of file, or a line still being written
                fs["off"] += len(line)
                changed = True
                if b'"type":"assistant"' in line or b'"type":"user"' in line:
                    try:
                        d = json.loads(line)
                    except ValueError:
                        continue
                    if isinstance(d, dict):
                        feed_line(st, fs, d, now, history)
                if time.monotonic() > deadline:
                    return changed, False
    return changed, True


def prune(st, now):
    st["ev"] = [e for e in st["ev"] if e[0] > now - WINDOW]
    ids = st["ids"]
    if len(ids) > IDS_MAX + 500:
        for mid in list(ids)[:len(ids) - IDS_MAX]:
            del ids[mid]


def rate(st, now, window=WINDOW):
    """Tokens registered in the last window seconds, per second."""
    return sum(e[1] for e in st["ev"] if now - window < e[0] <= now) / window


RUN, HALT, VACANT = "run", "halt", "vacant"


def phase(st, now):
    """RUN: a request is out. HALT: only tools are running. VACANT: no turn."""
    found = VACANT
    for fs in st["files"].values():
        age = now - fs["ts"]
        if fs["tail"] == "u" and 0 <= age < ACTIVE_MAX:
            return RUN
        if fs["tail"] == "a" and fs["pend"] > 0 and 0 <= age < HALT_MAX:
            found = HALT
    return found


# ---------------------------------------------------------------- speed and position

def rates_path():
    base = os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state")
    return os.path.join(base, "taxi-horse", "rates.json")


def bucket_pos(tok_s):
    """Where a rate falls in the history, as a position on its log scale."""
    return min(HIST_SIZE - 1e-9, max(0.0, math.log10(max(tok_s, 1.0)) * HIST_PER_DECADE))


def prior():
    lo, hi = int(bucket_pos(RATE_MIN)), int(bucket_pos(RATE_MAX))
    return [PRIOR / (hi - lo) if lo <= b < hi else 0.0 for b in range(HIST_SIZE)]


def load_rates(path):
    """The history: how many samples of the rate fell in each bucket."""
    try:
        with open(path) as f:
            d = json.load(f)
        if d.get("v") == 1 and len(d["h"]) == HIST_SIZE:
            return [float(x) for x in d["h"]]
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        pass
    return [0.0] * HIST_SIZE


def save_rates(path, hist):
    total = sum(hist)
    if total > HIST_CAP:                 # the oldest samples fade
        hist = [x * HIST_CAP / total for x in hist]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w") as f:
        json.dump({"v": 1, "h": [round(x, 3) for x in hist]}, f, separators=(",", ":"))
    os.replace(tmp, path)


def merge_rates(path, pending):
    """Add a session's samples, {bucket: count}, to the history."""
    hist = load_rates(path)
    for b, n in pending.items():
        hist[int(b)] += n
    save_rates(path, hist)


def level(tok_s, hist=None):
    """Speed on a scale of 0..LEVEL_MAX: where the rate stands among earlier ones.

    It picks the animal and how often the mod redraws.
    """
    if tok_s <= 0:
        return 0
    weights = prior()
    if hist:
        weights = [a + b for a, b in zip(weights, hist)]
    pos = bucket_pos(tok_s)
    b = int(pos)
    below = sum(weights[:b]) + weights[b] * (pos - b)
    return min(LEVEL_MAX, int(below / sum(weights) * (LEVEL_MAX + 1)))


def level_starts(hist=None):
    """The lowest rate of each level from 1 up, in tok/s."""
    starts = []
    for k in range(1, LEVEL_MAX + 1):
        lo, hi = 0.0, 5.0                # log10 of the rate
        for _ in range(40):
            mid = (lo + hi) / 2
            lo, hi = (lo, mid) if level(10 ** mid, hist) >= k else (mid, hi)
        starts.append(10 ** hi)
    return starts


GUST, FIRE, DOZE = "gust", "fire", "doze"


def mark(st, now, ph, tok_s, hist=None):
    """What goes behind the animal: the speed of the moment against the average.

    GUST while running, when the last GUST_WINDOW seconds ran at GUST_FACTOR
    times the average or more, and fast enough to be more than a snail. FIRE
    when that is also FIRE_FACTOR times the speed the fastest animal starts at.
    DOZE while standing, when no token was registered for DOZE_AFTER seconds.
    Otherwise "".
    """
    if ph == RUN:
        fast = rate(st, now, GUST_WINDOW)
        if fast > 0 and fast >= GUST_FACTOR * tok_s and level(fast, hist) >= 1:
            return FIRE if fast >= FIRE_FACTOR * level_starts(hist)[-1] else GUST
    elif ph == HALT:
        if not any(now - DOZE_AFTER < e[0] <= now for e in st["ev"]):
            return DOZE
    return ""


def learn(root=None, limit=200, path=None):
    """Rebuild the history from this user's most recent transcripts.

    A session is sampled as the live meter samples it: every SAMPLE_EVERY
    seconds while it is busy, here between two responses less than five
    minutes apart. Returns the number of samples.
    """
    import bisect
    import glob
    root = root or os.path.expanduser("~/.claude/projects")
    mains = sorted(glob.glob(os.path.join(root, "*", "*.jsonl")),
                   key=os.path.getmtime, reverse=True)[:limit]
    hist = [0.0] * HIST_SIZE
    for main_path in mains:
        st = new_state()
        scan(st, main_path, time.time(), True, time.monotonic() + 3600)
        ev = sorted(st["ev"])
        times = [e[0] for e in ev]
        upto = [0]
        for e in ev:
            upto.append(upto[-1] + e[1])
        for i, t0 in enumerate(times):
            end = times[i + 1] if i + 1 < len(times) and times[i + 1] - t0 < 300 else t0 + SAMPLE_EVERY
            t = t0
            while t < end:
                tokens = upto[bisect.bisect_right(times, t)] - upto[bisect.bisect_right(times, t - WINDOW)]
                if tokens > 0:
                    hist[int(bucket_pos(tokens / WINDOW))] += 1
                t += SAMPLE_EVERY
    save_rates(path or rates_path(), hist)
    return int(sum(hist))


def load_run(path):
    try:
        with open(path) as f:
            dist, t, running = f.read().split()
        return float(dist), float(t), running == "1"
    except (OSError, ValueError):
        return 0.0, 0.0, False


def save_run(path, dist, t, running):
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w") as f:
        f.write("%.3f %.3f %d" % (dist, t, running))
    os.replace(tmp, path)


def advance(path, running, now, lap):
    """Move the animal and return how far it has run so far, in columns.

    The distance is kept in a file of its own: the animal stops and starts
    again where it stands.

    lap: positions in one lap. The last one is the left end, where the coin
    is. The animal is drawn there once on every lap, and the redraw after that
    starts the next lap at the right end.
    """
    dist, t, was_running = load_run(path)
    if running:
        # The first redraw after a stop moves nothing, and a gap in the redraws
        # is not a leap.
        dt = min(max(now - t, 0.0), 2.0) if was_running else 0.0
        new = dist + STEP * dt
        lap_no, pos = divmod(int(dist), lap)
        if int(new) // lap > lap_no:
            new = float(lap_no * lap + lap - 1) if pos < lap - 1 else float((lap_no + 1) * lap)
        dist = new % (lap * 100000)
        save_run(path, dist, now, True)
    elif was_running:
        save_run(path, dist, now, False)
    return dist


# ---------------------------------------------------------------- drawing

COIN = "🪙"
EATEN = "💲"                         # what a coin turns into once the animal has passed it
COIN_GAP = 8                         # a coin every so many columns, from the left end
# The animal for each speed level, slowest first: (lowest level, glyph). All of
# them face left in Noto Color Emoji and are one code point two columns wide.
# snail, turtle, hedgehog, mouse, rooster, pig, sheep, elephant, camel, dog,
# rabbit, kangaroo, deer, horse, tiger, leopard, eagle. With the rates of 150
# recent sessions the median is the elephant and the 94th percentile the deer.
ANIMALS = tuple(enumerate("🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅"))
BEHIND = {GUST: "💨", FIRE: "🔥", DOZE: "💤"}      # what a mark draws behind the animal


def animal(lvl):
    return [glyph for lowest, glyph in ANIMALS if lvl >= lowest][-1]


def track_width():
    cols = os.environ.get("COLUMNS", "")
    if cols.isdigit():
        return max(12, min(TRACK, int(cols) - 4))
    return TRACK


def lap_length(width=TRACK):
    """Positions in one lap: the columns the animal runs through, then the last coin's."""
    return width - 2


def animal_column(dist, width=TRACK):
    """Left column of the animal. The glyphs face left, so it runs right to left.

    From column width-2 down to column 2, then column 0, onto the last coin. It
    is never at column 1: the line always starts with a coin or with the animal.
    """
    lap = lap_length(width)
    pos = int(dist) % lap
    return 0 if pos == lap - 1 else width - 2 - pos


def render(ph, lvl, dist, catching_up=False, width=None, mark=""):
    """The line: coins ahead of the animal, dollar signs behind it, and right
    behind it its zzz when asleep, or the wind, fire or zzz of its mark."""
    if width is None:
        width = track_width()
    x = animal_column(dist, width)
    # Two-column glyphs by their left column. The animal and what is right
    # behind it come first: a coin or a dollar sign they would overlap is left
    # out.
    glyphs = {x: animal(0 if ph == VACANT else lvl)}
    behind = "💤" if ph == VACANT else BEHIND.get(mark)
    if behind:
        glyphs[x + 2] = behind
    for c in range(0, width - 4, COIN_GAP):
        if not any(abs(c - taken) < 2 for taken in list(glyphs)):
            glyphs[c] = COIN if c < x else EATEN
    line, col = "", 0
    while col < max(width, max(glyphs) + 2):
        if col in glyphs:
            line += glyphs[col]
            col += 2
        else:
            line += " "
            col += 1
    line = line.rstrip(" ")
    if catching_up:              # still reading a long transcript for the first time
        line += " ..."
    return line


# ---------------------------------------------------------------- entry points

def measure(data, now, directory=None, budget=SCAN_BUDGET, rates=None):
    """Return (state, tok/s, tokens counted, catching_up, distance run, level,
    mark) for a status line input."""
    transcript = data.get("transcript_path")
    session = os.path.basename(str(data.get("session_id") or "unknown"))
    directory = directory or state_dir()
    path = os.path.join(directory, session + ".json")
    st = load_state(path)
    created = st is None
    if created:
        st = new_state()
    # Until the first full pass is done the meter is reading history.
    history = not st.get("live")
    changed, complete = False, True
    if transcript:
        deadline = time.monotonic() + budget
        changed, complete = scan(st, transcript, now, history, deadline)
        if changed is None:
            st, history = new_state(), True
            changed, complete = scan(st, transcript, now, history, deadline)
            changed = True
    if complete and history:
        st["live"] = True
        changed = True
    before = len(st["ev"])
    prune(st, now)
    tok_s = rate(st, now)
    ph = phase(st, now)
    # Remember how fast this user runs: a sample now and then while a turn is
    # on, handed to the history once a minute.
    rates = rates or rates_path()
    if ph != VACANT and tok_s > 0 and now - st.get("ht", 0.0) >= SAMPLE_EVERY:
        pending = st.setdefault("hp", {})
        key = str(int(bucket_pos(tok_s)))
        pending[key] = pending.get(key, 0) + 1
        st["ht"] = now
        changed = True
    if st.get("hp") and now - st.get("hf", 0.0) >= FLUSH_EVERY:
        try:
            merge_rates(rates, st["hp"])
            st["hp"] = {}
        except OSError:
            pass                         # kept for the next try
        st["hf"] = now
        changed = True
    hist = load_rates(rates)
    lvl = level(tok_s, hist)
    mk = mark(st, now, ph, tok_s, hist)
    if changed or created or len(st["ev"]) != before:
        os.makedirs(directory, mode=0o700, exist_ok=True)
        if created:
            drop_old_states(directory, now)
        save_state(path, st)
    dist = advance(os.path.join(directory, session + ".run"), ph == RUN, now,
                   lap_length(track_width()))
    debug = os.environ.get("TAXI_HORSE_DEBUG")
    if debug:
        tails = " ".join("%s:%s/%d/%.0fs" % (k or "main", fs["tail"] or "-", fs["pend"],
                                              now - fs["ts"])
                         for k, fs in st["files"].items())
        with open(debug, "a") as f:
            f.write("%.3f %s %s rate=%.1f level=%d mark=%s dist=%.1f counted=%d new=%s %s\n"
                    % (now, session[:8], ph, tok_s, lvl, mk or "-", dist, burned(st["tot"]),
                       bool(changed), tails))
    return ph, tok_s, burned(st["tot"]), not complete, dist, lvl, mk


MOD_FRESH = 3.0          # seconds a mod's sign of life counts for


def mod_draws(directory, session, now):
    """Is the mod of this session alive and drawing the line itself."""
    try:
        return 0 <= now - os.stat(os.path.join(directory, session + ".mod")).st_mtime < MOD_FRESH
    except OSError:
        return False


def demo():
    def show(ph, lvl, dist, note, mark=""):
        line = render(ph, lvl, dist, mark=mark)
        pad = TRACK + 4 - sum(1 + (ord(ch) > 0x1F000) for ch in line)
        print(line + " " * pad, note)

    show(VACANT, 0, 12.0, "<- asleep: between turns")
    show(HALT, 7, 12.0, "<- standing: tools running")
    show(HALT, 7, 12.0, "<- dozing: standing, and no token for a while", DOZE)
    for lvl in range(LEVEL_MAX + 1):
        show(RUN, lvl, 13.0, "<- running, level %d" % lvl)
    show(RUN, 7, 13.0, "<- wind: it has just sped up", GUST)
    show(RUN, 7, 13.0, "<- fire: it has just sped up, to a great speed", FIRE)
    show(RUN, 7, 25.0, "<- three coins eaten: dollar signs behind it")
    show(RUN, 7, lap_length() - 1.0, "<- at the left end: the last coin is eaten")


def show_levels():
    hist = load_rates(rates_path())
    print("%d samples in %s" % (sum(hist), rates_path()))
    print("%s  below %.0f tok/s" % (animal(0), level_starts(hist)[0]))
    for k, start in enumerate(level_starts(hist), 1):
        print("%s  from %.0f tok/s" % (animal(k), start))


def main():
    if "--demo" in sys.argv:
        demo()
        return
    if "--learn" in sys.argv:
        print("history rebuilt from recent transcripts: %d samples" % learn())
        show_levels()
        return
    if "--levels" in sys.argv:
        show_levels()
        return
    data = json.load(sys.stdin)
    now = time.time()
    directory = state_dir()
    session = os.path.basename(str(data.get("session_id") or "unknown"))
    ph, _tok_s, _counted, catching_up, dist, lvl, mk = measure(data, now, directory)
    if "--state" in sys.argv:
        print(("%s %d %s" % (ph, lvl, mk)).rstrip())
    elif not mod_draws(directory, session, now):
        print(render(ph, lvl, dist, catching_up, mark=mk))


def cli():
    try:
        main()
    except Exception as e:  # a blank status line would hide the failure
        print("taxi-horse: %s" % type(e).__name__)
        raise


if __name__ == "__main__":
    cli()
