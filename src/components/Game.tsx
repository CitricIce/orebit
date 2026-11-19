"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayResponse, GuessResponse, RevealResponse } from "@/lib/api-types";
import { localToday } from "@/lib/dates";
import { formatMeters, rankFor, ROUND_SECONDS, TIERS, type TierId } from "@/lib/tiers";
import {
  depthOf,
  loadDay,
  saveDay,
  settleExpiredRound,
  totalDepth,
  type DayRecord,
  type FoundOre,
} from "@/lib/client/storage";
import { sfx } from "@/lib/client/sfx";
import { normalize } from "@/lib/match";
import DrillShaft from "./DrillShaft";
import Summary from "./Summary";
import RevealList from "./RevealList";
import HowToPlay from "./HowToPlay";
import SpaceWorld, { type World } from "./SpaceWorld";
import { APPROACH_MS, LAUNCH_MS, stopFor } from "@/lib/journey";
import s from "./Game.module.css";

type Phase = "loading" | "error" | "briefing" | "launch" | "approach" | "countdown" | "drilling" | "settling" | "reveal" | "summary";

interface Feedback {
  id: number;
  kind: "hit" | "miss" | "dupe";
  text: string;
  tier?: TierId;
}

const ROUND_MS = ROUND_SECONDS * 1000;

