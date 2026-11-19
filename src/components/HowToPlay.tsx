import { RANKS, ROUND_SECONDS, ROUNDS_PER_DAY, TIER_LIST } from "@/lib/tiers";
import s from "./Pages.module.css";

const FAQ = [
  {
    q: "How are the answer lists made?",
    a: "Each category starts from reference lists like encyclopedias, dictionaries and official registries. Lists get merged, cleaned and given aliases so common alternate names count too.",
  },
  {
    q: "How is rarity decided?",
    a: "Every answer gets a familiarity score from word-frequency data, which measures how often a name shows up in real writing. Answers are ranked inside their category and split into tiers. Where the numbers get it wrong, the tier is corrected by hand.",
  },
  {
    q: "What's the Starcore?",
    a: "One answer per asteroid. It's not always the single rarest answer. It's picked to be deep but findable, the one that feels great to land.",
  },
  {
    q: "Do typos count?",
    a: "Small ones, yes. Longer names allow a letter or two off, as long as only one answer is that close. Plurals, accents, capitals and punctuation don't matter.",
  },
  {
    q: "Why didn't my answer count?",
    a: "Either it isn't in the list yet, or it was too far from any answer. Lists keep growing.",
  },
  {
    q: "Is everyone playing the same rocks?",
    a: "Yes. Everyone gets the same five categories each day. A new survey opens at midnight in your time zone.",
  },
  {
    q: "Where are my stats saved?",
    a: "In this browser. Clearing your site data resets them.",
  },
];

/** The full rules, tiers, ranks and FAQ. Shown inside "How to play" on the start screen. */
export default function HowToPlay() {
  return (
    <div className={s.guide}>
      <ol className={s.steps}>
        <li>
          <strong>
            {ROUNDS_PER_DAY} asteroids, {ROUND_SECONDS} seconds each.
          </strong>{" "}
          Every asteroid is a category, like dog breeds or chemical elements.
        </li>
        <li>
          <strong>Name as many answers as you can.</strong> Type one, press Enter, and keep going. Every correct answer
          drills you deeper.
        </li>
        <li>
          <strong>Rare answers dig deeper.</strong> &ldquo;Poodle&rdquo; is surface dust. &ldquo;Azawakh&rdquo; is buried crystal. Speed and
          knowledge both pay off.
        </li>
        <li>
          <strong>Share your depth.</strong> Your five rocks add up to one total. Compare with friends without spoiling
          answers.
        </li>
      </ol>

      <h3 className={s.h2}>Ore tiers</h3>
      <div className={s.tierTable}>
        {TIER_LIST.map((t) => (
          <div key={t.id} className={s.tierRow} style={{ "--c": t.color } as React.CSSProperties}>
            <span className={s.tierGem} data-tier={t.id} />
            <span className={s.tierName}>{t.name}</span>
            <span className={s.tierBlurb}>{t.blurb}</span>
            <span className={s.tierDepth}>+{t.depth} m</span>
          </div>
        ))}
      </div>

      <h3 className={s.h2}>Ranks</h3>
      <div className={s.rankList}>
        {RANKS.map((r) => (
          <div key={r.title} className={s.rankRow}>
            <span>{r.title}</span>
            <span className={s.muted}>{r.min.toLocaleString("en-US")} m+</span>
          </div>
        ))}
      </div>

      <h3 className={s.h2}>Questions</h3>
      <dl className={s.faq}>
        {FAQ.map((f) => (
          <div key={f.q}>
            <dt>{f.q}</dt>
            <dd>{f.a}</dd>
          </div>
        ))}
      </dl>

    </div>
  );
}
