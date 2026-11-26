"""taxi_horse: shows how fast a Claude Code session burns tokens, as a running animal.

This is the counting half. There are two ways to run it.

With the mod (the plugin this file ships in): the mod runs
"taxi-horse --state" once a second, every 3 seconds in a window without the
focus, with the session id and the transcript path as JSON on stdin, gets back "<state> <level>", with a third word when
the animal has a mark ("gust", "fire" or "home"), and draws the
line itself, on a row of its own under the input box. It redraws as often as the animal
moves a column, so the animal never jumps.

As the statusLine command, without the mod: this script draws the line too,
on the status line's row right under the input box. That row is redrawn once a
second at most.

    "statusLine": {"type": "command", "command": "/path/to/taxi-horse",
                   "refreshInterval": 1}

The line is an animal and the coins it runs for: the tokens. The only text
is the fare behind a dollar sign (see below). There is no ground line.
    running    a request is out. The animal runs right to left and eats the
               coins on its way. In a coin's place it leaves a dollar sign
               with the fare of the stretch up to it, or its paw prints when
               that is less than half a cent. The faster tokens burn, the
               faster the animal:
               one for each of the 17 speed levels, from a snail to an eagle.
               After the last coin, at the left end, it starts again from the
               right. What it left on the lap before turns back into coins
               one at a time, each when the animal is a coin and a half away
               from it: never at the moment the animal eats a coin.
    standing   only tools are running. A wrench is right behind the animal:
               it is not asleep, a tool is at work. A tool call that waits
               for the user to allow it counts too: the meter only sees
               that its result is not there yet.
    asleep     between turns. Whatever it was, it sleeps as a snail, with a
               zzz right behind it.
The animal stops, sleeps and starts again where it stands, unless it has
gone home (see below). The wrench and every zzz blink: BLINK seconds there,
BLINK seconds gone.

The animal is the average speed. While it runs, what goes behind it is the
speed of the moment, the last GUST_WINDOW seconds, against that average:
    wind       the moment is GUST_FACTOR times the average or more: it has
               just sped up
    fire       the same, and the moment is FIRE_FACTOR times the speed the
               fastest animal starts at, or more
While a request is out there is no zzz, however long it takes: the tokens of
a response only show when it is complete (see below).

When the average is 0 too, no token for WINDOW seconds, and no turn is on,
the animal goes into its house to sleep, and the line starts over as in a new
session: the house stands at the right end, with its zzz, and every coin is
back. A session that has not started yet is at home as well. While tools run
the animal stays out with its wrench, however long they take.

The fare behind a dollar sign is what the session has cost, in US dollars,
since the fare before it: the price of that stretch, not the total. The cost
is the one /cost totals: "cost.total_cost_usd" of the status line input here,
$.session.usage() in the mod. It is Claude Code's own estimate at list price,
not a bill, and on a subscription no charge at all. A coin is stamped when the
animal reaches it and keeps its fare until its place turns back into a coin
on the next lap, or until the animal goes home. The fares count on across a
stay at home: the first one after it has what was spent since the fare
before it. An amount of less than half a cent makes no fare: paw prints
are left in the coin's place, and the amount goes into the next fare, so
nothing spent is left out. The fares count from the meter's first reading of
the cost. A fare takes FARE_MAX characters at most: "0.42", "12.34", "123.4",
"1234". When the cost is not known, an eaten coin leaves nothing.

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
a small state file under $XDG_RUNTIME_DIR, on Windows under %TEMP%.

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
                               "gust", "fire" or "home" after them
    taxi-horse --levels        the speed at which each animal starts, for this user
    taxi-horse --learn         rebuild the history from recent transcripts
    taxi-horse < statusline.json

TAXI_HORSE_DEBUG=<file> appends one line per run: time, state, rate, what
goes behind the animal, and the last thing seen in each transcript.
"""

import math
import os
import sys
import time

try:
    from _json import make_scanner
except ImportError:              # a Python without the C part of json
    make_scanner = None

