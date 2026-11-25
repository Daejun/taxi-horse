#!/usr/bin/env python3
"""Tests for meter.py. Run: python3 -m unittest -v test_meter  (from this directory)

Fixture transcripts and state files go to /dev/shm.
"""
import json
import os
import shutil
import sys
import tempfile
import unicodedata
import unittest
from datetime import datetime, timezone

import meter
from meter import HALT, RUN, VACANT

T0 = 1_800_000_000.0     # an arbitrary "now" for the fake clock
W = meter.WINDOW


def iso(t):
    return datetime.fromtimestamp(t, timezone.utc).isoformat().replace("+00:00", "Z")


def assistant(t, mid, usage, blocks=("text",), sidechain=False, model="claude-x"):
    keys = ("input_tokens", "cache_creation_input_tokens",
            "cache_read_input_tokens", "output_tokens")
    return {"type": "assistant", "timestamp": iso(t), "isSidechain": sidechain,
            "message": {"id": mid, "model": model, "usage": dict(zip(keys, usage)),
                        "content": [{"type": b} for b in blocks]}}


def prompt(t, text="do it"):
    return {"type": "user", "timestamp": iso(t), "permissionMode": "default",
            "promptSource": "typed", "message": {"role": "user", "content": text}}


def tool_result(t):
    return {"type": "user", "timestamp": iso(t), "toolUseResult": {},
            "message": {"role": "user", "content": [{"type": "tool_result", "content": "ok"}]}}


def columns(s):
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in s)


def compact(d):
    # Claude Code writes compact JSON; the meter's line filter relies on it.
    return json.dumps(d, separators=(",", ":"))


