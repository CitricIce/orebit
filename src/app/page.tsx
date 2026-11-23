import Link from "next/link";
import DailyGame from "@/components/DailyGame";

export default function Home() {
  return (
    <>
      {/* Read by search engines and screen readers; the game draws its own title. */}
      <div className="sr-only">
        <h1>Orebit: the daily category game</h1>
        <p>
          Five asteroids a day, 45 seconds each. Name as many answers as you can. Obvious ones are plain stone, rare ones
          are buried treasure. <Link href="/about">About Orebit</Link>
        </p>
      </div>
      <DailyGame />
    </>
  );
}