WINDOW = 120.0           # seconds the rate is averaged over
ACTIVE_MAX = 300.0       # a request seen longer ago than this no longer counts as running
HALT_MAX = 1800.0        # the same for a tool call without a result
LAG_MAX = 300.0          # lines older than this are history, not fresh burn
SCAN_BUDGET = 0.35       # seconds of transcript reading per run
IDS_MAX = 3000           # responses remembered for de-duplication
STATE_VERSION = 3
STATE_MAX_AGE = 2 * 86400

TRACK = 48               # length of the track in columns
STEP = 1.0               # columns a second. The status line is redrawn once a second
                         # at most, so anything faster would be a jump of several columns.
COIN_GAP = 10            # a coin every so many columns, from the left end
REFILL = COIN_GAP * 3 // 2   # columns ahead of the animal at which what it left turns back into a coin
FARE_MAX = 5             # characters of a fare at most: it ends well before the next coin
LEVEL_MAX = 16           # speed levels run from 0 to this
GUST_WINDOW = 10.0       # seconds the speed of the moment is taken over
GUST_FACTOR = 3.0        # a gust: the moment is this many times the average
FIRE_FACTOR = 3.0        # fire: a gust at this many times the speed the fastest animal starts at
BLINK = 1.0              # seconds the wrench or a zzz is there, and seconds it is gone, as it blinks
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
MOD_FRESH = 3.0          # seconds a mod's sign of life counts for

IN, CW, CR, OUT = range(4)
USAGE_KEYS = ("input_tokens", "cache_creation_input_tokens",
              "cache_read_input_tokens", "output_tokens")


# ---------------------------------------------------------------- files

def state_dir():
    base = os.environ.get("XDG_RUNTIME_DIR")
    if base and os.path.isdir(base):
        return os.path.join(base, "taxi-horse")
    if os.name == "nt":
        # Windows has no tmpfs and no uid: the user's own temporary folder,
        # where the mod puts its sign of life too.
        import tempfile
        return os.path.join(os.environ.get("TEMP") or tempfile.gettempdir(), "taxi-horse")
    base = "/dev/shm" if os.path.isdir("/dev/shm") else "/tmp"
    return os.path.join(base, "taxi-horse-%d" % os.getuid())


def write_whole(path, text):
    """Write a file so that a reader finds the old text or the new, never a part."""
    tmp = "%s.%d.tmp" % (path, os.getpid())
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)


# ---------------------------------------------------------------- JSON
#
# The meter runs once a second in every session, and `import json` costs
# about as much as all the rest of a run: 5 ms of CPU of 12 on Python 3.12,
# most of it for `re`. So JSON is read with json's own C scanner, which needs
# neither, and json is imported only to write, which a run between turns
# does not do.

class JsonContext:
    """What json's C scanner reads off its context, as json.JSONDecoder sets it."""

    def __init__(self):
        self.strict = True
        self.object_hook = None
        self.object_pairs_hook = None
        self.parse_float = float
        self.parse_int = int
        self.parse_constant = {"-Infinity": -math.inf, "Infinity": math.inf, "NaN": math.nan}.__getitem__
        self.memo = {}


scan_once = make_scanner(JsonContext()) if make_scanner else None
JSON_SPACE = " \t\n\r"


def loads(text):
    """json.loads() of text, a str or UTF-8 bytes. Raises ValueError where it does."""
    if scan_once is None:
        import json
        return json.loads(text)
    if isinstance(text, bytes):
        if text.startswith(b"\xef\xbb\xbf"):
            text = text[3:]
        text = text.decode("utf-8", "surrogatepass")
    start = len(text) - len(text.lstrip(JSON_SPACE))
    try:
        value, end = scan_once(text, start)
    except StopIteration:
        raise ValueError("Expecting value: char %d" % start)
    if text[end:].strip(JSON_SPACE):
        raise ValueError("Extra data: char %d" % end)
    return value


def dumps(value):
    """value as compact JSON text."""
    import json
    return json.dumps(value, separators=(",", ":"))


# ---------------------------------------------------------------- transcript

def burned(u):
    return u[IN] + u[CW] + u[OUT]


def parse_ts(s):
    from datetime import datetime
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


