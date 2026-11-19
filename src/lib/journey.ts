/** Where each of the day's asteroids sits, heading outward from the Sun. */
export interface Stop {
  region: string;
  detail: string;
  planet: "mars" | "jupiter" | "saturn" | "neptune" | "pluto";
  /** Asteroid surface colors: light, mid, dark. */
  rock: [string, string, string];
  /** Color of the glowing ore veins and crystals on this asteroid. */
  ore: string;
}

export const STOPS: Stop[] = [
  {
    region: "Main asteroid belt",
    detail: "Between Mars and Jupiter · 2.7 AU from the Sun",
    planet: "mars",
    ore: "#f4c44f",
    rock: ["#9c7f6a", "#5e4a3f", "#2b211c"],
  },
  {
    region: "Jupiter trojans",
    detail: "Riding Jupiter's orbit · 5.2 AU from the Sun",
    planet: "jupiter",
    ore: "#6ff3e6",
    rock: ["#8a8290", "#4d4654", "#221e27"],
  },
  {
    region: "Centaurs",
    detail: "Between Saturn and Uranus · 14 AU from the Sun",
    planet: "saturn",
    ore: "#ff6fd8",
    rock: ["#b07a62", "#64403a", "#2a1a18"],
  },
  {
    region: "Kuiper belt",
    detail: "Out past Neptune · 42 AU from the Sun",
    planet: "neptune",
    ore: "#9fd8ff",
    rock: ["#b9d3e6", "#6d8aa3", "#2a3a4b"],
  },
  {
    region: "Scattered disc",
    detail: "Far beyond Pluto · 90 AU from the Sun",
    planet: "pluto",
    ore: "#b28cff",
    rock: ["#d8d0ea", "#8a80a8", "#332c48"],
  },
];

export function stopFor(round: number): Stop {
  return STOPS[Math.min(round, STOPS.length - 1)];
}

/** Scene lengths in ms. Players can tap to skip. */
export const LAUNCH_MS = 3200;
/** Cruise, then brake and land. Landing starts at DESCENT_AT. */
export const APPROACH_MS = 6600;
export const DESCENT_AT = 3800;
