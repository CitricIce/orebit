"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayResponse, GuessResponse } from "@/lib/api-types";
import { formatShortDate, LAUNCH_DATE, localToday } from "@/lib/dates";
import { bonusMs, formatMeters, rankFor, ROUND_SECONDS, TIERS, type TierId } from "@/lib/tiers";
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
import HowToPlay from "./HowToPlay";
import GameTitle from "./GameTitle";
import SpaceWorld, { type World } from "./SpaceWorld";
import { APPROACH_MS, DESCENT_AT, LAUNCH_MS, stopFor } from "@/lib/journey";
import s from "./Game.module.css";

type Phase = "loading" | "error" | "briefing" | "launch" | "approach" | "countdown" | "drilling" | "settling" | "reveal" | "summary";

interface Feedback {
  id: number;
  kind: "hit" | "miss" | "dupe";
  text: string;
  tier?: TierId;
}

const ROUND_MS = ROUND_SECONDS * 1000;
const COUNTDOWN_FROM = 5;

export default function Game({ date, mode }: { date: string; mode: "daily" | "archive" }) {
  const [day, setDay] = useState<DayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [roundIdx, setRoundIdx] = useState(0);
  const [found, setFound] = useState<FoundOre[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastHit, setLastHit] = useState<{ id: number; tier: TierId } | null>(null);
  // "+3s" pop on the timer, and the big Starcore celebration.
  const [timeBonus, setTimeBonus] = useState<{ id: number; secs: number } | null>(null);
  const [starcoreHit, setStarcoreHit] = useState<{ id: number; name: string } | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [arriving, setArriving] = useState(false);
  const [armed, setArmed] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [howOpens, setHowOpens] = useState(0);

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
    setArmed(false);
    setPhase("launch");
    sfx.launch();
  };

  const flyToAsteroid = useCallback(() => {
    setArriving(false);
    setPhase("approach");
    sfx.warp();
  }, []);

  // Partway through the approach the rocket starts braking to land.
  useEffect(() => {
    if (phase !== "approach") return;
    const t = setTimeout(() => setArriving(true), reducedMotion() ? 200 : DESCENT_AT);
    return () => clearTimeout(t);
  }, [phase]);

  const startCountdown = useCallback(() => {
    setCount(COUNTDOWN_FROM);
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
      setTimeBonus(null);
      setStarcoreHit(null);
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
    // Only the player's own finds show between rounds. The full answer lists
    // stay hidden until the mission report.
    setRevealIdx(roundIdx);
    setStarcoreHit(null);
    setTimeBonus(null);
    setPhase("reveal");
  }, [day, roundIdx, persist]);

  // Round clock.
  useEffect(() => {
    if (phase !== "drilling") return;
    inputRef.current?.focus();
    let lastSecond = -1;
    const tick = () => {
      const left = Math.max(0, startedAtRef.current + ROUND_MS + bonusMs(foundRef.current) - Date.now());
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
    // Keep the keyboard up on phones: focus stays in the box after every guess.
    inputRef.current?.focus();
    const submittedAt = Date.now();
    if (submittedAt > startedAtRef.current + ROUND_MS + bonusMs(foundRef.current)) return;

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
        say({ kind: "hit", tier: data.tier, text: `+${t.depth} m ${t.name}${t.bonus ? ` · +${t.bonus}s` : ""}${corrected}` });
        if (t.bonus) setTimeBonus({ id: feedbackId.current, secs: t.bonus });
        if (data.tier === 6) setStarcoreHit({ id: feedbackId.current, name: data.name });
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
          ? arriving
            ? "descent"
            : "cruise"
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

    if (date < LAUNCH_DATE) {
      return (
        <div className={s.center}>
          <p className={s.errorText}>Survey #1 launches {formatShortDate(LAUNCH_DATE)}.</p>
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
      const first = doneRounds === 0;
      return (
        <>
          <section className={s.briefing} data-briefing="true">
            <GameTitle />
            <p className={s.briefSub}>
              <span className={s.kicker}>Survey #{day.number}</span>
              <span>
                Five asteroids. <span className={s.accent}>{ROUND_SECONDS} seconds each.</span>
              </span>
            </p>
            {!first && <p className={s.runSoFar}>Run so far: {formatMeters(runDepth)}</p>}

            <div className={s.howTo} data-open={howOpen}>
              <button
                type="button"
                className={s.howToToggle}
                aria-expanded={howOpen}
                aria-controls="how-to-play"
                onClick={() => {
                  if (!howOpen) setHowOpens((n) => n + 1);
                  setHowOpen(!howOpen);
                }}
              >
                How to play
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {/* Grid rows animate from 0fr to 1fr, so the panel eases open to its real height. */}
              <div id="how-to-play" className={s.howToPanel} inert={!howOpen}>
                <div className={s.howToClip}>
                  <div className={s.howToBody}>
                    <p className={s.howToIntro}>
                      Each rock is a category. Name as many answers as you can before your drill overheats. The
                      obvious answers are plain stone. Obscure ones are buried deep and worth far more.
                    </p>
                    <HowToPlay key={howOpens} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sits on the ground under the launch pad. Hover primes the engines. */}
          <button
            className={s.liftBtn}
            onClick={first ? liftOff : flyToAsteroid}
            onPointerEnter={() => setArmed(true)}
            onPointerLeave={() => setArmed(false)}
            onFocus={() => setArmed(true)}
            onBlur={() => setArmed(false)}
            data-armed={armed}
          >
            <span className={s.primed} aria-hidden="true">
              {first ? "Engines primed" : "Course plotted"}
            </span>
            {first ? "Lift off" : `Fly to asteroid ${roundIdx + 1}`}
          </button>
        </>
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
          {/* Letterbox bars mark this as a cutscene. The text is flavor, so it
              sits small in the bottom bar like a subtitle. */}
          <div className={s.barTop}>
            <span className={s.autopilot}>
              <span className={s.autopilotDot} />
              Autopilot
            </span>
          </div>
          <div className={s.barBottom}>
            {p === "launch" ? (
              <p className={s.subtitle} aria-live="polite">
                <span className={s.logTag}>Flight log</span>
                <span className={s.captionSwap}>
                  <span className={s.captionA}>Engines lit. Clearing the launch tower.</span>
                  <span className={s.captionB}>Leaving the atmosphere behind.</span>
                </span>
              </p>
            ) : (
              <p className={s.subtitle} aria-live="polite">
                <span className={s.logTag}>Flight log</span>
                <span>
                  {arriving ? "Touching down: " : "Next stop: "}
                  {stop.region}
                  <span className={s.logDetail}> · {stop.detail}</span>
                </span>
              </p>
            )}
            <span className={s.skipBtn}>Skip ›</span>
          </div>
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
      const pct = Math.min(1, timeLeft / ROUND_MS);
      return (
        <section className={s.play}>
          <DrillShaft depth={depth} drilling={p === "drilling"} lastHit={lastHit} heat={1 - pct} />
          {starcoreHit && p === phase && phase === "drilling" && (
            <div key={starcoreHit.id} className={s.starcoreBurst} role="status">
              <span className={s.starcoreRing} aria-hidden="true" />
              <span className={s.starcoreRing} aria-hidden="true" />
              <span className={s.starcoreLabel}>Starcore!</span>
              <span className={s.starcoreName}>{starcoreHit.name}</span>
            </div>
          )}
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
              {timeBonus && p === "drilling" && (
                <span key={timeBonus.id} className={s.timeBonus} aria-hidden="true">
                  +{timeBonus.secs}s
                </span>
              )}
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
              <button
                className={s.drillBtn}
                type="submit"
                disabled={p !== "drilling"}
                // Tapping the button would steal focus and close the phone keyboard.
                onPointerDown={(e) => e.preventDefault()}
              >
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
            <p className={s.rockCode}>{rv.designation} · round {revealIdx + 1} of {day.rounds.length}</p>
            <h2 className={s.title}>{rv.title}</h2>
            <div className={s.revealStats}>
              <div>
                <span className={s.bigNum}>{res?.depth ?? 0}</span>
                <span className={s.statLabel}>meters</span>
              </div>
              <div>
                <span className={s.bigNum}>{res?.found.length ?? 0}</span>
                <span className={s.statLabel}>{res?.found.length === 1 ? "ore" : "ores"}</span>
              </div>
            </div>
            <button className={s.primaryBtn} onClick={next} autoFocus>
              {isLast ? "See mission report" : `Fly to the next asteroid`}
            </button>
          </header>
          <div className={s.cargo}>
            <p className={s.cargoHead}>
              Your haul <span>{res?.found.length ?? 0}</span>
            </p>
            {res && res.found.length > 0 ? (
              <ul className={s.ores}>
                {[...res.found]
                  .sort((a, b) => b.tier - a.tier)
                  .map((o) => (
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
            ) : (
              <p className={s.hint}>Nothing this time. The next rock might be kinder.</p>
            )}
          </div>
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
      {day && (
        <SpaceWorld
          world={world}
          target={worldTarget}
          armed={armed && phase === "briefing"}
          time={mode === "archive" ? "day" : "dusk"}
        />
      )}
      <div className={s.stack} data-game="true">
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