export default function Game({ date, mode }: { date: string; mode: "daily" | "archive" }) {
  const [day, setDay] = useState<DayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [roundIdx, setRoundIdx] = useState(0);
  const [found, setFound] = useState<FoundOre[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [count, setCount] = useState(3);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [lastHit, setLastHit] = useState<{ id: number; tier: TierId } | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);

  const recordRef = useRef<DayRecord | null>(null);
  const foundRef = useRef<FoundOre[]>([]);
  const startedAtRef = useRef(0);
  const pendingRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const feedbackId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const endingRef = useRef(false);

  const persist = useCallback((r: DayRecord) => {
    recordRef.current = r;
    setRecord(r);
    saveDay(r);
  }, []);

  // Load the day's rocks and any saved progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/day/${date}`);
        if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't load this day.");
        const data: DayResponse = await res.json();
        if (cancelled) return;
        setDay(data);

        const ids = data.rounds.map((r) => r.id);
        const titles = Object.fromEntries(data.rounds.map((r) => [r.id, r.title]));
        let rec = loadDay(date) ?? { date, rounds: [], completed: false };
        rec = settleExpiredRound(rec, titles, ids);
        if (!rec.completed && rec.rounds.filter(Boolean).length === data.rounds.length) {
          rec = { ...rec, completed: true, playedOn: rec.playedOn ?? localToday() };
        }
        persist(rec);

        if (rec.completed) {
          setPhase("summary");
        } else if (rec.active) {
          // Resume a round still on the clock.
          setRoundIdx(rec.active.index);
          foundRef.current = rec.active.found;
          seenRef.current = new Set(rec.active.found.map((o) => o.name));
          setFound(rec.active.found);
          startedAtRef.current = rec.active.startedAt;
          setPhase("drilling");
        } else {
          setRoundIdx(rec.rounds.filter(Boolean).length);
          setPhase("briefing");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't load this day.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, persist]);

  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const liftOff = () => {
    setPhase("launch");
    sfx.launch();
  };

  const flyToAsteroid = useCallback(() => {
    setPhase("approach");
    sfx.warp();
  }, []);

  const startCountdown = useCallback(() => {
    setCount(3);
    setPhase("countdown");
    sfx.count();
  }, []);

  // Launch, then warp to the asteroid, then count down. Tapping skips ahead.
  const skipScene = () => {
    if (phase === "launch") flyToAsteroid();
    else if (phase === "approach") startCountdown();
  };

  useEffect(() => {
    if (phase !== "launch" && phase !== "approach") return;
    const ms = reducedMotion() ? 700 : phase === "launch" ? LAUNCH_MS : APPROACH_MS;
    const t = setTimeout(phase === "launch" ? flyToAsteroid : startCountdown, ms);
    return () => clearTimeout(t);
  }, [phase, flyToAsteroid, startCountdown]);

  const beginDrilling = useCallback(() => {
    const now = Date.now();
      startedAtRef.current = now;
      foundRef.current = [];
      seenRef.current = new Set();
      setFound([]);
      setFeedback(null);
      setInput("");
      endingRef.current = false;
      const rec = recordRef.current!;
      persist({ ...rec, active: { index: roundIdx, startedAt: now, found: [] } });
      sfx.start();
      setPhase("drilling");
  }, [roundIdx, persist]);

  useEffect(() => {
    if (phase !== "countdown") return;
    const t = setTimeout(() => {
      if (count <= 1) {
        beginDrilling();
      } else {
        setCount(count - 1);
        sfx.count();
      }
    }, 800);
    return () => clearTimeout(t);
  }, [phase, count, beginDrilling]);

  const finishRound = useCallback(async () => {
    if (endingRef.current || !day) return;
    endingRef.current = true;
    setPhase("settling");
    sfx.end();
    // Let guesses already in flight land.
    const waitUntil = Date.now() + 2500;
    while (pendingRef.current > 0 && Date.now() < waitUntil) {
      await new Promise((r) => setTimeout(r, 80));
    }
    const rec = recordRef.current!;
    const r = day.rounds[roundIdx];
    const rounds = [...rec.rounds];
    rounds[roundIdx] = { id: r.id, title: r.title, found: foundRef.current, depth: depthOf(foundRef.current) };
    const isLast = roundIdx === day.rounds.length - 1;
    persist({
      ...rec,
      rounds,
      active: undefined,
      completed: isLast,
      playedOn: isLast ? localToday() : rec.playedOn,
    });
    setReveal(null);
    setRevealIdx(roundIdx);
    setPhase("reveal");
    try {
      const res = await fetch(`/api/reveal/${date}/${roundIdx}`);
      if (res.ok) setReveal(await res.json());
    } catch {
      // The reveal is a bonus. The round result is already saved.
    }
  }, [day, roundIdx, date, persist]);

  // Round clock.
  useEffect(() => {
    if (phase !== "drilling") return;
    inputRef.current?.focus();
    let lastSecond = -1;
    const tick = () => {
      const left = Math.max(0, startedAtRef.current + ROUND_MS - Date.now());
      setTimeLeft(left);
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSecond && sec <= 5 && sec > 0) sfx.tick(sec <= 3);
      lastSecond = sec;
      if (left <= 0) void finishRound();
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase, finishRound]);

  const say = (f: Omit<Feedback, "id">) => setFeedback({ ...f, id: ++feedbackId.current });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const guess = input.trim();
    if (!guess || phase !== "drilling") return;
    setInput("");
    const submittedAt = Date.now();
    if (submittedAt > startedAtRef.current + ROUND_MS) return;

    pendingRef.current++;
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, round: roundIdx, guess }),
      });
      const data: GuessResponse = await res.json();
      if (data.result === "hit") {
        if (seenRef.current.has(data.name)) {
          say({ kind: "dupe", text: `Already mined ${data.name}` });
          sfx.dupe();
          return;
        }
        seenRef.current.add(data.name);
        const ore: FoundOre = { name: data.name, tier: data.tier };
        foundRef.current = [...foundRef.current, ore];
        setFound(foundRef.current);
        setLastHit({ id: ++feedbackId.current, tier: data.tier });
        const t = TIERS[data.tier];
        const corrected = normalize(guess) !== normalize(data.name) ? ` (${data.name})` : "";
        say({ kind: "hit", tier: data.tier, text: `+${t.depth} m ${t.name}${corrected}` });
        sfx.hit(data.tier);
        const rec = recordRef.current!;
        if (rec.active) persist({ ...rec, active: { ...rec.active, found: foundRef.current } });
      } else {
        say({ kind: "miss", text: `"${guess}" isn't in this rock` });
        sfx.miss();
      }
    } catch {
      say({ kind: "miss", text: "Signal lost. Try that one again." });
    } finally {
      pendingRef.current--;
    }
  };

  const next = () => {
    if (!day) return;
    if (roundIdx >= day.rounds.length - 1) {
      setPhase("summary");
    } else {
      setRoundIdx((i) => i + 1);
      flyToAsteroid();
    }
  };

  const depth = useMemo(() => depthOf(found), [found]);
  const doneRounds = record?.rounds.filter(Boolean).length ?? 0;
  const runDepth = record ? totalDepth(record) : 0;

  // Content crossfade. When the phase changes, the old screen stays on top
  // for a moment and fades out while the new one fades in.
  const layout = (p: Phase) => (p === "settling" ? "drilling" : p);
  const [prevPhase, setPrevPhase] = useState<Phase>(phase);
  const [leaving, setLeaving] = useState<Phase | null>(null);
  if (prevPhase !== phase) {
    setPrevPhase(phase);
    if (layout(prevPhase) !== layout(phase) && prevPhase !== "loading") setLeaving(prevPhase);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 500);
    return () => clearTimeout(t);
  }, [leaving]);

  const world: World =
    phase === "briefing"
      ? doneRounds === 0
        ? "ground"
        : "space"
      : phase === "launch"
        ? "launch"
        : phase === "approach"
          ? "cruise"
          : phase === "countdown"
            ? "orbit"
            : phase === "drilling" || phase === "settling" || phase === "reveal"
              ? "work"
              : "space";
  const worldTarget = phase === "briefing" ? roundIdx - 1 : phase === "summary" ? 99 : roundIdx;

  const renderPhase = (p: Phase): ReactNode => {
    if (p === "loading") {
      return (
        <div className={s.center}>
          <div className={s.loader} aria-label="Loading" />
        </div>
      );
    }

    if (p === "error" || !day || !record) {
      return (
        <div className={s.center}>
          <p className={s.errorText}>{error ?? "Something broke."}</p>
          <Link className={s.secondaryBtn} href="/archive">
            Go to the archive
          </Link>
        </div>
      );
    }

    if (p === "summary") {
      return <Summary day={day} record={record} mode={mode} />;
    }

    if (p === "briefing") {
      return (
        <section className={s.briefing}>
          <p className={s.kicker}>Survey #{day.number}</p>
          <h1 className={s.briefTitle}>
            Three asteroids. <span className={s.accent}>Thirty seconds each.</span>
          </h1>

          <button className={s.startBtn} onClick={doneRounds === 0 ? liftOff : flyToAsteroid}>
            {doneRounds === 0 ? "Lift off" : `Fly to asteroid ${roundIdx + 1}`}
          </button>
          {doneRounds > 0 && <p className={s.runSoFar}>Run so far: {formatMeters(runDepth)}</p>}

          <details className={s.howTo}>
            <summary>How to play</summary>
            <div className={s.howToBody}>
              <p className={s.howToIntro}>
                Each rock is a category. Name as many answers as you can before your drill overheats. Common answers
                are surface dust. Obscure ones are buried deep and worth far more.
              </p>
              <HowToPlay />
            </div>
          </details>
        </section>
      );
    }

    if (p === "launch" || p === "approach") {
      const stop = stopFor(roundIdx);
      return (
        <div
          className={s.sceneLayer}
          onClick={skipScene}
          role="button"
          tabIndex={0}
          aria-label="Skip animation"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") skipScene();
          }}
        >
          {p === "launch" ? (
            <p className={s.launchCaption} aria-live="polite">
              <span className={s.captionA}>Lift off</span>
              <span className={s.captionB}>Leaving Earth</span>
            </p>
          ) : (
            <p className={s.location} aria-live="polite">
              <span className={s.locationKicker}>
                Next stop · {day.rounds[roundIdx]?.designation}
              </span>
              <span className={s.locationRegion}>{stop.region}</span>
              <span className={s.locationDetail}>{stop.detail}</span>
            </p>
          )}
          <span className={s.skipHint}>Tap to skip</span>
        </div>
      );
    }

    const r = day.rounds[roundIdx];

    if (p === "countdown" && r) {
      return (
        <div className={s.countLayer} aria-live="assertive">
          <p className={s.rockCode}>{r.designation}</p>
          <h2 className={s.countTitle}>{r.title}</h2>
          <p className={s.countPrompt}>{r.prompt}</p>
          <div key={count} className={s.countNum}>
            {count}
          </div>
        </div>
      );
    }

    if ((p === "drilling" || p === "settling") && r) {
      const secs = Math.ceil(timeLeft / 1000);
      const pct = timeLeft / ROUND_MS;
      return (
        <section className={s.play}>
          <DrillShaft depth={depth} drilling={p === "drilling"} lastHit={lastHit} heat={1 - pct} />
          <div className={s.console}>
            <header className={s.hud}>
              <div>
                <p className={s.rockCode}>
                  {r.designation} · rock {roundIdx + 1} of {day.rounds.length}
                </p>
                <h2 className={s.prompt}>{r.title}</h2>
              </div>
              <div className={s.depthReadout}>
                <span className={s.depthNum}>{depth}</span>
                <span className={s.depthUnit}>m</span>
              </div>
            </header>

            <div className={s.timer} data-urgent={secs <= 5} role="timer" aria-label={`${secs} seconds left`}>
              <div className={s.timerFill} style={{ transform: `scaleX(${pct})` }} />
              <span className={s.timerText}>{p === "settling" ? "Cooling down" : `${secs}s`}</span>
            </div>

            <form onSubmit={submit} className={s.inputRow}>
              <input
                ref={p === phase ? inputRef : undefined}
                className={s.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type an answer, press Enter"
                aria-label={r.prompt}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                maxLength={80}
                disabled={p !== "drilling"}
              />
              <button className={s.drillBtn} type="submit" disabled={p !== "drilling"}>
                Drill
              </button>
            </form>

            <div className={s.feedbackSlot} aria-live="polite">
              {feedback && (
                <p
                  key={feedback.id}
                  className={s.feedback}
                  data-kind={feedback.kind}
                  style={feedback.tier ? ({ "--c": TIERS[feedback.tier].color } as React.CSSProperties) : undefined}
                >
                  {feedback.text}
                </p>
              )}
            </div>

            <div className={s.cargo}>
              <p className={s.cargoHead}>
                Cargo hold <span>{found.length}</span>
              </p>
              <ul className={s.ores}>
                {[...found].reverse().map((o) => (
                  <li
                    key={o.name}
                    className={s.ore}
                    data-tier={o.tier}
                    style={{ "--c": TIERS[o.tier].color } as React.CSSProperties}
                  >
                    <span className={s.gem} data-tier={o.tier} />
                    {o.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    }

    const rv = day.rounds[revealIdx];
    if (p === "reveal" && rv) {
      const res = record.rounds[revealIdx];
      const isLast = revealIdx === day.rounds.length - 1;
      return (
        <section className={s.revealWrap}>
          <header className={s.revealHead}>
            <p className={s.rockCode}>{rv.designation} · core sample</p>
            <h2 className={s.title}>{rv.title}</h2>
            <div className={s.revealStats}>
              <div>
                <span className={s.bigNum}>{res?.depth ?? 0}</span>
                <span className={s.statLabel}>meters</span>
              </div>
              <div>
                <span className={s.bigNum}>{res?.found.length ?? 0}</span>
                <span className={s.statLabel}>of {rv.total} ores</span>
              </div>
            </div>
            <button className={s.primaryBtn} onClick={next} autoFocus>
              {isLast ? "See mission report" : `Fly to the next asteroid`}
            </button>
          </header>
          <RevealList answers={reveal?.answers ?? null} found={res?.found ?? []} />
          {isLast && (
            <p className={s.runSoFar}>
              Total run: {formatMeters(runDepth)} · {rankFor(runDepth).title}
            </p>
          )}
        </section>
      );
    }

    return null;
  };

  return (
    <>
      {day && <SpaceWorld world={world} target={worldTarget} />}
      <div className={s.stack}>
        {leaving && (
          <div key={`leaving-${leaving}`} className={s.layer} data-leaving="true" inert>
            {renderPhase(leaving)}
          </div>
        )}
        <div key={layout(phase)} className={s.layer}>
          {renderPhase(phase)}
        </div>
      </div>
    </>
  );
}
