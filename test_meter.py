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

    def run_cli(self, *args):
        import subprocess
        env = dict(os.environ, XDG_RUNTIME_DIR=self.dir, XDG_STATE_HOME=os.path.join(self.dir, "home-state"))
        launcher = os.path.join(os.path.dirname(os.path.abspath(meter.__file__)), "taxi-horse")
        # The way the mod runs it: the interpreter named, not the launcher's shebang.
        return subprocess.run([sys.executable, "-IS", launcher, *args], input=compact(self.data),
                              env=env, capture_output=True, text=True)

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
        self.assertIn("🐌💤", drawn.stdout, "without --state the same run draws the line")

    # ---- drawing

    def plain(self, ph, lvl, dist, **kw):
        return meter.render(ph, lvl, dist, width=meter.TRACK, **kw)

    def test_state_mode_names_what_goes_behind_the_animal(self):
        now = datetime.now(timezone.utc).timestamp()
        self.write(prompt(now - 30), assistant(now - 20, "m1", [0, 0, 0, 50], ["tool_use"]))
        out = self.run_cli("--state")
        self.assertEqual((out.returncode, out.stdout), (0, "halt 0 doze\n"))

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

    def test_line_is_only_coins_an_animal_and_its_zzz(self):
        animals = {g for _, g in meter.ANIMALS}
        for ph in (RUN, HALT, VACANT):
            for lvl in (0, 5, 16):
                for d in range(0, 90):
                    line = self.plain(ph, lvl, float(d))
                    self.assertEqual(set(line) - animals - set(" 💤" + meter.COIN + meter.EATEN), set(), line)
                    self.assertEqual(sum(line.count(g) for g in animals), 1, line)
        self.assertEqual(self.plain(RUN, 7, 9.0), self.plain(HALT, 7, 9.0), "nothing but the motion tells them apart")
        self.assertNotIn("\033", self.plain(RUN, 16, 9.0))

    def test_line_fits_the_track_and_has_no_trailing_blanks(self):
        for ph in (RUN, HALT, VACANT):
            for lvl in (0, 7, 16):
                for d in range(0, 90):
                    line = self.plain(ph, lvl, float(d))
                    # The zzz of an animal asleep at the right end sticks out past the track.
                    x = meter.animal_column(float(d), meter.TRACK)
                    extra = max(0, x + 4 - meter.TRACK) if ph == VACANT else 0
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

    def test_coins_ahead_of_the_animal_and_dollar_signs_where_it_has_eaten(self):
        w = meter.TRACK
        lap = meter.lap_length(w)
        spots = list(range(0, w - 4, meter.COIN_GAP))
        self.assertEqual(spots, [0, 8, 16, 24, 32])
        for ph in (RUN, HALT, VACANT):
            start = self.plain(ph, 7, 0.0)
            self.assertEqual((start.count(meter.COIN), start.count(meter.EATEN)), (5, 0),
                             "a full row of coins at the start of a lap")
            coins, eaten = [], []
            for d in range(lap):
                line = self.plain(ph, 7, float(d))
                x = meter.animal_column(float(d), w)
                here = line.index(meter.animal(0 if ph == VACANT else 7))
                coins.append(line.count(meter.COIN))
                eaten.append(line.count(meter.EATEN))
                self.assertEqual(coins[-1], sum(1 for c in spots if c + 1 < x), (ph, d, line))
                self.assertNotIn(meter.COIN, line[here:], "no coin behind the animal")
                self.assertNotIn(meter.EATEN, line[:here], "no dollar sign ahead of it")
                self.assertEqual(columns(line[:here]), x, "nothing has pushed the animal aside")
                self.assertLessEqual(coins[-1] + eaten[-1], 5)
            self.assertEqual(coins, sorted(coins, reverse=True), "only ever fewer coins within a lap")
            self.assertEqual(coins[-1], 0, "the last one is eaten at the left end")
            self.assertEqual(max(eaten), 4, "every coin but the last is seen as a dollar sign")
        self.assertEqual(self.plain(RUN, 7, 23.0).count(meter.EATEN), 2, "the third is under the animal")
        self.assertEqual(self.plain(RUN, 7, 25.0).count(meter.EATEN), 3)
        again = self.plain(RUN, 7, float(lap))
        self.assertEqual((again.count(meter.COIN), again.count(meter.EATEN)), (5, 0), "new coins on the next lap")

    def test_dollar_sign_gives_way_to_the_animal_and_its_zzz(self):
        w = meter.TRACK
        for d in range(meter.lap_length(w)):
            for ph in (RUN, HALT, VACANT):
                line = self.plain(ph, 3, float(d))
                self.assertEqual(sum(line.count(g) for _, g in meter.ANIMALS), 1, line)
                if ph == VACANT:
                    self.assertIn("🐌💤", line, "the zzz stays next to the animal: %r" % line)

    def test_every_lap_is_drawn_at_the_last_coin_whatever_the_redraw_interval(self):
        w = meter.TRACK
        lap = meter.lap_length(w)
        for step in (0.4, 1.0, 1.7):                 # seconds between redraws
            path = os.path.join(self.dir, "lap%d.run" % (step * 10))
            columns_seen = [meter.animal_column(meter.advance(path, True, T0 + i * step, lap), w)
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

    def test_standing_animal_dozes_after_ten_seconds_without_a_token(self):
        self.run_meter(T0)
        self.write(prompt(T0 + 1), assistant(T0 + 2, "m1", [0, 0, 0, 3000], ["tool_use"]))
        self.assertEqual(self.run_mark(T0 + 3), (HALT, ""), "it has only just stopped")
        self.assertEqual(self.run_mark(T0 + 12), (HALT, ""))
        self.assertEqual(self.run_mark(T0 + 13), (HALT, meter.DOZE))
        self.write(tool_result(T0 + 14))
        self.assertEqual(self.run_mark(T0 + 15), (RUN, ""), "a request is out")
        self.assertEqual(self.run_mark(T0 + 100), (RUN, ""), "no zzz while a request is out, however long it takes")
        self.write(assistant(T0 + 101, "m2", [0, 0, 0, 10], ["text"]))
        self.assertEqual(self.run_mark(T0 + 102), (VACANT, ""), "between turns the picture has its own zzz")

    def test_mark_is_drawn_right_behind_the_animal(self):
        a = meter.animal(7)
        self.assertIn(a + "💨", self.plain(RUN, 7, 9.0, mark=meter.GUST))
        self.assertIn(a + "🔥", self.plain(RUN, 7, 9.0, mark=meter.FIRE))
        self.assertIn(a + "💤", self.plain(HALT, 7, 9.0, mark=meter.DOZE), "it dozes as the animal it is")
        asleep = self.plain(VACANT, 7, 9.0, mark=meter.GUST)
        self.assertEqual(asleep, self.plain(VACANT, 7, 9.0), "between turns a mark changes nothing")
        for d in range(0, 90):
            line = self.plain(RUN, 7, float(d), mark=meter.FIRE)
            self.assertEqual((line.count(a + "🔥"), line.count("🔥")), (1, 1), line)
            self.assertLessEqual(columns(line), meter.TRACK + 2, line)
            self.assertEqual(line.index(a), self.plain(RUN, 7, float(d)).index(a), "the animal stays where it is")

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
