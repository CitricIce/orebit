"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMounted } from "@/lib/client/useMounted";
import { setSoundEnabled, soundEnabled } from "@/lib/client/storage";
import Feedback from "./Feedback";
import s from "./SiteHeader.module.css";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/stats", label: "Stats" },
];

export default function SiteHeader({ static: isStatic = false }: { static?: boolean }) {
  return isStatic ? <HeaderBody path="" /> : <LiveHeader />;
}

function LiveHeader() {
  return <HeaderBody path={usePathname()} />;
}

function HeaderBody({ path }: { path: string }) {
  const mounted = useMounted();
  const [override, setOverride] = useState<boolean | null>(null);
  const sound = override ?? (mounted ? soundEnabled() : true);

  const toggle = () => {
    setSoundEnabled(!sound);
    setOverride(!sound);
  };

  return (
    <header className={s.header}>
      <nav className={s.nav} aria-label="Main">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={s.link} data-active={active}>
              {l.label}
            </Link>
          );
        })}
        <button
          className={s.sound}
          onClick={toggle}
          aria-pressed={sound}
          aria-label={sound ? "Mute sound" : "Turn sound on"}
          title={sound ? "Mute sound" : "Turn sound on"}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
            {sound ? (
              <path d="M13 7c1.2 1.6 1.2 4.4 0 6M15.5 5c2.3 2.8 2.3 7.2 0 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M13 7.5l5 5M18 7.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
        {path !== "" && <Feedback />}
      </nav>
    </header>
  );
}