def transcript_files(transcript):
    """The session transcript and every sidechain transcript under it."""
    files = [("", transcript)]
    root = transcript[:-len(".jsonl")] if transcript.endswith(".jsonl") else transcript
    # The key of a file is its path under root, as os.path.relpath() gives it.
    prefix = os.path.join(root, "")
    for dirpath, _dirs, names in os.walk(os.path.join(root, "subagents")):
        for name in sorted(names):
            if name.endswith(".jsonl"):
                full = os.path.join(dirpath, name)
                files.append((full[len(prefix):], full))
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
                        d = loads(line)
                    except ValueError:
                        continue
                    if isinstance(d, dict):
                        feed_line(st, fs, d, now, history)
                if time.monotonic() > deadline:
                    return changed, False
    return changed, True


# ---------------------------------------------------------------- the meter's state

def new_state():
    # tot: tokens by kind; ids: usage already counted per response id;
    # ev: [time registered, tokens burned] for the rate window
    return {"v": STATE_VERSION, "files": {}, "tot": [0, 0, 0, 0], "ids": {}, "ev": []}


def load_state(path):
    try:
        with open(path) as f:
            st = loads(f.read())
        if st.get("v") == STATE_VERSION:
            return st
    except (OSError, ValueError):
        pass
    return None


def save_state(path, st):
    write_whole(path, dumps(st))


def drop_old_states(directory, now):
    try:
        for e in os.scandir(directory):
            if now - e.stat().st_mtime > STATE_MAX_AGE:
                os.unlink(e.path)
    except OSError:
        pass


def follow(st, transcript, now, budget):
    """Read what was appended to the session's transcripts into st.

    Until the first full pass is done the meter is reading history. A
    transcript that shrank starts the count over.

    Returns (st, changed, complete): st is a new state after a start over.
    """
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
    return st, changed, complete


def prune(st, now):
    st["ev"] = [e for e in st["ev"] if e[0] > now - WINDOW]
    ids = st["ids"]
    if len(ids) > IDS_MAX + 500:
        for mid in list(ids)[:len(ids) - IDS_MAX]:
            del ids[mid]


# ---------------------------------------------------------------- rate and phase

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


# ---------------------------------------------------------------- speed history and levels

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
            d = loads(f.read())
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
    write_whole(path, dumps({"v": 1, "h": [round(x, 3) for x in hist]}))


def merge_rates(path, pending):
    """Add a session's samples, {bucket: count}, to the history."""
    hist = load_rates(path)
    for b, n in pending.items():
        hist[int(b)] += n
    save_rates(path, hist)


def sample(st, now, ph, tok_s, rates):
    """Remember how fast this user runs: a sample now and then while a turn is
    on, handed to the history once a minute. Returns whether st changed."""
    changed = False
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
    return changed


class Scale:
    """The speed levels of one history.

    The level of a rate is where it stands among the earlier ones (see
    level()). The weights below each bucket are added up once here, so that
    every rate asked of the scale after that costs a few steps.
    """

    def __init__(self, hist=None):
        weights = prior()
        if hist:
            weights = [a + b for a, b in zip(weights, hist)]
        self.weights = weights
        # Summed as level() always summed them: sum() of the buckets below.
        self.below = [sum(weights[:b]) for b in range(HIST_SIZE)]
        self.total = sum(weights)

    def level(self, tok_s):
        if tok_s <= 0:
            return 0
        pos = bucket_pos(tok_s)
        b = int(pos)
        below = self.below[b] + self.weights[b] * (pos - b)
        return min(LEVEL_MAX, int(below / self.total * (LEVEL_MAX + 1)))

    def start(self, k):
        """The lowest rate of level k, in tok/s."""
        lo, hi = 0.0, 5.0                # log10 of the rate
        for _ in range(40):
            mid = (lo + hi) / 2
            lo, hi = (lo, mid) if self.level(10 ** mid) >= k else (mid, hi)
        return 10 ** hi

    def starts(self):
        """The lowest rate of each level from 1 up, in tok/s."""
        return [self.start(k) for k in range(1, LEVEL_MAX + 1)]


