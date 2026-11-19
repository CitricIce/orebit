/** Where each of the day's asteroids sits. Round 1 is closest to the Sun. */
export interface Stop {
  region: string;
  detail: string;
  planet: "mars" | "jupiter" | "neptune";
  /** Asteroid surface colors: light, mid, dark. */
  rock: [string, string, string];
}

export const STOPS: Stop[] = [
  {
    region: "Main asteroid belt",
    detail: "Between Mars and Jupiter · 2.7 AU from the Sun",
    planet: "mars",
    rock: ["#9c7f6a", "#5e4a3f", "#2b211c"],
  },
  {
    region: "Jupiter trojans",
    detail: "Riding Jupiter's orbit · 5.2 AU from the Sun",
    planet: "jupiter",
    rock: ["#8a8290", "#4d4654", "#221e27"],
  },
  {
    region: "Kuiper belt",
    detail: "Out past Neptune · 42 AU from the Sun",
    planet: "neptune",
    rock: ["#b9d3e6", "#6d8aa3", "#2a3a4b"],
  },
];

export function stopFor(round: number): Stop {
  return STOPS[Math.min(round, STOPS.length - 1)];
}

/** Scene lengths in ms. Players can tap to skip. */
export const LAUNCH_MS = 3200;
/** Cruise, then brake and land. Landing starts at DESCENT_AT. */
export const APPROACH_MS = 4300;
export const DESCENT_AT = 2000;