class MeterTest(unittest.TestCase):
    def setUp(self):
        base = "/dev/shm" if os.path.isdir("/dev/shm") else None
        self.dir = tempfile.mkdtemp(prefix="taxi-horse-test-", dir=base)
        self.addCleanup(shutil.rmtree, self.dir)
        self.transcript = os.path.join(self.dir, "sess.jsonl")
        self.state = os.path.join(self.dir, "state")
        self.rates = os.path.join(self.dir, "history", "rates.json")
        self.data = {"session_id": "sess", "transcript_path": self.transcript}

    def write(self, *lines, path=None, raw=None):
        path = path or self.transcript
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a") as f:
            for d in lines:
                f.write(compact(d) + "\n")
            if raw is not None:
                f.write(raw)

    def run_meter(self, now, **kw):
        """(state, tok/s, tokens counted, catching_up, distance run, level)"""
        return meter.measure(self.data, now, directory=self.state, rates=self.rates, **kw)[:6]

    def run_mark(self, now):
        """(state, what goes behind the animal)"""
        m = meter.measure(self.data, now, directory=self.state, rates=self.rates)
        return m[0], m[6]

    def totals(self):
        with open(os.path.join(self.state, "sess.json")) as f:
            return json.load(f)["tot"]

    # ---- counting

    def test_no_transcript_yet(self):
        self.assertEqual(self.run_meter(T0), (VACANT, 0.0, 0, False, 0.0, 0))

    def test_response_written_as_several_lines_counts_once(self):
        self.run_meter(T0)                           # meter is live from here
        u = [2, 1000, 50000, 300]
        self.write(prompt(T0 + 1),
                   assistant(T0 + 5, "m1", u, ["thinking"]),
                   assistant(T0 + 6, "m1", u, ["tool_use"]),
                   assistant(T0 + 7, "m1", u, ["tool_use"]))
        _, tok_s, tokens = self.run_meter(T0 + 8)[:3]
        self.assertEqual(self.totals(), u)
        self.assertEqual(tokens, 1302)               # cache read left out
        self.assertAlmostEqual(tok_s, 1302 / W)

    def test_usage_that_grows_between_lines_counts_at_its_largest(self):
        self.run_meter(T0)
        self.write(assistant(T0 + 1, "m1", [2, 100, 0, 10]))
        self.run_meter(T0 + 2)
        self.write(assistant(T0 + 3, "m1", [2, 100, 0, 250]))
        _, tok_s, tokens = self.run_meter(T0 + 4)[:3]
        self.assertEqual(tokens, 352)
        self.assertAlmostEqual(tok_s, 352 / W)

    def test_synthetic_error_message_is_not_counted(self):
        self.run_meter(T0)
        self.write(assistant(T0 + 1, "m1", [5, 5, 5, 5], model="<synthetic>"))
        self.assertEqual(self.run_meter(T0 + 2)[2], 0)

    def test_subagent_transcripts_are_included_and_ids_deduplicated(self):
        self.run_meter(T0)
        side = os.path.join(self.dir, "sess", "subagents", "agent-a.jsonl")
        deep = os.path.join(self.dir, "sess", "subagents", "workflows", "wf_1", "agent-b.jsonl")
        self.write(assistant(T0 + 1, "m1", [1, 10, 0, 100]))
        self.write(assistant(T0 + 2, "s1", [1, 20, 0, 200], sidechain=True),
                   assistant(T0 + 2, "m1", [1, 10, 0, 100], sidechain=True), path=side)
        self.write(assistant(T0 + 3, "w1", [1, 30, 0, 300], sidechain=True), path=deep)
        self.assertEqual(self.run_meter(T0 + 4)[2], 111 + 221 + 331)

    # ---- incremental reading

    def test_reads_only_appended_lines_and_waits_for_a_whole_line(self):
        self.run_meter(T0)
        half = compact(assistant(T0 + 3, "m2", [0, 0, 0, 40]))
        self.write(assistant(T0 + 1, "m1", [0, 0, 0, 60]), raw=half[:50])
        self.assertEqual(self.run_meter(T0 + 2)[2], 60)
        self.write(raw=half[50:] + "\n")
        self.assertEqual(self.run_meter(T0 + 4)[2], 100)
        self.assertEqual(self.run_meter(T0 + 5)[2], 100)

    def test_replaced_transcript_rebuilds_the_state(self):
        self.run_meter(T0)
        self.write(assistant(T0 + 1, "m1", [0, 0, 0, 500]), assistant(T0 + 2, "m2", [0, 0, 0, 500]))
        self.assertEqual(self.run_meter(T0 + 3)[2], 1000)
        os.unlink(self.transcript)
        self.write(assistant(T0 + 4, "m9", [0, 0, 0, 70]))
        self.assertEqual(self.run_meter(T0 + 5)[2], 70)

    def test_catching_up_over_several_runs_reaches_the_same_total(self):
        self.write(*[assistant(T0 - 9000 + i, "m%d" % i, [1, 2, 3, 4]) for i in range(400)])
        runs = 0
        while True:
            _, _, tokens, catching_up = self.run_meter(T0, budget=0.0)[:4]
            runs += 1
            if not catching_up:
                break
        self.assertGreater(runs, 1)
        self.assertEqual(tokens, 400 * 7)

    # ---- rate

    def test_token_stays_in_the_rate_for_one_window_from_when_it_is_seen(self):
        self.run_meter(T0)
        # The line says T0+1 but the meter only sees it at T0+50 (late flush).
        self.write(assistant(T0 + 1, "m1", [0, 0, 0, int(100 * W)]))
        self.assertAlmostEqual(self.run_meter(T0 + 50)[1], 100.0)
        self.assertAlmostEqual(self.run_meter(T0 + 50 + W - 1)[1], 100.0)
        self.assertEqual(self.run_meter(T0 + 50 + W + 1)[1], 0.0)

    def test_history_read_on_the_first_pass_keeps_its_own_time(self):
        self.write(assistant(T0 - 3600, "old", [0, 0, 0, 9000]),
                   assistant(T0 - 30, "recent", [0, 0, 0, int(10 * W)]))
        _, tok_s, tokens = self.run_meter(T0)[:3]
        self.assertEqual(tokens, 9000 + int(10 * W))
        self.assertAlmostEqual(tok_s, 10.0)           # only what is inside the window
        self.assertEqual(self.run_meter(T0 + W - 29)[1], 0.0)

    def test_old_lines_seen_late_are_history_not_a_spike(self):
        self.run_meter(T0)
        self.write(assistant(T0 + 1, "m1", [0, 0, 0, 6000]))
        self.assertEqual(self.run_meter(T0 + 1 + meter.LAG_MAX + 5)[1], 0.0)

    # ---- is a turn in progress

    def test_turn_lifecycle(self):
        self.run_meter(T0)
        state = lambda now: self.run_meter(now)[0]
        self.write(prompt(T0 + 1))
        self.assertEqual(state(T0 + 2), RUN, "request out")
        u = [0, 0, 0, 100]
        self.write(assistant(T0 + 5, "m1", u, ["tool_use"]), assistant(T0 + 5, "m1", u, ["tool_use"]))
        self.assertEqual(state(T0 + 6), HALT, "two tools running")
        self.write(tool_result(T0 + 7))
        self.assertEqual(state(T0 + 8), HALT, "one tool still running")
        self.write(tool_result(T0 + 9))
        self.assertEqual(state(T0 + 10), RUN, "next request out")
        self.write(assistant(T0 + 12, "m2", u, ["text"]))
        self.assertEqual(state(T0 + 13), VACANT, "turn over")
        self.assertGreater(self.run_meter(T0 + 13)[1], 0, "the rate still covers the window")

    def test_subagent_request_runs_the_horse_while_the_main_thread_waits_on_its_tool(self):
        self.run_meter(T0)
        side = os.path.join(self.dir, "sess", "subagents", "agent-a.jsonl")
        self.write(prompt(T0 + 1), assistant(T0 + 3, "m1", [0, 0, 0, 100], ["tool_use"]))
        self.assertEqual(self.run_meter(T0 + 4)[0], HALT)
        self.write({"type": "user", "timestamp": iso(T0 + 4), "isSidechain": True,
                    "message": {"role": "user", "content": "look into it"}}, path=side)
        self.assertEqual(self.run_meter(T0 + 5)[0], RUN)

    def test_tool_call_without_a_result_stops_counting_as_running(self):
        self.run_meter(T0)
        self.write(assistant(T0 + 1, "m1", [0, 0, 0, 100], ["tool_use"]))
        self.assertEqual(self.run_meter(T0 + 2 + meter.ACTIVE_MAX)[0], HALT)
        self.assertEqual(self.run_meter(T0 + 2 + meter.HALT_MAX)[0], VACANT)

    def test_interrupt_ends_the_turn(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1))
        self.assertEqual(self.run_meter(T0 + 2)[0], RUN)
        self.write({"type": "user", "timestamp": iso(T0 + 3),
                    "message": {"role": "user",
                                "content": [{"type": "text", "text": "[Request interrupted by user]"}]}})
        self.assertEqual(self.run_meter(T0 + 4)[0], VACANT)

    def test_local_command_output_starts_no_turn(self):
        self.run_meter(T0)
        for text, extra in (("<local-command-caveat>x", {"isMeta": True}),
                            ("<command-name>/model</command-name>", {}),
                            ("<local-command-stdout>ok</local-command-stdout>", {}),
                            ("summary", {"isCompactSummary": True})):
            self.write(dict({"type": "user", "timestamp": iso(T0 + 1),
                             "message": {"role": "user", "content": text}}, **extra))
        self.assertEqual(self.run_meter(T0 + 2)[0], VACANT)

    def test_subagent_prompt_starts_a_turn(self):
        self.run_meter(T0)
        side = os.path.join(self.dir, "sess", "subagents", "agent-a.jsonl")
        self.write({"type": "user", "timestamp": iso(T0 + 1), "isSidechain": True,
                    "message": {"role": "user", "content": "look into it"}}, path=side)
        self.assertEqual(self.run_meter(T0 + 2)[0], RUN)

    def test_request_without_an_answer_stops_counting_as_running(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1))
        self.assertEqual(self.run_meter(T0 + 2)[0], RUN)
        self.assertEqual(self.run_meter(T0 + 2 + meter.ACTIVE_MAX + 1)[0], VACANT)

    # ---- where the animal is

    def test_horse_stops_and_starts_again_where_it_stands(self):
        self.run_meter(T0)
        dist = lambda now: self.run_meter(now)[4]
        self.write(prompt(T0 + 1))
        self.assertEqual(dist(T0 + 2), 0.0, "first redraw of a run moves nothing")
        self.assertEqual(dist(T0 + 3), 1.0, "one column a second")
        self.assertEqual(dist(T0 + 4), 2.0)
        self.write(assistant(T0 + 5, "m1", [0, 0, 0, 100], ["tool_use"]))
        self.assertEqual(self.run_meter(T0 + 5)[0], HALT)
        self.assertEqual(dist(T0 + 9), 2.0, "stands still while the tool runs")
        self.write(tool_result(T0 + 10))
        self.assertEqual(self.run_meter(T0 + 10)[0], RUN)
        self.assertEqual(dist(T0 + 10.5), 2.5, "goes on from where it stood")
        self.write(assistant(T0 + 11, "m2", [0, 0, 0, 100], ["text"]))
        self.assertEqual(self.run_meter(T0 + 11)[0], VACANT)
        self.assertEqual(dist(T0 + 60), 2.5, "sleeps where it stopped")
        self.write(prompt(T0 + 61))
        self.assertEqual(dist(T0 + 62), 2.5, "next turn starts from the same place")
        self.assertEqual(dist(T0 + 63), 3.5)

    def test_gap_in_the_redraws_is_not_a_leap(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1))
        self.run_meter(T0 + 2)
        self.assertEqual(self.run_meter(T0 + 200)[4], 2.0)

    def test_animal_moves_one_column_a_second_at_any_speed(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, int(520 * W)], ["tool_use"]),
                   tool_result(T0 + 3))
        state, tok_s = self.run_meter(T0 + 4)[:2]
        self.assertEqual((state, round(tok_s)), (RUN, 520))
        self.assertEqual(self.run_meter(T0 + 5)[4], 1.0)
        self.assertEqual(self.run_meter(T0 + 6)[4], 2.0)

    # ---- which animal a speed gets

    def history_of(self, rates):
        hist = [0.0] * meter.HIST_SIZE
        for r in rates:
            hist[int(meter.bucket_pos(r))] += 1
        return hist

    def test_without_a_history_the_built_in_guess_stands(self):
        self.assertEqual([meter.level(r) for r in (0, 1, 30, 10**4, 10**6)], [0, 0, 0, 16, 16])
        levels = [meter.level(r) for r in range(1, 6000, 7)]
        self.assertEqual(levels, sorted(levels), "a faster rate is never a slower animal")
        self.assertEqual(set(levels), set(range(17)), "every animal can be reached")
        self.assertEqual(meter.level(300), meter.level(300, [0.0] * meter.HIST_SIZE))

    def test_level_is_where_the_rate_stands_among_the_users_own(self):
        # Two users: one usually between 500 and 8000 tok/s, one between 20 and 300.
        import random
        rnd = random.Random(7)
        for lo, hi in ((500, 8000), (20, 300)):
            own = [lo * (hi / lo) ** rnd.random() for _ in range(5000)]
            hist = self.history_of(own)
            seen = [meter.level(r, hist) for r in own]
            share = [seen.count(k) / len(seen) for k in range(17)]
            self.assertGreater(min(share), 0.03, "every animal turns up: %r" % share)
            self.assertLess(max(share), 0.09, "and none much more than the others: %r" % share)
            self.assertEqual(meter.level(lo * 0.9, hist), 0)
            self.assertEqual(meter.level(hi * 1.1, hist), 16)
            starts = meter.level_starts(hist)
            self.assertEqual(starts, sorted(starts))
            self.assertEqual([meter.level(x * 1.001, hist) for x in starts], list(range(1, 17)))
        fast, slow = self.history_of([4000] * 3000), self.history_of([60] * 3000)
        self.assertLess(meter.level(400, fast), meter.level(400, slow),
                        "the same rate is a slower animal for the faster user")

    def test_history_holds_a_bounded_number_of_samples_and_merges_add(self):
        meter.merge_rates(self.rates, {"40": 3, "41": 1})
        meter.merge_rates(self.rates, {"40": 2})
        hist = meter.load_rates(self.rates)
        self.assertEqual((hist[40], hist[41], sum(hist)), (5.0, 1.0, 6.0))
        meter.merge_rates(self.rates, {"90": int(meter.HIST_CAP * 3)})
        hist = meter.load_rates(self.rates)
        self.assertAlmostEqual(sum(hist), meter.HIST_CAP, delta=1)
        self.assertLess(hist[40], 5.0, "older samples fade")
        with open(self.rates, "w") as f:
            f.write("not json")
        self.assertEqual(sum(meter.load_rates(self.rates)), 0.0)

    def test_running_session_adds_its_rate_to_the_history_once_a_minute(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, int(300 * W)], ["tool_use"]),
                   tool_result(T0 + 3))
        for i in range(4, 4 + 70):
            self.run_meter(T0 + i)
        hist = meter.load_rates(self.rates)
        expected = 1 + 60 / meter.SAMPLE_EVERY
        self.assertAlmostEqual(sum(hist), expected, delta=2)
        self.assertEqual(hist[int(meter.bucket_pos(300))], sum(hist), "all in the bucket of 300 tok/s")
        self.assertTrue(os.path.exists(os.path.join(self.state, "sess.json")))

    def test_idle_session_adds_nothing(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, int(300 * W)], ["text"]))
        for i in range(3, 3 + 90):
            state, tok_s = self.run_meter(T0 + i)[:2]
        self.assertEqual(state, VACANT)
        self.assertGreater(tok_s, 0)
        self.assertEqual(sum(meter.load_rates(self.rates)), 0.0)

    def test_level_follows_the_history_as_it_grows(self):
        meter.save_rates(self.rates, self.history_of([3000] * 2000))
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, int(300 * W)], ["tool_use"]),
                   tool_result(T0 + 3))
        self.assertLess(self.run_meter(T0 + 4)[5], 3, "300 tok/s is slow for someone used to 3000")
        os.unlink(self.rates)
        self.assertGreater(self.run_meter(T0 + 5)[5], 5)

    def test_learn_rebuilds_the_history_from_transcripts(self):
        root = os.path.join(self.dir, "projects")
        lines = [prompt(T0)]
        for i in range(20):                          # a response every 10 s, 100 tok/s
            lines.append(assistant(T0 + 10 * (i + 1), "m%d" % i, [0, 0, 0, 1000]))
        self.write(*lines, path=os.path.join(root, "proj", "aaaa.jsonl"))
        n = meter.learn(root=root, path=self.rates)
        hist = meter.load_rates(self.rates)
        self.assertEqual(n, int(sum(hist)))
        self.assertGreater(n, 30)
        steady = int(meter.bucket_pos(100))
        self.assertGreater(hist[steady] + hist[steady - 1], 0, "the steady rate is in it")
        self.assertEqual(sum(hist[int(meter.bucket_pos(120)) + 1:]), 0, "nothing faster than it ran")

    # ---- handing the drawing to the mod

    def test_script_stays_quiet_only_while_the_mod_is_alive(self):
        os.makedirs(self.state)
        self.assertFalse(meter.mod_draws(self.state, "sess", T0))
        sign = os.path.join(self.state, "sess.mod")
        open(sign, "w").close()
        os.utime(sign, (T0, T0))
        self.assertTrue(meter.mod_draws(self.state, "sess", T0 + 1))
        self.assertFalse(meter.mod_draws(self.state, "sess", T0 + meter.MOD_FRESH + 1))
        self.assertFalse(meter.mod_draws(self.state, "other", T0 + 1))

    def run_cli(self, *args, env=None, flags=()):
        import subprocess
        env = dict(os.environ, XDG_RUNTIME_DIR=self.dir, XDG_STATE_HOME=os.path.join(self.dir, "home-state"),
                   **(env or {}))
        launcher = os.path.join(os.path.dirname(os.path.abspath(meter.__file__)), "taxi-horse")
        # The way the mod runs it: the interpreter named, not the launcher's shebang.
        return subprocess.run([sys.executable, *flags, "-IS", launcher, *args], input=compact(self.data),
                              env=env, capture_output=True, encoding="utf-8")

    def test_draws_in_utf8_on_a_pipe_whose_encoding_is_not(self):
        # On Windows a pipe has the ANSI code page, which has no emoji. Here
        # the C locale without UTF-8 mode gives a pipe in ASCII.
        out = self.run_cli(env={"LC_ALL": "C"}, flags=("-X", "utf8=0"))
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn(meter.COIN, out.stdout)

    def test_reads_its_input_as_utf8_whatever_the_locale(self):
        # Claude Code writes the JSON in UTF-8, non-ASCII as it is, and on
        # Windows a pipe is read in the ANSI code page.
        import io
        from unittest import mock
        path = "C:\\Users\\대준\\.claude\\projects\\C--x\\s.jsonl"
        raw = json.dumps({"session_id": "s", "transcript_path": path}, ensure_ascii=False).encode("utf-8")
        for encoding in ("cp949", "cp1252"):
            stdin = io.TextIOWrapper(io.BytesIO(raw), encoding=encoding, errors="replace")
            with mock.patch.object(sys, "stdin", stdin):
                self.assertEqual(meter.read_input()["transcript_path"], path, encoding)

    def test_state_dir_on_windows_is_in_the_users_temp_folder(self):
        # Windows has no XDG_RUNTIME_DIR, no /dev/shm and no os.getuid. The mod
        # puts its sign of life in the same folder.
        from unittest import mock
        env = {k: v for k, v in os.environ.items() if k != "XDG_RUNTIME_DIR"}
        env["TEMP"] = self.dir
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(meter.os, "name", "nt"), \
                mock.patch.object(meter.os, "getuid", side_effect=AttributeError("getuid"), create=True):
            self.assertEqual(meter.state_dir(), os.path.join(self.dir, "taxi-horse"))

    def test_state_mode_answers_the_mod_with_state_and_level_and_draws_nothing(self):
        now = datetime.now(timezone.utc).timestamp()
        self.write(prompt(now - 2))
        out = self.run_cli("--state")
        self.assertEqual((out.returncode, out.stdout), (0, "run 0\n"))
        self.write(assistant(now - 1, "m1", [0, 0, 0, 50], ["text"]))
        out = self.run_cli("--state")
        self.assertEqual(out.returncode, 0)
        state, level = out.stdout.split()
        self.assertEqual(state, VACANT)
        self.assertIn(int(level), range(17))
        drawn = self.run_cli()
        asleep = meter.render(VACANT, 0, 0.0, width=meter.TRACK)
        self.assertIn(drawn.stdout.rstrip("\n"), (asleep, asleep.replace("💤", "")),
                      "without --state the same run draws the line, its zzz there or gone")

    # ---- drawing

    def plain(self, ph, lvl, dist, **kw):
        return meter.render(ph, lvl, dist, width=meter.TRACK, **kw)

    def test_state_mode_has_no_third_word_while_tools_run(self):
        now = datetime.now(timezone.utc).timestamp()
        self.write(prompt(now - 30), assistant(now - 20, "m1", [0, 0, 0, 50], ["tool_use"]))
        out = self.run_cli("--state")
        self.assertEqual((out.returncode, out.stdout), (0, "halt 0\n"))

    def test_state_mode_says_home_for_a_session_with_nothing_yet(self):
        self.data = {"session_id": "fresh"}
        out = self.run_cli("--state")
        self.assertEqual((out.returncode, out.stdout), (0, "vacant 0 home\n"))

    def test_every_level_has_its_own_animal_and_none_is_a_dragon(self):
        animals = [meter.animal(n) for n in range(meter.LEVEL_MAX + 1)]
        self.assertEqual("".join(animals), "🐌🐢🦔🐁🐓🐖🐑🐘🐪🐕🐇🦘🦌🐎🐅🐆🦅")
        self.assertEqual(len(set(animals)), meter.LEVEL_MAX + 1)
        self.assertNotIn("🐉", animals)
        for g in animals:
            self.assertEqual((len(g), columns(g)), (1, 2), "one code point, two columns: " + g)
        self.assertEqual(meter.animal(99), "🦅")
        for ph in (RUN, HALT):
            self.assertIn(meter.animal(12), self.plain(ph, 12, 9.0))

    def test_line_is_only_coins_an_animal_and_its_zzz_or_wrench(self):
        animals = {g for _, g in meter.ANIMALS}
        for ph in (RUN, HALT, VACANT):
            for lvl in (0, 5, 16):
                for d in range(0, 90):
                    line = self.plain(ph, lvl, float(d))
                    behind = {VACANT: "💤", HALT: meter.TOOL, RUN: ""}[ph]
                    self.assertEqual(set(line) - animals - set(" " + behind + meter.COIN + meter.EATEN), set(), line)
                    self.assertEqual(sum(line.count(g) for g in animals), 1, line)
        self.assertEqual(self.plain(RUN, 7, 9.0), self.plain(HALT, 7, 9.0).replace(meter.TOOL, ""),
                         "nothing but the wrench and the motion tells them apart")
        self.assertNotIn("\033", self.plain(RUN, 16, 9.0))

    def test_line_fits_the_track_and_has_no_trailing_blanks(self):
        for ph in (RUN, HALT, VACANT):
            for lvl in (0, 7, 16):
                for d in range(0, 90):
                    line = self.plain(ph, lvl, float(d))
                    # The zzz or the wrench of an animal at the right end sticks out past the track.
                    x = meter.animal_column(float(d), meter.TRACK)
                    extra = max(0, x + 4 - meter.TRACK) if ph != RUN else 0
                    self.assertLessEqual(columns(line), meter.TRACK + extra, (ph, lvl, d, line))
                    self.assertEqual(line, line.rstrip(" "))

    def test_line_starts_with_a_coin_or_the_animal_never_with_a_blank(self):
        for ph in (RUN, HALT, VACANT):
            for lvl in (0, 7, 16):
                for d in range(0, 90):
                    self.assertIn(self.plain(ph, lvl, float(d))[0],
                                  (meter.COIN, meter.animal(0 if ph == VACANT else lvl)))

    def test_animal_runs_right_to_left_then_onto_the_last_coin(self):
        w = meter.TRACK
        lap = meter.lap_length(w)
        self.assertEqual(meter.animal_column(0.0, w), w - 2)
        self.assertEqual(meter.animal_column(1.9, w), w - 3)
        self.assertEqual(meter.animal_column(lap - 2.0, w), 2)
        self.assertEqual(meter.animal_column(lap - 1.0, w), 0)
        self.assertEqual(meter.animal_column(float(lap), w), w - 2)
        self.assertNotIn(1, {meter.animal_column(float(d), w) for d in range(300)})

    W = meter.TRACK
    COINS = list(meter.coin_columns(meter.TRACK))
    # The coins in the order the animal eats them, but for the last, at the left end.
    A, B, C, D = COINS[:0:-1]

    def reach(self, column):
        """How far the animal has run on a lap when it is at a column."""
        return float(self.W - 2 - column)

    def paid(self, ph, lvl, dist, **kw):
        """The line when the stretch up to every coin eaten on this lap has cost five cents."""
        x = meter.animal_column(dist, self.W)
        return self.plain(ph, lvl, dist, stamps={c: 0.05 for c in self.COINS if c >= x}, **kw)

    def test_coins_ahead_of_the_animal_and_fares_where_it_has_eaten(self):
        w = self.W
        lap = meter.lap_length(w)
        spots = self.COINS
        self.assertEqual((w, meter.COIN_GAP, spots), (48, 10, [0, 10, 20, 30, 40]))
        for ph in (RUN, HALT, VACANT):
            start = self.paid(ph, 7, 0.0)
            self.assertEqual((start.count(meter.COIN), start.count(meter.EATEN)), (5, 0),
                             "a full row of coins at the start of a lap")
            coins, eaten = [], []
            for d in range(lap):
                line = self.paid(ph, 7, float(d))
                x = meter.animal_column(float(d), w)
                here = line.index(meter.animal(0 if ph == VACANT else 7))
                coins.append(line.count(meter.COIN))
                eaten.append(line.count(meter.EATEN))
                self.assertEqual(coins[-1], sum(1 for c in spots if c + 1 < x), (ph, d, line))
                self.assertEqual(eaten[-1], line.count(meter.EATEN + "0.05"), "a dollar sign only with its fare")
                self.assertNotIn(meter.COIN, line[here:], "no coin behind the animal")
                self.assertNotIn(meter.EATEN, line[:here], "no fare of this lap ahead of it")
                self.assertEqual(columns(line[:here]), x, "nothing has pushed the animal aside")
                self.assertLessEqual(coins[-1] + eaten[-1], 5)
                # Without a fare an eaten coin leaves nothing.
                bare = self.plain(ph, 7, float(d))
                self.assertNotIn(meter.EATEN, bare)
                self.assertEqual(bare, line.replace(meter.EATEN + "0.05", " " * 6).rstrip(" "))
            self.assertEqual(coins, sorted(coins, reverse=True), "only ever fewer coins within a lap")
            self.assertEqual(coins[-1], 0, "the last one is eaten at the left end")
            self.assertEqual(max(eaten), 4, "every coin but the last can leave a fare")
        self.assertEqual(self.paid(RUN, 7, self.reach(self.C - 1)).count(meter.EATEN), 2, "the third is under the animal")
        self.assertEqual(self.paid(RUN, 7, self.reach(self.C - 2)).count(meter.EATEN), 3)
        again = self.paid(RUN, 7, float(lap))
        self.assertEqual((again.count(meter.COIN), again.count(meter.EATEN)), (5, 0), "new coins on the next lap")

    def test_fare_gives_way_to_the_animal_and_its_zzz_or_wrench(self):
        w = self.W
        for d in range(meter.lap_length(w)):
            for ph in (RUN, HALT, VACANT):
                line = self.paid(ph, 3, float(d))
                self.assertEqual(sum(line.count(g) for _, g in meter.ANIMALS), 1, line)
                if ph == VACANT:
                    self.assertIn("🐌💤", line, "the zzz stays next to the animal: %r" % line)
                if ph == HALT:
                    self.assertIn(meter.animal(3) + meter.TOOL, line, "and so does the wrench: %r" % line)

    def test_wrench_and_zzz_blink_and_their_place_stays_empty_meanwhile(self):
        self.assertEqual([meter.blink_shows(t) for t in (0, 0.999, 1.0, 1.999, 2.0, T0, T0 + 1.5)],
                         [True, True, False, False, True, True, False], "a second there, a second gone")
        for d in range(0, 2 * meter.lap_length(self.W)):
            for ph, mark, glyph in ((VACANT, "", "💤"), (VACANT, meter.HOME, "💤"), (HALT, "", meter.TOOL)):
                there = self.paid(ph, 7, float(d), mark=mark)
                gone = self.paid(ph, 7, float(d), mark=mark, blink=False)
                self.assertEqual(there.count(glyph), 1, there)
                self.assertEqual(gone, there.replace(glyph, "  ").rstrip(" "),
                                 "nothing else moves, and what it hides does not come back")
            for ph, mark in ((RUN, ""), (RUN, meter.GUST), (RUN, meter.FIRE)):
                self.assertEqual(self.paid(ph, 7, float(d), mark=mark, blink=False), self.paid(ph, 7, float(d), mark=mark),
                                 "the wind and the fire of a running animal stay")
        self.assertEqual(self.plain(VACANT, 7, 11.0, blink=False), "🪙        🪙        🪙        🪙   🐌")
        self.assertEqual(self.plain(HALT, 7, 11.0, blink=False), "🪙        🪙        🪙        🪙   🐘")

    def test_lap_before_turns_back_into_coins_one_coin_at_a_time(self):
        A, B, C, D = self.A, self.B, self.C, self.D
        lap = meter.lap_length(self.W)
        left = {A: 0.05, B: 0.002, C: 0.19, D: 1.2, 0: 0.03}
        self.assertEqual(self.plain(RUN, 7, lap - 1.0, stamps=left), "🐘        💲1.20    💲0.19    🐾        💲0.05")
        # The lap starts: only the coin ahead of the animal is back.
        self.assertEqual(self.plain(RUN, 7, float(lap), stamps=left), "💲0.03    💲1.20    💲0.19    🐾        🪙    🐘")
        # Each of the others comes back when the animal is a coin and a half away:
        # halfway between two coins, so not as it eats one.
        self.assertEqual(meter.REFILL, 15)
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(B + meter.REFILL + 1), stamps=left), "💲0.03    💲1.20    💲0.19    🐾        🪙    🐘")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(B + meter.REFILL), stamps=left), "💲0.03    💲1.20    💲0.19    🪙        🪙   🐘")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(A), stamps={B: 0.002, C: 0.19, D: 1.2, 0: 0.03}), "💲0.03    💲1.20    💲0.19    🪙        🐘",
                         "the animal eats the first coin, and nothing ahead of it changes")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(A - 2), stamps={A: 0.3, B: 0.002, C: 0.19, D: 1.2, 0: 0.03}),
                         "💲0.03    💲1.20    💲0.19    🪙      🐘💲0.30")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(C + meter.REFILL), stamps={A: 0.3, B: 0.002, C: 0.19, D: 1.2, 0: 0.03}),
                         "💲0.03    💲1.20    🪙        🪙   🐘   💲0.30")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(B), stamps={A: 0.3, C: 0.19, D: 1.2, 0: 0.03}), "💲0.03    💲1.20    🪙        🐘        💲0.30")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(D), stamps={A: 0.3, B: 0.0, C: 0.0, 0: 0.03}), "🪙        🐘        🐾        🐾        💲0.30")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(meter.REFILL), stamps={A: 0.3, B: 0.0, C: 0.0, 0: 0.03}), "🪙        🪙   🐘   🐾        🐾        💲0.30")
        self.assertEqual(self.plain(RUN, 7, lap + self.reach(D - 2), stamps={A: 0.3, B: 0.0, C: 0.0, D: 0.0, 0: 0.03}), "🪙      🐘🐾        🐾        🐾        💲0.30",
                         "the last to come back is the coin at the left end")
        # Whatever the lap before left, and whatever the animal does meanwhile.
        was = {A: meter.EATEN, B: meter.PRINTS, C: meter.EATEN, D: meter.EATEN, 0: meter.EATEN}
        for ph, mark in ((RUN, ""), (RUN, meter.FIRE), (HALT, ""), (VACANT, ""), (VACANT, meter.HOME)):
            back = []
            for d in range(lap):
                x = meter.animal_column(float(d), self.W)
                line = self.plain(ph, 7, float(d), mark=mark, stamps={c: usd for c, usd in left.items() if c < x})
                self.assertNotEqual(line[0], " ", "the line never starts with a blank")
                for c in (A, B, C, D, 0):
                    if c + 1 < x:
                        want = meter.COIN if x <= c + meter.REFILL else was[c]
                        self.assertEqual(self.glyph_at(line, c), want, (ph, mark, d, c, line))
                back.append(sum(1 for c in (A, B, C, D, 0) if x <= c + meter.REFILL))
                self.assertLessEqual(columns(line), self.W + 2, line)
            self.assertEqual(back[0], 1, "only the coin ahead at the start of the lap")
            self.assertEqual(sorted(set(back)), [1, 2, 3, 4, 5], "then one at a time")
            turns = [d for d in range(1, lap) if back[d] > back[d - 1]]
            self.assertEqual(turns, [int(self.reach(c + meter.REFILL)) for c in (B, C, D, 0)],
                             "each when the animal is a coin and a half away")
            eats = [int(self.reach(c)) for c in (A, B, C, D, 0)]
            leaves = [int(self.reach(c - 2)) for c in (A, B, C, D)]
            self.assertEqual(set(turns) & set(eats + leaves), set(),
                             "never as the animal eats a coin, nor as what it leaves shows")

    def test_every_lap_is_drawn_at_the_last_coin_whatever_the_redraw_interval(self):
        w = meter.TRACK
        lap = meter.lap_length(w)
        for step in (0.4, 1.0, 1.7):                 # seconds between redraws
            path = os.path.join(self.dir, "lap%d.run" % (step * 10))
            columns_seen = [meter.animal_column(meter.advance(path, True, T0 + i * step, lap)[0], w)
                            for i in range(int(3 * lap / step) + 5)]
            self.assertEqual(columns_seen[0], w - 2)
            for i, x in enumerate(columns_seen[1:], 1):
                before = columns_seen[i - 1]
                if before == 0:
                    self.assertIn(x, (0, w - 2), "after the last coin: the right end again")
                elif x > before:
                    self.fail("jumped back to the right without eating the last coin: %r" % columns_seen)
            self.assertGreaterEqual(columns_seen.count(0), 3)

    def test_sleeping_animal_gets_its_zzz_only_between_turns(self):
        for lvl in range(meter.LEVEL_MAX + 1):
            asleep = self.plain(VACANT, lvl, 9.0)
            self.assertIn("🐌💤", asleep, "whatever it was, it sleeps as a snail")
            self.assertEqual(asleep, self.plain(VACANT, 0, 9.0))
        self.assertIn(meter.animal(8), self.plain(HALT, 8, 9.0), "standing, it stays what it was")
        self.assertNotIn("💤", self.plain(HALT, 0, 9.0))
        self.assertNotIn("💤", self.plain(RUN, 5, 9.0))

    # ---- what goes behind the animal: the speed of the moment

    def test_wind_when_the_moment_runs_at_three_times_the_average(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, 3000], ["tool_use"]),
                   tool_result(T0 + 3))
        self.assertEqual(self.run_mark(T0 + 4), (RUN, meter.GUST), "all the tokens of the window came just now")
        self.assertEqual(self.run_mark(T0 + 13), (RUN, meter.GUST))
        self.assertEqual(self.run_mark(T0 + 14), (RUN, ""), "ten seconds on, the moment is over")

    def test_wind_dies_down_as_the_average_catches_up(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1))
        marks = []
        for k in range(8):                 # the same response every ten seconds
            t = T0 + 2 + 10 * k
            self.write(assistant(t, "m%d" % k, [0, 0, 0, 1000], ["tool_use"]), tool_result(t + 1))
            marks.append(self.run_mark(t + 2))
        self.assertEqual(marks[:4], [(RUN, meter.GUST)] * 4, "from rest, the moment is ahead of the average")
        self.assertEqual(marks[4:], [(RUN, "")] * 4, "a steady speed has no wind")

    def test_no_wind_for_a_speed_that_is_still_a_snails(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, 300], ["tool_use"]),
                   tool_result(T0 + 3))
        self.assertEqual(self.run_mark(T0 + 4), (RUN, ""), "30 tok/s for a moment is no gust")

    def test_fire_when_the_moment_is_three_times_the_fastest_animals_start(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 200000, 0, 0], ["tool_use"]),
                   tool_result(T0 + 3))
        self.assertEqual(self.run_mark(T0 + 4), (RUN, meter.FIRE))
        # The line between wind and fire follows the user's own history.
        hist = [0.0] * meter.HIST_SIZE
        hist[int(meter.bucket_pos(100.0))] = 1000.0
        top = meter.level_starts(hist)[-1]
        for tokens, want in ((meter.FIRE_FACTOR * top * 10 - 10, meter.GUST), (meter.FIRE_FACTOR * top * 10, meter.FIRE)):
            st = {"ev": [(T0 - 1, tokens)]}
            self.assertEqual(meter.mark(st, T0, RUN, tokens / W, hist), want, tokens)

    def test_standing_animal_has_no_mark_and_no_zzz(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, 3000], ["tool_use"]))
        self.assertEqual(self.run_mark(T0 + 3), (HALT, ""), "it has only just stopped")
        self.assertEqual(self.run_mark(T0 + 13), (HALT, ""), "ten seconds without a token: a tool is at work")
        self.write(tool_result(T0 + 14))
        self.assertEqual(self.run_mark(T0 + 15), (RUN, ""), "a request is out")
        self.assertEqual(self.run_mark(T0 + 100), (RUN, ""), "no zzz while a request is out, however long it takes")
        self.write(assistant(T0 + 101, "m2", [0, 0, 0, 10], ["text"]))
        self.assertEqual(self.run_mark(T0 + 102), (VACANT, ""), "between turns the picture has its own zzz")

    def test_animal_goes_home_when_the_average_is_zero_too(self):
        self.assertEqual(self.run_mark(T0), (VACANT, meter.HOME), "a session that has not started is at home")
        self.write(prompt(T0 + 1))
        self.assertEqual(self.run_mark(T0 + 2), (RUN, ""), "a request is out: it is up, even at speed 0")
        self.write(assistant(T0 + 3, "m1", [0, 0, 0, 3000], ["tool_use"]))
        self.assertEqual(self.run_mark(T0 + 4), (HALT, ""))
        self.assertEqual(self.run_mark(T0 + 4 + W - 1), (HALT, ""), "the average still has the tokens")
        halted = meter.measure(self.data, T0 + 4 + W, directory=self.state, rates=self.rates)
        self.assertEqual((halted[0], halted[5], halted[6]), (HALT, 0, ""),
                         "a tool that runs on and on: the average is 0, and it stays out with its wrench")
        self.write(tool_result(T0 + 4 + W + 1), assistant(T0 + 4 + W + 2, "m2", [0, 0, 0, 3000], ["text"]))
        end = T0 + 4 + W + 3
        self.assertEqual(self.run_mark(end), (VACANT, ""), "the turn is over: asleep outside, as a snail")
        self.assertEqual(self.run_mark(end + W - 1), (VACANT, ""))
        self.assertEqual(self.run_mark(end + W), (VACANT, meter.HOME), "two minutes after the last token")

    def test_house_stands_in_place_of_the_animal_with_its_zzz(self):
        animals = {g for _, g in meter.ANIMALS}
        for lvl in (0, 7):
            for d in range(0, 90):
                line = self.plain(VACANT, lvl, float(d), mark=meter.HOME)
                self.assertEqual(line.count(meter.HOUSE + "💤"), 1, line)
                self.assertEqual(set(line) & animals, set(), line)
                self.assertEqual(line.index(meter.HOUSE), self.plain(VACANT, lvl, float(d)).index(meter.animal(0)),
                                 "where the animal stood")
                self.assertLessEqual(columns(line), meter.TRACK + 2, line)

    def test_mark_is_drawn_right_behind_the_animal(self):
        a = meter.animal(7)
        self.assertIn(a + "💨", self.plain(RUN, 7, 9.0, mark=meter.GUST))
        self.assertIn(a + "🔥", self.plain(RUN, 7, 9.0, mark=meter.FIRE))
        asleep = self.plain(VACANT, 7, 9.0, mark=meter.GUST)
        self.assertEqual(asleep, self.plain(VACANT, 7, 9.0), "between turns a mark changes nothing")
        for d in range(0, 90):
            line = self.plain(RUN, 7, float(d), mark=meter.FIRE)
            self.assertEqual((line.count(a + "🔥"), line.count("🔥")), (1, 1), line)
            self.assertLessEqual(columns(line), meter.TRACK + 2, line)
            self.assertEqual(line.index(a), self.plain(RUN, 7, float(d)).index(a), "the animal stays where it is")

    def test_wrench_stands_right_behind_an_animal_whose_tools_run(self):
        self.assertEqual((len(meter.TOOL), columns(meter.TOOL)), (1, 2), "one code point, two columns")
        for lvl in (0, 7, 16):
            a = meter.animal(lvl)
            for d in range(0, 90):
                line = self.plain(HALT, lvl, float(d))
                self.assertEqual((line.count(a + meter.TOOL), line.count(meter.TOOL)), (1, 1), line)
                self.assertNotIn("💤", line, "it is not asleep, even as a snail")
                self.assertLessEqual(columns(line), meter.TRACK + 2, line)
                self.assertEqual(line.index(a), self.plain(RUN, lvl, float(d)).index(a), "the animal stays where it is")
        self.assertNotIn(meter.TOOL, self.plain(RUN, 7, 9.0))
        self.assertNotIn(meter.TOOL, self.plain(VACANT, 7, 9.0), "asleep, it has its zzz")

    # ---- the fare

    def test_fare_has_as_many_decimals_as_fit_in_five_characters(self):
        self.assertEqual(meter.FARE_MAX, 5)
        for usd, text in ((0.006, "0.01"), (0.05, "0.05"), (1.239, "1.24"),
                          (12.3, "12.30"), (99.99, "99.99"), (99.999, "100.0"), (123.44, "123.4"),
                          (999.94, "999.9"), (999.96, "1000"), (1234.4, "1234"), (99999.4, "99999")):
            self.assertEqual(meter.fare(usd), text, usd)
        self.assertGreater(len(meter.fare(100000)), meter.FARE_MAX)

    def test_amount_under_half_a_cent_has_no_fare_and_leaves_paw_prints(self):
        A, B, C = self.A, self.B, self.C
        at = self.reach(15)
        self.assertEqual([meter.fare(usd) for usd in (0, 0.0, 0.004, 0.0049)], ["", "", "", ""])
        self.assertEqual((len(meter.PRINTS), columns(meter.PRINTS)), (1, 2), "one code point, two columns, as the rest")
        self.assertEqual(self.plain(RUN, 7, at, stamps={A: 0.0, B: 0.004, C: 0.05}),
                         "🪙        🪙   🐘   💲0.05    🐾        🐾")
        self.assertEqual(self.plain(RUN, 7, at, stamps={A: 0.0, B: 0.0, C: 0.0}),
                         "🪙        🪙   🐘   🐾        🐾        🐾")
        self.assertEqual(self.plain(RUN, 7, at, stamps={A: 0.0}), "🪙        🪙   🐘                       🐾",
                         "an eaten coin without a stamp leaves nothing")
        self.assertEqual(self.plain(RUN, 7, at), "🪙        🪙   🐘")
        # They give way to the animal and what is behind it, as a dollar sign does.
        for d in range(0, 2 * meter.lap_length(self.W)):
            for ph, mark in ((RUN, ""), (RUN, meter.GUST), (VACANT, "")):
                x = meter.animal_column(float(d), self.W)
                line = self.plain(ph, 7, float(d), mark=mark, stamps={c: 0.0 for c in self.COINS if c >= x})
                paid = self.paid(ph, 7, float(d), mark=mark)
                self.assertEqual(line, paid.replace(meter.EATEN + "0.05", meter.PRINTS + " " * 4).rstrip(" "), (ph, mark, d))
                self.assertLessEqual(columns(line), max(self.W, columns(self.plain(ph, 7, float(d), mark=mark))))
        # A track of 15 columns has its last coin at column 10: three columns are left behind it.
        self.assertEqual(meter.render(RUN, 7, 9.0, width=15, stamps={10: 0.0}), "🪙  🐘    🐾")

    def test_cost_is_read_from_the_status_line_input_and_nothing_else_passes_for_one(self):
        self.assertEqual(meter.cost_of({"cost": {"total_cost_usd": 1.25}}), 1.25)
        self.assertEqual(meter.cost_of({"cost": {"total_cost_usd": 0}}), 0.0)
        for data in ({}, {"cost": None}, {"cost": 3}, {"cost": {}}, {"cost": {"total_cost_usd": None}},
                     {"cost": {"total_cost_usd": "1.25"}}, {"cost": {"total_cost_usd": True}},
                     {"cost": {"total_cost_usd": -1}}, {"cost": {"total_cost_usd": float("nan")}},
                     {"cost": {"total_cost_usd": float("inf")}}):
            self.assertIsNone(meter.cost_of(data), data)

    def walk(self, name, cost, steps):
        """Run the animal a column a second. Yields (step, column, stamps, billed)."""
        lap = meter.lap_length(self.W)
        path = os.path.join(self.dir, name + ".run")
        for i in range(steps):
            dist, stamps = meter.advance(path, True, T0 + i, lap, cost(i))
            self.assertEqual(meter.load_run(path)[3], stamps, "kept with the distance")
            yield i, meter.animal_column(dist, self.W), stamps, meter.load_run(path)[4]

    def fares(self, stamps):
        """What each stamp leaves: its fare, or the paw prints."""
        return {c: meter.fare_at(usd, c, self.W) or meter.PRINTS for c, usd in stamps.items()}

    def test_coin_is_stamped_with_what_was_spent_since_the_fare_before_it(self):
        A, B, C, D = self.A, self.B, self.C, self.D
        lap = meter.lap_length(self.W)
        at = lambda c: int(self.reach(c))           # the step at which the animal reaches a column
        seen = {}
        # The cost is a cent higher at every column: 1.00 when the animal starts.
        for i, x, stamps, billed in self.walk("fare", lambda i: 1 + i / 100, lap + at(A) + 1):
            seen[i] = (x, self.fares(stamps), billed)
        self.assertEqual((at(A), at(B), at(C), at(D)), (6, 16, 26, 36))
        self.assertEqual(seen[0], (self.W - 2, {}, 1.0), "the first reading: the fares count from here")
        self.assertEqual(seen[5], (A + 1, {}, 1.0))
        self.assertEqual(seen[6], (A, {A: "0.06"}, 1.06), "six columns, six cents")
        self.assertEqual(seen[15], (B + 1, {A: "0.06"}, 1.06))
        self.assertEqual(seen[16][:2], (B, {A: "0.06", B: "0.10"}), "not the 1.16 it has cost so far")
        whole = {A: "0.06", B: "0.10", C: "0.10", D: "0.10"}
        self.assertEqual(seen[36], (D, whole, 1 + 36 / 100))
        # The lap ends on the coin at the left end. It is stamped as the others.
        whole[0] = "0.09"
        self.assertEqual(seen[lap - 1], (0, whole, 1 + 45 / 100), "nine columns from the one before it")
        self.assertEqual(seen[lap], (self.W - 2, whole, 1 + 45 / 100), "the next lap starts with what this one left")
        self.assertEqual(seen[lap + 5][1], whole)
        self.assertEqual(seen[lap + 6][:2], (A, {**whole, A: "0.07"}), "its first fare takes the place of the old one")
        self.assertEqual(seen[lap + 6][2], 1 + (lap + 6) / 100)

    def test_amount_under_half_a_cent_goes_into_the_next_fare(self):
        A, B, C, D = self.A, self.B, self.C, self.D
        seen = {}
        # A twenty-fifth of a cent a column.
        for i, x, stamps, billed in self.walk("slow", lambda i: i / 2500, 37):
            seen[i] = (self.fares(stamps), billed)
        self.assertEqual(seen[6], ({A: meter.PRINTS}, 0.0), "0.24 cents at the first coin: paw prints, nothing billed")
        self.assertEqual(seen[16], ({A: meter.PRINTS, B: "0.01"}, 16 / 2500), "0.64 cents by the second")
        self.assertEqual(seen[26], ({A: meter.PRINTS, B: "0.01", C: meter.PRINTS}, 16 / 2500), "0.4 cents since")
        self.assertEqual(seen[36], ({A: meter.PRINTS, B: "0.01", C: meter.PRINTS, D: "0.01"}, 36 / 2500),
                         "0.8 cents since")
        self.assertEqual(self.plain(RUN, 7, self.reach(D - 2), stamps=stamps),
                         "🪙      🐘💲0.01    🐾        💲0.01    🐾")

    def test_no_cost_no_fare_and_the_fares_count_from_the_first_reading(self):
        A, B, C = self.A, self.B, self.C
        last = None
        for i, x, stamps, billed in self.walk("unknown", lambda i: None if i < 10 else 5 + i / 100, 27):
            last = (x, self.fares(stamps), billed)
            if i < 10:
                self.assertEqual((stamps, billed), ({}, None), i)
            elif i < 16:
                self.assertEqual((stamps, billed), ({}, 5.1), "what it cost before is not this stretch's fare")
        self.assertEqual(last, (C, {B: "0.06", C: "0.10"}, 5.26))

    def test_fares_stay_while_the_animal_stands_or_sleeps(self):
        A, B = self.A, self.B
        lap = meter.lap_length(self.W)
        path = os.path.join(self.dir, "stay.run")
        for i, _x, stamps, billed in self.walk("stay", lambda i: 2.0 + (0.5 if i >= 3 else 0), 10):
            pass
        self.assertEqual((stamps, billed), ({A: 0.5}, 2.5))
        dist = meter.load_run(path)[0]
        self.assertEqual(meter.advance(path, False, T0 + 20, lap, 7.0), (dist, {A: 0.5}))
        self.assertEqual(meter.advance(path, False, T0 + 500, lap, 8.0), (dist, {A: 0.5}))
        self.assertEqual(meter.load_run(path)[4], 2.5, "what it cost while asleep waits for the next coin")
        self.assertEqual(meter.advance(path, True, T0 + 501, lap, 9.0), (dist, {A: 0.5}),
                         "the first redraw of a run moves nothing")
        for i in range(502, 509):
            dist, stamps = meter.advance(path, True, T0 + i, lap, 9.0)
        self.assertEqual((meter.animal_column(dist, self.W), stamps), (B, {A: 0.5, B: 6.5}))

    def test_going_home_starts_the_line_over_and_the_fares_count_on(self):
        A, B = self.A, self.B
        lap = meter.lap_length(self.W)
        path = os.path.join(self.dir, "home.run")
        for i, _x, stamps, billed in self.walk("home", lambda i: 2.0 + i / 100, 20):
            pass
        self.assertEqual((self.fares(stamps), billed), ({A: "0.06", B: "0.10"}, 2.16))
        self.assertEqual(meter.advance(path, False, T0 + 200, lap, 2.5, home=True), (0.0, {}))
        dist, _t, running, stamps, billed = meter.load_run(path)
        self.assertEqual((dist, running, stamps, billed), (0.0, False, {}, 2.16),
                         "what was spent since the last fare is not lost")
        self.assertEqual(self.plain(VACANT, 0, dist, mark=meter.HOME, stamps=stamps),
                         self.plain(VACANT, 0, 0.0, mark=meter.HOME), "the picture a new session starts with")
        self.assertEqual(meter.advance(path, True, T0 + 300, lap, 3.0), (0.0, {}),
                         "the first redraw of a run moves nothing")
        for i in range(301, 307):
            dist, stamps = meter.advance(path, True, T0 + i, lap, 3.0)
        self.assertEqual((meter.animal_column(dist, self.W), self.fares(stamps)), (A, {A: "0.84"}),
                         "the first fare after home has everything since the fare before it")
        fresh = os.path.join(self.dir, "fresh.run")
        self.assertEqual(meter.advance(fresh, False, T0, lap, 1.0, home=True), (0.0, {}))
        self.assertFalse(os.path.exists(fresh), "a line that is already new is not written again")

    def test_session_that_goes_home_draws_the_first_picture_again(self):
        self.data["cost"] = {"total_cost_usd": 1.0}
        self.write(prompt(T0 + 1))
        for t in range(2, 23):
            ran = meter.measure(self.data, T0 + t, directory=self.state, rates=self.rates)
            self.data["cost"]["total_cost_usd"] += 0.01
        self.assertEqual((ran[0], ran[4]), (RUN, 20.0))
        self.assertEqual(len(ran[7]), 2, "two coins eaten")
        self.write(assistant(T0 + 23, "m1", [0, 0, 0, 3000], ["text"]))
        asleep = meter.measure(self.data, T0 + 24, directory=self.state, rates=self.rates)
        self.assertEqual((asleep[0], asleep[6], asleep[4], asleep[7]), (VACANT, "", 20.0, ran[7]),
                         "asleep outside, where it stands")
        home = meter.measure(self.data, T0 + 24 + W, directory=self.state, rates=self.rates)
        self.assertEqual((home[0], home[6], home[4], home[7]), (VACANT, meter.HOME, 0.0, {}))
        self.assertEqual(self.plain(VACANT, 0, home[4], mark=meter.HOME, stamps=home[7]),
                         "🪙        🪙        🪙        🪙        🪙    🏠💤")

    def test_cost_that_starts_over_is_counted_from_there(self):
        A, B, C = self.A, self.B, self.C
        stamps, billed = meter.stamped({A: 0.5}, 2.5, B + 1, B, 0.2)
        self.assertEqual((stamps, billed), ({A: 0.5, B: 0.0}, 0.2), "no fare below zero")
        stamps, billed = meter.stamped(stamps, billed, C + 1, C, 0.5)
        self.assertEqual((self.fares(stamps), billed), ({A: "0.50", B: meter.PRINTS, C: "0.30"}, 0.5))

    def test_coin_is_stamped_once_and_only_when_the_animal_reaches_it(self):
        A, B = self.A, self.B
        first = meter.stamped({}, 1.0, A + 1, A, 1.5)
        self.assertEqual(first, ({A: 0.5}, 1.5))
        self.assertEqual(meter.stamped({A: 0.5}, 1.5, A, A - 1, 9.0), first, "it is past that coin")
        self.assertEqual(meter.stamped({A: 0.5}, 1.5, A - 2, A - 4, 9.0), first, "and short of the next")
        self.assertEqual(meter.stamped({A: 0.5}, 1.5, B + 1, B, 2.0), ({A: 0.5, B: 0.5}, 2.0))
        self.assertEqual(meter.stamped({A: 0.5}, 1.5, 2, 0, 3.0), ({A: 0.5, 0: 1.5}, 3.0), "the left end, as the others")
        self.assertEqual(meter.stamped({A: 0.5}, 1.5, B + 1, B, None), first, "the cost is not known")
        self.assertEqual(meter.stamped({}, None, A + 1, A, 7.0), ({A: 0.0}, 7.0),
                         "the first reading: nothing spent since")
        self.assertEqual(meter.stamped({}, None, A - 2, A - 3, 7.0), ({}, 7.0))

    def test_stamp_of_the_lap_before_goes_when_the_animal_reaches_its_coin_again(self):
        A, B = self.A, self.B
        old = {A: 0.5, B: 0.5}
        self.assertEqual(meter.stamped(old, 2.0, 0, self.W - 2, 4.0), (old, 2.0), "a new lap keeps what the last one left")
        self.assertEqual(meter.stamped(old, 2.0, A + 2, A + 1, 4.0), (old, 2.0), "until the animal is there")
        self.assertEqual(meter.stamped(old, 2.0, A + 1, A, 2.25), ({A: 0.25, B: 0.5}, 2.25), "a fare takes its place")
        self.assertEqual(meter.stamped(old, 2.0, A + 1, A, 2.0), ({A: 0.0, B: 0.5}, 2.0), "or paw prints")
        self.assertEqual(meter.stamped(old, 2.0, A + 1, A, None), ({B: 0.5}, 2.0), "or nothing: the cost is not known")
        self.assertEqual(meter.stamped(old, 2.0, A + 1, A, 100002.0), ({B: 0.5}, 2.0), "or nothing: the fare does not fit")
        self.assertEqual(old, {A: 0.5, B: 0.5}, "the stamps handed in are left alone")

    def test_fare_that_does_not_fit_is_not_billed(self):
        # A track of 15 columns has its last coin at column 10: three columns are left behind it.
        self.assertEqual(list(meter.coin_columns(15)), [0, 10])
        self.assertEqual(meter.stamped({}, 1.0, 11, 10, 1.05, 15), ({}, 1.0))
        stamps, billed = meter.stamped({}, 1.0, 11, 10, 1.05, 16)
        self.assertEqual(({c: meter.fare(usd) for c, usd in stamps.items()}, billed), ({10: "0.05"}, 1.05))
        self.assertEqual(meter.stamped({}, 0.0, self.A + 1, self.A, 100000.0), ({}, 0.0), "six digits")

    def test_run_file_of_an_older_version_is_read_and_a_broken_one_starts_over(self):
        path = os.path.join(self.dir, "old.run")
        with open(path, "w") as f:
            f.write("12.000 %.3f 1" % T0)
        self.assertEqual(meter.load_run(path), (12.0, T0, True, {}, None))
        for broken in ("32:1.5 24:oops", "@much 32:1.5", "32"):
            with open(path, "w") as f:
                f.write("12.000 %.3f 1 %s" % (T0, broken))
            self.assertEqual(meter.load_run(path), (0.0, 0.0, False, {}, None), broken)
        meter.save_run(path, 12.0, T0, True, {24: 0.1 + 0.2, 32: 1.5}, 0.1 + 0.7)
        self.assertEqual(meter.load_run(path), (12.0, T0, True, {24: 0.1 + 0.2, 32: 1.5}, 0.1 + 0.7),
                         "to the last digit")
        meter.save_run(path, 12.0, T0, False)
        self.assertEqual(meter.load_run(path), (12.0, T0, False, {}, None))

    def test_fare_follows_its_dollar_sign_and_moves_nothing(self):
        A, B, C, D = self.A, self.B, self.C, self.D
        w = self.W
        stamps = {0: 1.5, D: 1.4, C: 1.31, B: 1.12, A: 1.07}
        animals = {g for _, g in meter.ANIMALS}
        for ph, mark in ((RUN, ""), (RUN, meter.GUST), (HALT, ""), (VACANT, ""), (VACANT, meter.HOME)):
            for d in range(0, 2 * meter.lap_length(w)):
                bare = self.plain(ph, 7, float(d), mark=mark)
                line = self.plain(ph, 7, float(d), mark=mark, stamps=stamps)
                x = meter.animal_column(float(d), w)
                self.assertLessEqual(columns(line), max(w, columns(bare)), line)
                self.assertEqual(line, line.rstrip(" "))
                standing = meter.HOUSE if mark == meter.HOME else meter.animal(0 if ph == VACANT else 7)
                self.assertEqual(columns(line[:line.index(standing)]), x, "nothing has pushed the animal aside")
                # What stands behind the animal: its zzz, its wrench, the wind or nothing.
                behind = 2 if ph != RUN or mark else 0
                for c in (A, B, C, D, 0):
                    text = meter.EATEN + meter.fare(stamps[c])
                    if c >= x + 2 + behind:
                        self.assertEqual(self.glyph_at(line, c), meter.EATEN, (ph, mark, d, c))
                        self.assertIn(text, line, "every eaten coin clear of the animal has its fare")
                    elif c + 1 < x and x > c + meter.REFILL:
                        self.assertIn(text, line, "the fare of the lap before still stands")
                    elif c + 1 < x:
                        self.assertEqual(self.glyph_at(line, c), meter.COIN, "a coin again")
                        self.assertNotIn(text, line)
                    else:
                        self.assertNotIn(text, line, "no fare under the animal")
                self.assertEqual(set(line) - animals - set(" 💤💨" + meter.TOOL + meter.HOUSE + meter.COIN + meter.EATEN),
                                 set("0123456789.") & set(line), line)
        self.assertEqual(self.plain(RUN, 7, self.reach(16), stamps=stamps),
                         "💲1.50    🪙    🐘  💲1.31    💲1.12    💲1.07", "the coin ahead is a coin, the left end is of the lap before")
        self.assertEqual(self.plain(RUN, 7, self.reach(15), stamps=stamps),
                         "🪙        🪙   🐘   💲1.31    💲1.12    💲1.07", "a column on, the left end is a coin too")
        self.assertEqual(self.plain(RUN, 7, self.reach(36), stamps=stamps),
                         "💲1.50    💲1.40    💲1.31    🪙    🐘  💲1.07", "three of the lap before, the coin ahead, one of this lap")
        self.assertEqual(self.plain(RUN, 7, self.reach(15), stamps={}), self.plain(RUN, 7, self.reach(15)))

    def glyph_at(self, line, column):
        """The character of a line that starts at a column, if one does."""
        col = 0
        for ch in line:
            if col == column:
                return ch
            col += columns(ch)
        return None

    def test_fare_that_does_not_fit_is_left_out_with_its_dollar_sign(self):
        self.assertEqual(self.plain(RUN, 7, self.reach(15), stamps={self.A: 100000.0, self.B: 99999.0}),
                         "🪙        🪙   🐘             💲99999")
        # A track of 15 columns has its last coin at column 10: three columns are left behind it.
        self.assertEqual(meter.render(RUN, 7, 9.0, width=15, stamps={10: 0.05}), "🪙  🐘")
        self.assertEqual(meter.render(RUN, 7, 9.0, width=16, stamps={10: 0.05}), "🪙   🐘   💲0.05")
        for width in range(12, self.W + 1):
            for d in range(0, 2 * self.W):
                line = meter.render(RUN, 7, float(d), width=width, stamps={c: 12.34 for c in range(10, 50, 10)})
                self.assertLessEqual(columns(line), width, (width, d, line))

    def test_status_line_draws_the_fare_of_its_input(self):
        now = datetime.now(timezone.utc).timestamp()
        self.write(prompt(now - 2))
        self.data["cost"] = {"total_cost_usd": 3.456}
        os.makedirs(os.path.join(self.dir, "taxi-horse"))
        path = os.path.join(self.dir, "taxi-horse", "sess.run")
        # The animal is one column short of the first coin and runs onto it.
        # The fares so far come to 3 dollars.
        meter.save_run(path, self.reach(self.A + 1), now - 2, True, {}, 3.0)
        out = self.run_cli()
        self.assertEqual((out.returncode, out.stderr), (0, ""))
        self.assertNotIn("0.46", out.stdout, "the animal still stands on the coin")
        dist, _t, _running, stamps, billed = meter.load_run(path)
        self.assertEqual((dist, self.fares(stamps), billed), (self.reach(self.A - 1), {self.A: "0.46"}, 3.456))
        # Two columns on, the dollar sign shows, with the fare of then.
        meter.save_run(path, self.reach(self.A - 3), now + 60, True, stamps, billed)
        self.data["cost"] = {"total_cost_usd": 9.99}
        out = self.run_cli()
        self.assertTrue(out.stdout.rstrip("\n").endswith(meter.EATEN + "0.46"), out.stdout)
        self.assertEqual(self.run_cli("--state").stdout, "run 0\n", "the mod is told nothing of it")

    def test_narrow_terminal_shortens_the_track(self):
        old = os.environ.get("COLUMNS")
        self.addCleanup(lambda: os.environ.pop("COLUMNS", None) if old is None
                        else os.environ.__setitem__("COLUMNS", old))
        os.environ["COLUMNS"] = "30"
        self.assertEqual(meter.track_width(), 26)
        self.assertLessEqual(columns(meter.render(RUN, 16, 5.0)), 26)
        os.environ["COLUMNS"] = "200"
        self.assertEqual(meter.track_width(), meter.TRACK)

if __name__ == "__main__":
    unittest.main()
