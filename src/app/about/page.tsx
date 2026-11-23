import type { Metadata } from "next";
import Link from "next/link";
import { RANKS, TIER_LIST } from "@/lib/tiers";
import s from "@/components/Pages.module.css";

export const metadata: Metadata = {
  title: "About Orebit, the daily category game",
  description:
    "Orebit is a free daily category game. Fly to five asteroids, name as many answers as you can in 45 seconds each, and dig up rare answers for big points.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <article className={s.about}>
      <p className={s.kicker}>About</p>
      <h1 className={s.h1}>Orebit is the daily mine.</h1>
      <p className={s.lede}>
        Orebit is a free daily category game you play in your browser. Every day you fly to five asteroids. Each asteroid
        is a category, like cheeses, dinosaurs or things that are red, and you get 45 seconds to name as many answers as
        you can.
      </p>

      <h2 className={s.h2}>How to play Orebit</h2>
      <ol className={s.aboutList}>
        <li>Every day brings five new asteroids, the same for everyone.</li>
        <li>Each asteroid is a category. Type an answer, press Enter, and keep going until the 45 seconds run out.</li>
        <li>Every correct answer drills you deeper. Small typos still count.</li>
        <li>Obvious answers are plain stone. Rare ones are buried treasure, and each asteroid hides one Starcore.</li>
        <li>Your total depth for the day sets your rank. Share your result card with friends without spoiling a thing.</li>
      </ol>

      <h2 className={s.h2}>Ores and points</h2>
      <ul className={s.aboutList}>
        {TIER_LIST.map((t) => (
          <li key={t.id}>
            <strong>{t.name}</strong>: {t.depth} m{t.bonus ? ` and +${t.bonus} second${t.bonus > 1 ? "s" : ""}` : ""}. {t.blurb}
          </li>
        ))}
      </ul>

      <h2 className={s.h2}>Ranks</h2>
      <ul className={s.aboutList}>
        {RANKS.map((r) => (
          <li key={r.title}>
            <strong>{r.title}</strong>: {r.min.toLocaleString("en-US")} m or more in one day
          </li>
        ))}
      </ul>

      <h2 className={s.h2}>Questions</h2>
      <h3 className={s.h3}>Is Orebit free?</h3>
      <p className={s.aboutText}>Yes. Orebit is free to play, with no account and no download.</p>
      <h3 className={s.h3}>When do new asteroids arrive?</h3>
      <p className={s.aboutText}>Every day at midnight in your time zone.</p>
      <h3 className={s.h3}>Missed a day?</h3>
      <p className={s.aboutText}>
        Replay any past survey in the <Link href="/archive">archive</Link>.
      </p>
      <h3 className={s.h3}>Where can I play?</h3>
      <p className={s.aboutText}>
        Right here at orebit.live, on your phone or computer. <Link href="/">Play today&apos;s Orebit</Link>.
      </p>
    </article>
  );
}
