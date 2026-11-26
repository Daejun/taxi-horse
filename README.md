# taxi_horse

A Claude Code plugin that shows how fast a session burns tokens, as an animal
running under the input box.

```
────────────────────────────────────────────────
❯
────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)
  🟡        🟡   🐘   💲0.19    🐾        💲0.05
```

- The animal runs right to left while a request is out. While only tools
  run it stands with a wrench behind it (`🐘🔧`): it is not asleep, a tool
  is at work. Between turns it sleeps, always as a snail (`🐌💤`). The
  wrench and every zzz blink: a second there, a second gone.
- When the average speed is 0 too, two minutes after the last token, and
  no turn is on, it goes into its house to sleep (`🏠💤`), and the line
  starts over as in a new session: the house stands at the right end and
  every coin is back. A session that has not started yet is at home as
  well. While tools run it stays out with its wrench, however long they
  take.
- When a turn has ended and the session still waits for something, an
  hourglass stands in place of the zzz (`🐌⏳`, at home `🏠⏳`). That is
  background work that is still running, or a wakeup the session has
  scheduled. The hourglass blinks as the zzz does.
- It eats the coins on its way. After the last coin it starts again from
  the right. What it left on the lap before turns back into coins one at a
  time, each when the animal is a coin and a half away from it: never at
  the moment the animal eats a coin.
- Where a coin was, a `💲` with the fare is left: what the session has cost,
  in US dollars, since the fare before it. It is the price of that stretch,
  not the total, and it stays until its place turns back into a coin on the
  next lap, or until the animal goes home. The first fare after home has
  what was spent since the fare before it. A stretch that cost less than
  half a cent leaves paw prints (`🐾`), and the amount goes into the next fare. The cost is the estimate `/cost`
  shows: list price, not a bill, and on a subscription no charge at all.
  Where Claude Code gives no cost, an eaten coin leaves nothing.
- The kind of animal is the speed, averaged over two minutes: 17 of them,
  from a snail to an eagle. Which speed gets which animal follows the
  user's own history, so everyone sees the whole range.
- Right behind a running animal is the speed of the last 10 seconds against
  that average. Wind (`🐎💨`): it has just sped up, to 3 times the average
  or more. Fire (`🐎🔥`): the same, and to 3 times the speed the fastest
  animal starts at.
- When the animal changes into another, or wakes up, a poof (`💥`) stands
  in its place for a moment. Falling asleep and going home have none.
- The faster it runs, the more often it is redrawn, one column at a time.
- In a terminal window that does not have the focus the line is redrawn half
  as often. The animal runs as fast, two columns at a time, and the wrench,
  the hourglass and the zzz blink two seconds there and two gone. Each
  redraw of the line makes the terminal's window redraw, and the desktop with
  it, so a dozen sessions in a dozen windows would keep the desktop busy.
  This takes Claude Code 2.1.331 or newer and a terminal that reports its
  focus; anywhere else the line moves as in a window that has it.
- With `"prefersReducedMotion": true` in Claude Code's settings the animal
  runs a column a second, and nothing blinks or poofs.
- The fare is the only text on the line.

The plugin is a mod (`hooks/register.tsx`, which draws the line through
`hooks/row.tsx`) and a script (`taxi-horse`, `meter.py`) that counts the
tokens. The mod runs the script once a second.

## Install

One command, from a shell:

```sh
claude plugin install taxi-horse --marketplace Daejun/taxi-horse --scope user
```

or, typed at the prompt of a Claude Code session:

```
/plugin install taxi-horse --marketplace Daejun/taxi-horse
```

Nothing has to be checked or installed first. The plugin needs Python 3.7
or newer and looks for it by itself when a session starts: `/usr/bin/python3`,
then `python3`, `python` and `py` on `PATH`. On Windows it looks for `py`
first, then `python` and `python3`. When there is none, the row says so
in place of the picture:

```
  ⏵⏵ bypass permissions on (shift+tab to cycle)
  taxi-horse needs Python 3.7 or newer: python3 not found
```

It looks again every 30 seconds, so the picture comes by itself once Python
is there.

The steps below are the same install, written so that a coding agent can
follow them. Run them in order. Each step says what to expect.

Tested with Claude Code 2.1.332 and 2.1.292, the oldest build it is known
to work with, and git 2.43 on Linux, and with Python 3.7,
3.8, 3.9, 3.10, 3.12, 3.13 and 3.14. On Windows the steps are in PowerShell:
see "On Windows" below.

### 0. Before you start

