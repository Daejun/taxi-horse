# taxi_horse

A Claude Code plugin that shows how fast a session burns tokens, as an animal
running under the input box.

```
────────────────────────────────────────────────
❯
────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)
  🪙      🪙     🐘       💲      💲
```

- The animal runs right to left while a request is out, stands while tools
  run and sleeps between turns, always as a snail (`🐌💤`).
- It eats the coins on its way: an eaten coin turns into `💲` behind it.
  After the last coin it starts again from the right.
- The kind of animal is the speed: 17 of them, from a snail to an eagle.
  Which speed gets which animal follows the user's own history, so everyone
  sees the whole range.
- The faster it runs, the more often it is redrawn, one column at a time.
- There is no text and no number on the line.

The plugin is a mod (`hooks/register.tsx`) that draws the line and a script
(`taxi-horse`, `meter.py`) that counts the tokens. The mod runs the script
once a second.

## Install

These steps are written so that a coding agent can follow them. Run them in
order. Each step says what to expect.

Tested with Claude Code 2.1.330 and Python 3.12.3 on Linux.

### 0. Before you start

- `REPO` below is the absolute path of this folder. Claude Code runs the
  plugin from here: do not copy it elsewhere, and tell the user that moving
  or deleting the folder removes the line.
- Step 2 changes `~/.claude/settings.json`, which applies to every session
  of the user. If the user has not asked for that, ask first.
- Nothing here needs the network or root.

### 1. Check the prerequisites

```sh
REPO=/absolute/path/to/taxi_horse
/usr/bin/python3 --version        # the launcher's shebang is /usr/bin/python3
claude --version
"$REPO/taxi-horse" --demo         # prints 21 lines of coins and animals, exit 0
```

If a coin or an animal shows as an empty box, the terminal has no colour
emoji font with Unicode 13 (the coin is U+1FA99). Say so and go on: the
install is the same.

### 2. Install the plugin

```sh
claude plugin marketplace add "$REPO"
claude plugin install taxi-horse@taxi-horse --scope user
claude plugin list
```

Expect `Successfully added marketplace: taxi-horse`, then
`Successfully installed plugin: taxi-horse@taxi-horse (scope: user)`, and in
the list:

```
taxi-horse@taxi-horse
  Read from: /absolute/path/to/taxi_horse
  Status: ✔ enabled
```

Sessions started after this show the line. A session that was already open
shows it after `/reload-plugins`, typed by the user at its prompt, or after
a restart.

Do not set taxi-horse as the `statusLine` command as well: see "The other
way to run it" below.

### 3. Seed the speed history (optional)

```sh
"$REPO/taxi-horse" --learn
```

This reads the user's recent transcripts under `~/.claude/projects` and
writes `~/.local/state/taxi-horse/rates.json`. It prints the number of
samples and the speed at which each animal starts. Without this step the
meter starts from a built-in range and adapts as the user works.

### 4. Verify

What the mod runs, without touching any real state:

```sh
D=$(mktemp -d)
echo '{"session_id":"install-check"}' | XDG_RUNTIME_DIR="$D" XDG_STATE_HOME="$D" "$REPO/taxi-horse" --state
rm -r "$D"
```

It prints `vacant 0`: no turn is running, speed level 0. Exit status 0.

In a session started after step 2, once it has run for a few seconds:

```sh
ls -l "$XDG_RUNTIME_DIR/taxi-horse/"
```

A `<session id>.mod` modified within the last 3 seconds means the mod is
drawing in that session, and `<session id>.json` is the meter's progress
through that session's transcript.

On screen the line is the row under the permission-mode line (`⏵⏵ ...`), or
right under the input box when that line is not shown.

## Uninstall

```sh
claude plugin uninstall taxi-horse@taxi-horse
claude plugin marketplace remove taxi-horse
```

Both commands edit `~/.claude/settings.json`. The state is in
`$XDG_RUNTIME_DIR/taxi-horse/` and `~/.local/state/taxi-horse/`; both can be
deleted.

## The other way to run it

Without the plugin, the script can draw the line itself as the `statusLine`
command:

```json
"statusLine": {
  "type": "command",
  "command": "/absolute/path/to/taxi_horse/taxi-horse",
  "refreshInterval": 1
}
```

The status line is the row right under the input box, above the
permission-mode line, and Claude Code redraws it once a second at most: the
animal moves one column a second whatever its speed.

Use one or the other. With both, the mod draws and the script prints
nothing, but Claude Code keeps the status line's row, so an empty row stays
under the input box.

## What it reads and writes

| Path | Use |
| --- | --- |
| the session's transcript, and `subagents/` beside it | read: token counts of each response |
| `$XDG_RUNTIME_DIR/taxi-horse/<session id>.*` | written: the meter's progress, the mod's sign of life. On tmpfs. |
| `$XDG_STATE_HOME/taxi-horse/rates.json` (default `~/.local/state`) | written at most once a minute by a busy session: the speed history |
| `~/.claude/projects/*/*.jsonl` | read by `--learn` only |

It makes no network requests.

## Commands

| Command | What it does |
| --- | --- |
| `taxi-horse --state` | what the mod runs: prints `<state> <level>` for the session on stdin |
| `taxi-horse` | as the `statusLine` command: prints the line |
| `taxi-horse --demo` | draws every state and every animal |
| `taxi-horse --levels` | the speed at which each animal starts, for this user |
| `taxi-horse --learn` | rebuilds the speed history from recent transcripts |

Both of the first two read `{"session_id": ..., "transcript_path": ...}` on
stdin. `TAXI_HORSE_DEBUG=<file>` in the environment appends one line per run
to that file: time, state, rate, level.

## Tests

```sh
cd "$REPO" && python3 -m unittest test_meter      # the script
claude plugin test "$REPO"                        # the mod draws what the script draws
claude plugin validate "$REPO"                    # the marketplace, the manifest, the mod's types
```

## Troubleshooting

- No line in a session: the plugin is not loaded there. Type
  `/reload-plugins` in it or restart it, and check `claude plugin list`.
- No line in any session: run the step 4 check. Anything but `vacant 0`
  and exit 0 is the script failing; its traceback is on stderr.
- An empty row under the input box: taxi-horse is also set as `statusLine`.
  Remove that setting.
- A coin or an animal is an empty box: the font lacks that emoji.
- How the counting, the states and the history work is in the docstring of
  `meter.py`.