def level(tok_s, hist=None):
    """Speed on a scale of 0..LEVEL_MAX: where the rate stands among earlier ones.

    It picks the animal and how often the mod redraws.
    """
    return Scale(hist).level(tok_s) if tok_s > 0 else 0


def level_starts(hist=None):
    """The lowest rate of each level from 1 up, in tok/s."""
    return Scale(hist).starts()


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


# ---------------------------------------------------------------- marks

GUST, FIRE, HOME = "gust", "fire", "home"


def mark(st, now, ph, tok_s, scale):
    """What the state alone does not say: the speed of the moment while the
    animal runs, and whether it sleeps at home. scale: the levels (Scale) of
    this user's history.

    GUST while running, when the last GUST_WINDOW seconds ran at GUST_FACTOR
    times the average or more, and fast enough to be more than a snail. FIRE
    when that is also FIRE_FACTOR times the speed the fastest animal starts at.
    HOME between turns, when the average is 0 too. Otherwise "": a standing
    animal has no mark, its wrench is drawn for the state.
    """
    if ph == RUN:
        fast = rate(st, now, GUST_WINDOW)
        if fast > 0 and fast >= GUST_FACTOR * tok_s and scale.level(fast) >= 1:
            return FIRE if fast >= FIRE_FACTOR * scale.start(LEVEL_MAX) else GUST
    elif ph == VACANT and tok_s <= 0:
        return HOME
    return ""


# ---------------------------------------------------------------- the track and the fares

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


def coin_columns(width=TRACK):
    """Left column of every coin of a lap."""
    return range(0, width - 4, COIN_GAP)


def cost_of(data):
    """The session's cost so far in a status line input, in US dollars, or
    None when it carries none."""
    cost = data.get("cost")
    usd = cost.get("total_cost_usd") if isinstance(cost, dict) else None
    if isinstance(usd, bool) or not isinstance(usd, (int, float)) or not 0 <= usd < math.inf:
        return None
    return float(usd)