- Step 1 changes `~/.claude/settings.json`, which applies to every session
  of the user. If the user has not asked for that, ask first.
- Step 1 clones this repository from github.com over HTTPS. The repository
  is public: no GitHub account is needed. Nothing here needs root.

### 1. Install the plugin

```sh
claude plugin install taxi-horse --marketplace Daejun/taxi-horse --scope user
claude plugin list
```

Expect `Successfully added marketplace: taxi-horse`, then
`Successfully installed plugin: taxi-horse@taxi-horse (scope: user)`, and in
the list:

```
taxi-horse@taxi-horse
  Version: ...
  Scope: user
  Status: ✔ enabled
```

Claude Code keeps its copy of the plugin under `~/.claude/plugins/cache`.
The script in that copy is what the later steps run. From a shell it runs
with the `python3` that is first on `PATH`:

```sh
TAXI=$(ls -dt ~/.claude/plugins/cache/taxi-horse/taxi-horse/*/taxi-horse | head -n 1)
"$TAXI" --demo                    # prints 26 lines of coins and animals, exit 0
```

If a coin or an animal shows as an empty box, the terminal has no colour
emoji font with Emoji 12.0 (the coin, U+1F7E1, is the newest on the line).
Windows 10 has it from the May 2019 Update. Say so and go on: the install
is the same.

Sessions started after this show the line. A session that was already open
shows it after `/reload-plugins`, typed by the user at its prompt, or after
a restart.

Do not set taxi-horse as the `statusLine` command as well: see "The other
way to run it" below.

### 2. Seed the speed history (optional)

```sh
"$TAXI" --learn
```

This reads the user's recent transcripts under `~/.claude/projects` and
writes `~/.local/state/taxi-horse/rates.json`. It prints the number of
samples and the speed at which each animal starts. Without this step the
meter starts from a built-in range and adapts as the user works.

### 3. Verify

What the mod runs, without touching any real state:

```sh
D=$(mktemp -d)
echo '{"session_id":"install-check"}' | XDG_RUNTIME_DIR="$D" XDG_STATE_HOME="$D" "$TAXI" --state
rm -r "$D"
```

It prints `vacant 0 home`: no turn is running, speed level 0, and the animal
is at home. Exit status 0.

In a session started after step 1, once it has run for a few seconds:

```sh
ls -l "$XDG_RUNTIME_DIR/taxi-horse/"
```

A `<session id>.mod` modified within the last 3 seconds means the mod is
drawing in that session, and `<session id>.json` is the meter's progress
through that session's transcript.

On screen the line is the row under the permission-mode line (`⏵⏵ ...`), or
right under the input box when that line is not shown.

### On Windows

Step 1's install command is the same in PowerShell. The other steps run the
script with Python by name: Windows does not read its first line. Where
`python` opens the Microsoft Store or says that Python was not found, use
`py` in its place.

```powershell
$TAXI = Get-ChildItem "$HOME\.claude\plugins\cache\taxi-horse\taxi-horse\*\taxi-horse" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
python $TAXI --demo               # step 1: 26 lines of coins and animals
python $TAXI --learn              # step 2
```

Step 3:

```powershell
$D = Join-Path ([IO.Path]::GetTempPath()) "taxi-horse-check"
New-Item -ItemType Directory -Force $D | Out-Null
$env:XDG_RUNTIME_DIR = $D; $env:XDG_STATE_HOME = $D
'{"session_id":"install-check"}' | python $TAXI --state
"exit $LASTEXITCODE"
Remove-Item Env:XDG_RUNTIME_DIR, Env:XDG_STATE_HOME
Remove-Item -Recurse $D
```

It prints `vacant 0 home`, then `exit 0`. Windows has no
`$XDG_RUNTIME_DIR` of its own, so a session keeps its files in
`%TEMP%\taxi-horse`:

```powershell
Get-ChildItem "$env:TEMP\taxi-horse"
```

## Update

```sh
claude plugin marketplace update taxi-horse
claude plugin update taxi-horse@taxi-horse
```

The first fetches this repository again. The second installs the plugin
again if `version` in `.claude-plugin/plugin.json` is higher than the
installed one: a commit that leaves `version` alone does not reach an
installed copy. `claude plugin list` then shows the new version.

From the prompt of a session, the same two steps are one:

1. Type `/plugin`, press Tab to the **Marketplaces** tab, select
   `taxi-horse` and choose **Update marketplace**. It fetches this
   repository again and updates the plugin installed from it.
2. Close the panel. Claude Code then runs `/reload-plugins` by itself. If
   it warns that the reload would cost the prompt cache and leaves the
   update pending, type `/reload-plugins --force`.

Other sessions that are already open keep the old version until
`/reload-plugins` or a restart.

## Install from a clone

To work on the plugin, let Claude Code run it from a clone instead of its
own copy. Use this or the install above, not both: each names its
marketplace `taxi-horse`.

```sh
git clone https://github.com/Daejun/taxi-horse
claude plugin marketplace add "$PWD/taxi-horse"
claude plugin install taxi-horse@taxi-horse --scope user
```

`claude plugin list` then shows `Read from:` and the clone's path. An edit
shows in a session after `/reload-plugins`. Moving or deleting the clone
removes the line. In steps 2 and 3, `TAXI` is `taxi-horse` in the clone.

## Uninstall

```sh
claude plugin uninstall taxi-horse@taxi-horse
claude plugin marketplace remove taxi-horse
```

Both commands edit `~/.claude/settings.json`. The state is in
`$XDG_RUNTIME_DIR/taxi-horse/` (on Windows `%TEMP%\taxi-horse\`) and
`~/.local/state/taxi-horse/`; both can be deleted.

## The other way to run it

Without the plugin, the script can draw the line itself as the `statusLine`
command:

```json
"statusLine": {
  "type": "command",
  "command": "/absolute/path/to/taxi-horse/taxi-horse",
  "refreshInterval": 1
}
```

The status line is the row right under the input box, above the
permission-mode line, and Claude Code redraws it once a second at most: the
animal moves one column a second whatever its speed. The poof and the
hourglass are the mod's: the script draws neither.

Use one or the other. With both, the mod draws and the script prints
nothing, but Claude Code keeps the status line's row, so an empty row stays
under the input box.

## What it reads and writes

| Path | Use |
| --- | --- |
| the session's transcript, and `subagents/` beside it | read: token counts of each response |
| the session's cost: asked of the session by the mod, `cost.total_cost_usd` of the input as the `statusLine` command | read: the fare |
| `$XDG_RUNTIME_DIR/taxi-horse/<session id>.*`, on Windows `%TEMP%\taxi-horse\<session id>.*` | written: the meter's progress, where the animal is and the fares of its lap, the mod's sign of life. On tmpfs, except on Windows. |
| `$XDG_STATE_HOME/taxi-horse/rates.json` (default `~/.local/state`) | written at most once a minute by a busy session: the speed history |
| `~/.claude/projects/*/*.jsonl` | read by `--learn` only |

It makes no network requests.

## Commands

| Command | What it does |
| --- | --- |
| `taxi-horse --state` | what the mod runs: prints `<state> <level>` for the session on stdin, and `gust`, `fire` or `home` after them when the animal has that mark |
| `taxi-horse` | as the `statusLine` command: prints the line |
| `taxi-horse --demo` | draws every state and every animal |
| `taxi-horse --levels` | the speed at which each animal starts, for this user |
| `taxi-horse --learn` | rebuilds the speed history from recent transcripts |

Both of the first two read `{"session_id": ..., "transcript_path": ...}` on
stdin. `TAXI_HORSE_DEBUG=<file>` in the environment appends one line per run
to that file: time, state, rate, level.

## Tests

In a clone:

```sh
python3 -m unittest test_meter    # the script, and that hooks/pictures.ts is what it draws
claude plugin test .              # the mod draws what the script draws
claude plugin validate .          # the marketplace, the manifest, the mod's types
```

`hooks/pictures.ts` holds what the script draws, and the mod's tests draw
the same. After a change to the picture, write it again with
`python3 test_meter.py --pictures`.

## Troubleshooting

- No line in a session: the plugin is not loaded there. Type
  `/reload-plugins` in it or restart it, and check `claude plugin list`.
- A line of text in place of the picture: the plugin cannot run its script,
  and the text is the reason. `taxi-horse needs Python 3.7 or newer: ...`
  means no Python was found, or only an older one. Any other text is the
  last line of the script's error, or the first line of an error from
  Claude Code, such as a call this build of Claude Code lacks. For the
  script's error, run the step 3 check to see all of it.
- No line in any session: run the step 3 check. Anything but
  `vacant 0 home` and exit 0 is the script failing; its traceback is on
  stderr.
- An empty row under the input box: taxi-horse is also set as `statusLine`.
  Remove that setting.
- A coin or an animal is an empty box: the font lacks that emoji.
- How the counting, the states and the history work is in the docstring of
  `meter.py`.