def fare(usd):
    """An amount as the digits behind a dollar sign: as many decimals, two at
    most, as fit in FARE_MAX characters. Halves round up, as in the mod. An
    amount of less than half a cent has no fare: ""."""
    if math.floor(usd * 100 + 0.5) < 1:
        return ""
    for digits in (2, 1, 0):
        unit = 10 ** digits
        n = int(math.floor(usd * unit + 0.5))
        text = "%d.%0*d" % (n // unit, digits, n % unit) if digits else "%d" % n
        if len(text) <= FARE_MAX:
            break
    return text


def fare_at(usd, c, width):
    """The fare drawn for an amount behind a dollar sign at column c: "" when
    the amount has none, or it does not fit before the next dollar sign and on
    the track."""
    text = fare(usd)
    return text if len(text) <= min(FARE_MAX, width - c - 2) else ""


def stamped(stamps, billed, before, x, usd, width=None):
    """The fares after the animal has moved from column before to column x.

    stamps: {coin column: amount}, what the animal has left in the place of
    each coin: behind it on this lap, ahead of it on the lap before. billed:
    the cost up to which fares have been stamped, None before the first
    reading of it. usd: the session's cost so far, None when it is not known.

    A coin the animal has reached on the way loses the stamp of the lap
    before and is stamped with what the session has cost since billed. When
    that makes a fare that is drawn, it is billed. An amount that makes none
    stays unbilled and goes into the next fare: one of less than half a cent
    is still stamped, for its paw prints, and one whose fare does not fit is
    not.
    The coin at the left end is stamped as the others: the lap ends on it, so
    what it leaves shows on the next lap.

    Returns (stamps, billed).
    """
    if width is None:
        width = TRACK
    if usd is not None and (billed is None or usd < billed):
        billed = usd                     # the first reading, or the cost has started over
    for c in reversed(coin_columns(width)):
        if x <= c < before:
            stamps = dict(stamps)
            stamps.pop(c, None)
            if usd is None:
                continue
            amount = usd - billed
            if fare_at(amount, c, width):
                stamps[c] = amount
                billed = usd
            elif not fare(amount):
                stamps[c] = amount
    return stamps, billed


# ---------------------------------------------------------------- the run

def load_run(path):
    """(distance, time, was it running, stamps, billed) as advance() left them."""
    try:
        with open(path) as f:
            dist, t, running, *rest = f.read().split()
        stamps, billed = {}, None
        for word in rest:
            if word.startswith("@"):
                billed = float(word[1:])
            else:
                c, usd = word.split(":")
                stamps[int(c)] = float(usd)
        return float(dist), float(t), running == "1", stamps, billed
    except (OSError, ValueError):
        return 0.0, 0.0, False, {}, None


def save_run(path, dist, t, running, stamps=None, billed=None):
    words = ["%.3f %.3f %d" % (dist, t, running)]
    if billed is not None:
        words.append("@%r" % billed)
    words.extend("%d:%r" % (c, usd) for c, usd in sorted((stamps or {}).items()))
    write_whole(path, " ".join(words))


def advance(path, running, now, lap, usd=None, home=False):
    """Move the animal. Returns how far it has run so far, in columns, and the
    stamps it has left.

    The distance is kept in a file of its own: the animal stops and starts
    again where it stands. The fares are kept with it.

    lap: positions in one lap. The last one is the left end, where the coin
    is. The animal is drawn there once on every lap, and the redraw after that
    starts the next lap at the right end.

    usd: the session's cost so far, when known (see stamped()).

    home: the animal is at home. The line starts over, as in a new session:
    the distance is 0 and there are no stamps. billed stays, so what was spent
    since the last fare goes into the next one.
    """
    dist, t, was_running, stamps, billed = load_run(path)
    if home:
        if dist or stamps or was_running:
            dist, stamps = 0.0, {}
            save_run(path, dist, now, False, stamps, billed)
    elif running:
        # The first redraw after a stop moves nothing, and a gap in the redraws
        # is not a leap.
        dt = min(max(now - t, 0.0), 2.0) if was_running else 0.0
        new = dist + STEP * dt
        lap_no, pos = divmod(int(dist), lap)
        if int(new) // lap > lap_no:
            new = float(lap_no * lap + lap - 1) if pos < lap - 1 else float((lap_no + 1) * lap)
        width = lap + 2
        stamps, billed = stamped(stamps, billed, animal_column(dist, width), animal_column(new, width),
                                 usd, width)
        dist = new % (lap * 100000)
        save_run(path, dist, now, True, stamps, billed)
    elif was_running:
        save_run(path, dist, now, False, stamps, billed)
    return dist, stamps


# ---------------------------------------------------------------- drawing

# Every glyph on the line is from Emoji 12.0 or older: the emoji font of
# Windows 10 stops there. A coin from Emoji 13.0 (U+1FA99) is an empty box on it.
COIN = "🟡"
EATEN = "💲"                         # what stands in an eaten coin's place, in front of its fare
PRINTS = "🐾"                        # what stands there when the stretch has cost less than half a cent
# The animal for each speed level, slowest first: (lowest level, glyph). All of
# them face left in Noto Color Emoji and are one code point two columns wide.
# snail, turtle, hedgehog, mouse, rooster, pig, sheep, elephant, camel, dog,
# rabbit, kangaroo, deer, horse, tiger, leopard, eagle. With the rates of 150
# recent sessions the median is the elephant and the 94th percentile the deer.
ANIMALS = tuple(enumerate("🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅"))
ZZZ = "💤"                           # what stands behind an animal asleep
BEHIND = {GUST: "💨", FIRE: "🔥"}     # what a mark draws behind a running animal
TOOL = "🔧"                          # what stands behind an animal that stands while its tools run
HOUSE = "🏠"                         # what stands in place of an animal that is at home


def animal(lvl):
    return [glyph for lowest, glyph in ANIMALS if lvl >= lowest][-1]


def blink_shows(now):
    """Is what blinks behind the animal, its wrench or its zzz, there at this
    time, or gone."""
    return int(now // BLINK) % 2 == 0


def render(ph, lvl, dist, catching_up=False, width=None, mark="", stamps=None, blink=True):
    """The line: coins ahead of the animal, fares behind it, and right behind
    it its zzz when asleep, its wrench when it stands, or the wind or fire of
    its mark when it runs. At home, its house stands in its place.

    stamps: {coin column: amount}. An eaten coin at such a column leaves a
    dollar sign and the fare of that amount (see fare_at()), or paw prints
    when the amount is less than half a cent. Any other eaten coin leaves
    nothing.

    A stamp ahead of the animal is what it left there on the lap before. It
    stays in the coin's place until the animal is REFILL columns away, so the
    lap before turns back into coins one coin at a time. That is halfway
    between two coins: nothing else on the line changes at that moment.

    blink: False while the wrench or the zzz is gone, as it blinks. Its place
    stays empty: what it hides does not come back meanwhile."""
    if width is None:
        width = track_width()
    stamps = stamps or {}
    x = animal_column(dist, width)
    # Two-column glyphs by their left column. The animal and what is right
    # behind it come first: a coin or a fare they would overlap is left out.
    glyphs = {x: HOUSE if mark == HOME else animal(0 if ph == VACANT else lvl)}
    behind = ZZZ if ph == VACANT else TOOL if ph == HALT else BEHIND.get(mark)
    if behind:
        glyphs[x + 2] = behind if blink or ph == RUN else "  "
    taken = list(glyphs)
    fares = {}                           # one-column characters by their first column
    for c in coin_columns(width):
        if any(abs(c - col) < 2 for col in taken):
            continue
        usd = stamps.get(c)
        if c < x and not (usd is not None and x > c + REFILL):
            glyphs[c] = COIN
            continue
        text = "" if usd is None else fare_at(usd, c, width)
        if text:
            glyphs[c] = EATEN
            fares[c + 2] = text
        elif usd is not None and not fare(usd):
            glyphs[c] = PRINTS
    line, col = "", 0
    while col < max(width, max(glyphs) + 2):
        if col in glyphs:
            line += glyphs[col]
            col += 2
        elif col in fares:
            line += fares[col]
            col += len(fares[col])
        else:
            line += " "
            col += 1
    line = line.rstrip(" ")
    if catching_up:              # still reading a long transcript for the first time
        line += " ..."
    return line


# ---------------------------------------------------------------- entry points

class Reading(tuple):
    """What measure() reads for a session, a tuple with its fields by name.

    phase: RUN, HALT or VACANT; rate: tok/s; counted: tokens counted in all;
    catching_up: still reading a long transcript for the first time; dist: how
    far the animal has run, in columns; level: the speed level; mark: GUST,
    FIRE, HOME or ""; stamps: what the animal has left (see stamped()).

    Not a collections.namedtuple: importing collections costs a run between
    turns about three times the CPU of all of measure().
    """
    __slots__ = ()
    FIELDS = ("phase", "rate", "counted", "catching_up", "dist", "level", "mark", "stamps")

    def __new__(cls, *values):
        assert len(values) == len(cls.FIELDS)
        return tuple.__new__(cls, values)


for _i, _name in enumerate(Reading.FIELDS):
    setattr(Reading, _name, property(lambda r, i=_i: r[i]))
del _i, _name


def session_of(data):
    """The session's name for its files."""
    return os.path.basename(str(data.get("session_id") or "unknown"))


def measure(data, now, directory=None, budget=SCAN_BUDGET, rates=None):
    """Return the Reading for a status line input."""
    session = session_of(data)
    directory = directory or state_dir()
    path = os.path.join(directory, session + ".json")
    st = load_state(path)
    created = st is None
    st, changed, complete = follow(st or new_state(), data.get("transcript_path"), now, budget)
    before = len(st["ev"])
    prune(st, now)
    tok_s = rate(st, now)
    ph = phase(st, now)
    rates = rates or rates_path()
    changed = sample(st, now, ph, tok_s, rates) or changed
    scale = Scale(load_rates(rates))
    lvl = scale.level(tok_s)
    mk = mark(st, now, ph, tok_s, scale)
    if changed or created or len(st["ev"]) != before:
        os.makedirs(directory, mode=0o700, exist_ok=True)
        if created:
            drop_old_states(directory, now)
        save_state(path, st)
    dist, stamps = advance(os.path.join(directory, session + ".run"), ph == RUN, now,
                           lap_length(track_width()), cost_of(data), mk == HOME)
    reading = Reading(ph, tok_s, burned(st["tot"]), not complete, dist, lvl, mk, stamps)
    debug = os.environ.get("TAXI_HORSE_DEBUG")
    if debug:
        write_debug(debug, now, session, st, reading, changed)
    return reading


def write_debug(path, now, session, st, reading, changed):
    """Append one line of what this run read to the TAXI_HORSE_DEBUG file."""
    tails = " ".join("%s:%s/%d/%.0fs" % (k or "main", fs["tail"] or "-", fs["pend"],
                                          now - fs["ts"])
                     for k, fs in st["files"].items())
    with open(path, "a") as f:
        f.write("%.3f %s %s rate=%.1f level=%d mark=%s dist=%.1f counted=%d new=%s %s\n"
                % (now, session[:8], reading.phase, reading.rate, reading.level,
                   reading.mark or "-", reading.dist, reading.counted, bool(changed), tails))


def mod_draws(directory, session, now):
    """Is the mod of this session alive and drawing the line itself."""
    try:
        return 0 <= now - os.stat(os.path.join(directory, session + ".mod")).st_mtime < MOD_FRESH
    except OSError:
        return False


def demo():
    def show(ph, lvl, dist, note, mark="", stamps=None):
        line = render(ph, lvl, dist, mark=mark, stamps=stamps)
        pad = TRACK + 4 - sum(1 + (ord(ch) > 0x1F000) for ch in line)
        print(line + " " * pad, note)

    left = {40: 0.05, 30: 0.002, 20: 0.19, 10: 1.2, 0: 0.03}     # what a lap may leave, by coin column
    show(VACANT, 0, 0.0, "<- at home: asleep, and the average is 0 too. The line has started over", HOME)
    show(VACANT, 0, 11.0, "<- asleep: between turns")
    show(HALT, 7, 11.0, "<- standing: tools running")
    for lvl in range(LEVEL_MAX + 1):
        show(RUN, lvl, 15.0, "<- running, level %d" % lvl)
    show(RUN, 7, 15.0, "<- wind: it has just sped up", GUST)
    show(RUN, 7, 15.0, "<- fire: it has just sped up, to a great speed", FIRE)
    show(RUN, 7, 31.0, "<- three coins eaten: the fare of each stretch, or paw prints for less than half a cent",
         stamps={c: usd for c, usd in left.items() if c >= 20})
    show(RUN, 7, lap_length() - 1.0, "<- at the left end: the last coin is eaten", stamps=left)
    show(RUN, 7, float(lap_length()), "<- the next lap: only the coin ahead is back", stamps=left)
    show(RUN, 7, lap_length() + 9.0, "<- and the others turn back into coins one at a time, ahead of the animal",
         stamps=left)


def show_levels():
    path = rates_path()
    hist = load_rates(path)
    starts = level_starts(hist)
    print("%d samples in %s" % (sum(hist), path))
    print("%s  below %.0f tok/s" % (animal(0), starts[0]))
    for k, start in enumerate(starts, 1):
        print("%s  from %.0f tok/s" % (animal(k), start))


def read_input():
    """The JSON on stdin. Claude Code and the mod write it in UTF-8, and on
    Windows a pipe is read in the ANSI code page: read the bytes."""
    return loads(sys.stdin.buffer.read())


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
    data = read_input()
    now = time.time()
    directory = state_dir()
    r = measure(data, now, directory)
    if "--state" in sys.argv:
        print(("%s %d %s" % (r.phase, r.level, r.mark)).rstrip())
    elif not mod_draws(directory, session_of(data), now):
        print(render(r.phase, r.level, r.dist, r.catching_up, mark=r.mark, stamps=r.stamps,
                     blink=blink_shows(now)))


def cli():
    # The same for what it writes: the ANSI code page has no emoji.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except Exception as e:  # a blank status line would hide the failure
        print("taxi-horse: %s" % type(e).__name__)
        raise


if __name__ == "__main__":
    cli()
